import Groq from "groq-sdk";

if (!process.env.GROQ_API_KEY) {
  throw new Error(
    "GROQ_API_KEY environment variable is not set. Please add it to your .env.local file."
  );
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const MODEL_LLAMA = "llama-3.1-8b-instant" as const;
export const MODEL_GPT_OSS = "openai/gpt-oss-20b" as const;

/** Groq 413 = request body too large. Raised to 16K to avoid truncating calendar data. */
const MAX_SYSTEM_CHARS = 16_000;
const MAX_HISTORY_MESSAGES = 2;
const MAX_MESSAGE_CHARS = 1_000;
const MAX_USER_PROMPT_CHARS = 1_000;

const MAX_TOKENS_LLAMA = 2048;
const MAX_TOKENS_GPT_OSS = 4096;

/** Default fallback delay when we can't parse Groq's retry-after value. */
const DEFAULT_RETRY_AFTER_MS = 8000;
/** Cap retry wait to avoid excessively long delays for the user. */
const MAX_RETRY_AFTER_MS = 15000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + "...[truncated]";
}

function buildMessages(
  prompt: string,
  systemPrompt?: string,
  history?: ChatMessage[]
): { role: "system" | "user" | "assistant"; content: string }[] {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: truncate(systemPrompt, MAX_SYSTEM_CHARS) });
  }

  if (history && history.length > 0) {
    const recentHistory = history.slice(-MAX_HISTORY_MESSAGES);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: truncate(msg.content, MAX_MESSAGE_CHARS) });
    }
  }

  messages.push({ role: "user", content: truncate(prompt, MAX_USER_PROMPT_CHARS) });
  return messages;
}

async function callModel(
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number
): Promise<string> {
  const response = await groq.chat.completions.create({
    model,
    messages,
    max_tokens: maxTokens,
  });
  const content = response?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from model");
  }
  return content;
}

function is429Error(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("429") || msg.includes("rate") || msg.includes("Rate limit");
}

/**
 * Parse retry delay from Groq 429 error message.
 * Example: "Please try again in 7.439999999s"
 * Returns milliseconds or the default fallback.
 */
function parseRetryAfterMs(error: unknown): number {
  const msg = error instanceof Error ? error.message : String(error);
  const match = msg.match(/try again in (\d+(?:\.\d+)?)s/i);
  if (match) {
    const seconds = parseFloat(match[1]);
    const ms = Math.ceil(seconds * 1000);
    return Math.min(ms, MAX_RETRY_AFTER_MS);
  }
  return DEFAULT_RETRY_AFTER_MS;
}

/**
 * Try primary model, fallback to backup on error.
 * On 429 rate limit: wait Groq's suggested time, then retry once before falling back.
 */
export async function askGroqWithFallback(
  prompt: string,
  systemPrompt: string | undefined,
  history: ChatMessage[] | undefined,
  primaryModel: typeof MODEL_LLAMA | typeof MODEL_GPT_OSS,
  backupModel: typeof MODEL_LLAMA | typeof MODEL_GPT_OSS
): Promise<string> {
  const messages = buildMessages(prompt, systemPrompt, history);

  function tryModel(model: string): Promise<string> {
    const maxT = model === MODEL_GPT_OSS ? MAX_TOKENS_GPT_OSS : MAX_TOKENS_LLAMA;
    return callModel(model, messages, maxT);
  }

  try {
    return await tryModel(primaryModel);
  } catch (primaryError: unknown) {
    // Retry once on 429 — wait Groq's suggested time before retrying
    if (is429Error(primaryError)) {
      const retryMs = parseRetryAfterMs(primaryError);
      if (process.env.NODE_ENV === "development") {
        console.log(`Groq [${primaryModel}] 429, retrying after ${retryMs}ms`);
      }
      await sleep(retryMs);
      try {
        return await tryModel(primaryModel);
      } catch {
        // Fall through to backup
      }
    }

    const errMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
    if (process.env.NODE_ENV === "development") {
      console.error(`Groq [${primaryModel}] failed, trying backup [${backupModel}]:`, errMsg);
    }

    try {
      const result = await tryModel(backupModel);
      if (process.env.NODE_ENV === "development") {
        console.log(`Groq backup [${backupModel}] succeeded`);
      }
      return result;
    } catch (backupError: unknown) {
      if (process.env.NODE_ENV === "development") {
        console.error(`Groq backup [${backupModel}] also failed:`, backupError);
      }
      throw primaryError;
    }
  }
}
