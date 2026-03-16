import Groq from "groq-sdk";
import { getEnv } from "@/lib/env";

const groq = new Groq({ apiKey: getEnv().GROQ_API_KEY });

export const MODEL_LLAMA = "llama-3.1-8b-instant" as const;

/** Groq 413 = request body too large. Raised to 16K to avoid truncating calendar data. */
const MAX_SYSTEM_CHARS = 16_000;
const MAX_HISTORY_MESSAGES = 2;
const MAX_MESSAGE_CHARS = 1_000;
const MAX_USER_PROMPT_CHARS = 1_000;

const MAX_TOKENS_LLAMA = 2048;

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

export async function askGroq(
  prompt: string,
  systemPrompt: string | undefined,
  history: ChatMessage[] | undefined,
  model: typeof MODEL_LLAMA = MODEL_LLAMA
): Promise<string> {
  const messages = buildMessages(prompt, systemPrompt, history);
  return callModel(model, messages, MAX_TOKENS_LLAMA);
}
