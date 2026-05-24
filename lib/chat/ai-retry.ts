import {
  askWorkersAi,
  isAiRateLimitError,
  type ChatMessage,
} from "@/lib/ai";
import { isSimpleCalendarQuestion } from "@/lib/chat/intent";

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

export function getModelResponseBudget(
  message: string,
  useCalendarPrompt: boolean,
  isCompareRequested: boolean,
  maxOutputTokens: number
): { maxTokens: number; temperature: number } {
  const lower = message.toLowerCase();
  const asksDetail =
    lower.includes("explain") ||
    lower.includes("why") ||
    lower.includes("how") ||
    lower.includes("detail") ||
    lower.includes("huraikan") ||
    lower.includes("jelaskan") ||
    lower.includes("full") ||
    lower.includes("complete") ||
    lower.includes("lengkap") ||
    lower.includes("semua") ||
    lower.includes("list all") ||
    lower.includes("senarai");

  if (!useCalendarPrompt) {
    return { maxTokens: maxOutputTokens, temperature: 0.25 };
  }
  if (isCompareRequested) {
    return { maxTokens: maxOutputTokens, temperature: 0.15 };
  }
  if (asksDetail) {
    return { maxTokens: maxOutputTokens, temperature: 0.2 };
  }
  if (isSimpleCalendarQuestion(message)) {
    return { maxTokens: maxOutputTokens, temperature: 0.1 };
  }
  return { maxTokens: maxOutputTokens, temperature: 0.15 };
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
