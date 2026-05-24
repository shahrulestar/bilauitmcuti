import {
  askWorkersAi,
  isAiRateLimitError,
  type ChatMessage,
} from "@/lib/ai";
import {
  isSimpleCalendarQuestion,
  messageAsksDetail,
  messageIsLong,
} from "@/lib/chat/intent";

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  return String(error).toLowerCase();
}

function isTransientModelError(error: unknown): boolean {
  const msg = normalizeErrorMessage(error);
  return (
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("busy") ||
    msg.includes("loading") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("network") ||
    msg.includes("empty response") ||
    msg.includes("finish_reason")
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Short questions — keep responses fast. */
const TOKEN_CAP_SIMPLE = 384;
const TOKEN_CAP_CALENDAR = 768;
const TOKEN_CAP_TABLE_COMPARE = 1536;
const TOKEN_CAP_DETAIL = 3072;
const TOKEN_CAP_LONG_INPUT = 3072;
const TOKEN_CAP_RESEARCH = 2048;

function capTokens(requested: number, ceiling: number): number {
  return Math.min(requested, ceiling);
}

export function getModelResponseBudget(
  message: string,
  useCalendarPrompt: boolean,
  wantsTableOrCompare: boolean,
  maxOutputTokens: number
): { maxTokens: number; temperature: number } {
  const asksDetail = messageAsksDetail(message);

  if (!useCalendarPrompt) {
    return {
      maxTokens: capTokens(maxOutputTokens, TOKEN_CAP_RESEARCH),
      temperature: 0.25,
    };
  }
  if (wantsTableOrCompare) {
    return {
      maxTokens: capTokens(maxOutputTokens, TOKEN_CAP_TABLE_COMPARE),
      temperature: 0.15,
    };
  }
  if (asksDetail || messageIsLong(message)) {
    return {
      maxTokens: capTokens(
        maxOutputTokens,
        asksDetail ? TOKEN_CAP_DETAIL : TOKEN_CAP_LONG_INPUT
      ),
      temperature: 0.2,
    };
  }
  if (isSimpleCalendarQuestion(message)) {
    return {
      maxTokens: capTokens(maxOutputTokens, TOKEN_CAP_SIMPLE),
      temperature: 0.1,
    };
  }
  return {
    maxTokens: capTokens(maxOutputTokens, TOKEN_CAP_CALENDAR),
    temperature: 0.15,
  };
}

const RETRY_DELAYS_MS = [350];

export async function askAiWithRetry(
  message: string,
  systemPrompt: string,
  history: ChatMessage[] | undefined,
  options: { maxTokens: number; temperature: number; requestHost?: string | null }
): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await askWorkersAi(message, systemPrompt, history, options);
    } catch (err) {
      lastError = err;
      if (!isTransientModelError(err) || attempt >= RETRY_DELAYS_MS.length) throw err;
      if (isAiRateLimitError(err)) throw err;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

export async function streamAiWithRetry(
  message: string,
  systemPrompt: string,
  history: ChatMessage[] | undefined,
  options: {
    maxTokens: number;
    temperature: number;
    requestHost?: string | null;
    onToken: (token: string) => void | Promise<void>;
  }
): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const { streamWorkersAi } = await import("@/lib/ai");
      return await streamWorkersAi(message, systemPrompt, history, {
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        requestHost: options.requestHost,
        onToken: options.onToken,
      });
    } catch (err) {
      lastError = err;
      if (!isTransientModelError(err) || attempt >= RETRY_DELAYS_MS.length) throw err;
      if (isAiRateLimitError(err)) throw err;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}
