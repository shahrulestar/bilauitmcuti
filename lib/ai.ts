/** Primary Workers AI model for chat. */
export const MODEL_WORKERS_AI = "@cf/meta/llama-3.2-3b-instruct" as const;

/** Max completion tokens for Workers AI (@cf/meta/llama-3.2-3b-instruct output ceiling). */
export const MAX_OUTPUT_TOKENS = 2048;

/** @deprecated Use MAX_OUTPUT_TOKENS */
export const MAX_TOKENS_LLAMA = MAX_OUTPUT_TOKENS;

const DEFAULT_TEMPERATURE = 0.2;

/** Request body too large. Tuned for a safer payload budget. */
const MAX_SYSTEM_CHARS = 12_000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 2_400;
const MAX_USER_PROMPT_CHARS = 2_000;

interface WorkersAiTextResponse {
  response?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function isAiRateLimitError(error: unknown): boolean {
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

export async function getAiBinding(): Promise<Ai | null> {
  try {
    const { getOptionalRequestContext } = await import("@cloudflare/next-on-pages");
    const ctx = getOptionalRequestContext();
    return (ctx?.env as CloudflareEnv | undefined)?.AI ?? null;
  } catch {
    return null;
  }
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

function extractWorkersAiContent(result: unknown): string {
  if (typeof result === "string" && result.trim()) return result;

  if (result && typeof result === "object") {
    const data = result as WorkersAiTextResponse;
    if (typeof data.response === "string" && data.response.trim()) return data.response;
    const choiceContent = data.choices?.[0]?.message?.content;
    if (typeof choiceContent === "string" && choiceContent.trim()) return choiceContent;
  }

  throw new Error("Empty response from model");
}

async function workersAiChatCompletion(params: {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  max_tokens: number;
  temperature: number;
}): Promise<string> {
  const ai = await getAiBinding();
  if (!ai) {
    const err = new Error(
      "Workers AI binding not available. Add an AI binding named AI in Cloudflare Pages, or run pnpm preview locally."
    );
    Object.assign(err, { status: 503 });
    throw err;
  }

  try {
    const result = await ai.run(MODEL_WORKERS_AI, {
      messages: params.messages,
      max_tokens: params.max_tokens,
      temperature: params.temperature,
    });
    return extractWorkersAiContent(result);
  } catch (e) {
    if (e instanceof Error) {
      const msg = e.message.toLowerCase();
      if (msg.includes("429") || msg.includes("rate limit")) {
        Object.assign(e, { status: 429 });
      }
    }
    throw e;
  }
}

export async function askWorkersAi(
  prompt: string,
  systemPrompt: string | undefined,
  history: ChatMessage[] | undefined,
  options?: {
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  const messages = buildMessages(prompt, systemPrompt, history);
  return workersAiChatCompletion({
    messages,
    max_tokens: options?.maxTokens ?? MAX_OUTPUT_TOKENS,
    temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
  });
}
