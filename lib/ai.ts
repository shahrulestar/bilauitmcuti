import { getEnv } from "@/lib/env";

const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Primary: fast, cost-efficient. */
export const MODEL_LLAMA = "llama-3.1-8b-instant" as const;
/** Fallback when primary fails after retries (same Groq API). */
export const MODEL_LLAMA_FALLBACK = "llama-3.3-70b-versatile" as const;
/** Used when primary and fallback hit Groq rate limits (separate quota pool). */
export const MODEL_LLAMA_RATE_LIMIT_ESCAPE = "llama-3.1-70b-versatile" as const;

export function isGroqRateLimitError(error: unknown): boolean {
  const status =
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : undefined;
  if (status === 429) return true;
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  );
}

/** Groq 413 = request body too large. Tuned for a safer payload budget. */
const MAX_SYSTEM_CHARS = 12_000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 1_200;
const MAX_USER_PROMPT_CHARS = 1_200;

export const MAX_TOKENS_LLAMA = 2048;
const DEFAULT_TEMPERATURE = 0.2;

/** Timeout for GROQ API calls (Cloudflare Workers ~30–60s limit). */
const GROQ_REQUEST_TIMEOUT_MS = 55_000;

interface GroqChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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

async function groqChatCompletion(params: {
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  max_tokens: number;
  temperature: number;
}): Promise<string> {
  const apiKey = getEnv().GROQ_API_KEY;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GROQ_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        max_tokens: params.max_tokens,
        temperature: params.temperature,
      }),
      signal: controller.signal,
    });

    const rawText = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      const err = new Error(rawText.slice(0, 500) || `Groq HTTP ${res.status}`);
      Object.assign(err, { status: res.status });
      throw err;
    }

    if (!res.ok) {
      const msg =
        typeof parsed === "object" &&
        parsed !== null &&
        "error" in parsed &&
        typeof (parsed as { error?: { message?: unknown } }).error?.message === "string"
          ? (parsed as { error: { message: string } }).error.message
          : `Groq API error ${res.status}`;
      const err = new Error(msg);
      Object.assign(err, { status: res.status });
      throw err;
    }

    const data = parsed as GroqChatCompletionResponse;
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from model");
    }
    return content;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callModel(
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
  temperature: number
): Promise<string> {
  return groqChatCompletion({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  });
}

export async function askGroq(
  prompt: string,
  systemPrompt: string | undefined,
  history: ChatMessage[] | undefined,
  model: string = MODEL_LLAMA,
  options?: {
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  const messages = buildMessages(prompt, systemPrompt, history);
  return callModel(
    model,
    messages,
    options?.maxTokens ?? MAX_TOKENS_LLAMA,
    options?.temperature ?? DEFAULT_TEMPERATURE
  );
}
