import Groq from "groq-sdk";
import { getEnv } from "@/lib/env";

const groq = new Groq({ apiKey: getEnv().GROQ_API_KEY });

export const MODEL_LLAMA = "llama-3.1-8b-instant" as const;

/** Groq 413 = request body too large. Tuned for a safer payload budget. */
const MAX_SYSTEM_CHARS = 12_000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 1_200;
const MAX_USER_PROMPT_CHARS = 1_200;

const MAX_TOKENS_LLAMA = 2048;
const DEFAULT_TEMPERATURE = 0.2;

/** Timeout for GROQ API calls (Cloudflare Workers ~30–60s limit). */
const GROQ_REQUEST_TIMEOUT_MS = 55_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    ),
  ]);
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

async function callModel(
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
  temperature: number
): Promise<string> {
  const response = await withTimeout(
    groq.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
    GROQ_REQUEST_TIMEOUT_MS
  );
  const content = response?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from model");
  }
  return content;
}

export async function askGroq(
  prompt: string,
  systemPrompt: string | undefined,
  history: ChatMessage[] | undefined,
  model: typeof MODEL_LLAMA = MODEL_LLAMA,
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
