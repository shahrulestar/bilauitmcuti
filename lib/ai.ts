import {
  buildAiGatewayRunOptions,
  type AiGatewayRunOptions,
} from "@/lib/ai-gateway";
import {
  formatToolsForModel,
  usesOpenAiFunctionToolFormat,
  type FlatToolDefinition,
} from "@/lib/chat/agent/tool-format";
import { CHAT_MAX_MESSAGE_LENGTH } from "@/lib/chat/limits";

/** Dev / preview / localhost chat model (fast, lower cost). */
export const MODEL_WORKERS_AI_DEV = "@cf/meta/llama-3.2-3b-instruct" as const;

/** Production primary chat model. */
export const MODEL_WORKERS_AI_PRODUCTION =
  "@cf/google/gemma-4-26b-a4b-it" as const;

/** @deprecated Use MODEL_WORKERS_AI_DEV */
export const MODEL_WORKERS_AI = MODEL_WORKERS_AI_DEV;

const PRODUCTION_SITE_HOST = "bilauitmcuti.com";

export type WorkersAiModelTier = "dev" | "production";

interface WorkersAiTierLimits {
  maxOutputTokens: number;
  maxSystemChars: number;
  maxHistoryMessages: number;
  maxMessageChars: number;
  maxUserPromptChars: number;
}

const TIER_LIMITS: Record<WorkersAiModelTier, WorkersAiTierLimits> = {
  dev: {
    maxOutputTokens: 4096,
    maxSystemChars: 12_000,
    maxHistoryMessages: 8,
    maxMessageChars: CHAT_MAX_MESSAGE_LENGTH,
    maxUserPromptChars: CHAT_MAX_MESSAGE_LENGTH,
  },
  production: {
    maxOutputTokens: 4096,
    maxSystemChars: 16_000,
    maxHistoryMessages: 10,
    maxMessageChars: CHAT_MAX_MESSAGE_LENGTH,
    maxUserPromptChars: CHAT_MAX_MESSAGE_LENGTH,
  },
};

/** Default max completion tokens (dev tier). */
export const MAX_OUTPUT_TOKENS = TIER_LIMITS.dev.maxOutputTokens;

/** @deprecated Use MAX_OUTPUT_TOKENS */
export const MAX_TOKENS_LLAMA = MAX_OUTPUT_TOKENS;

const DEFAULT_TEMPERATURE = 0.2;

function normalizeHost(host: string): string {
  return host.replace(/^www\./, "").split(":")[0].toLowerCase();
}

function isProductionSiteHost(host: string | null | undefined): boolean {
  if (!host?.trim()) return false;
  return normalizeHost(host) === PRODUCTION_SITE_HOST;
}

function isLocalOrPreviewHost(host: string): boolean {
  const h = normalizeHost(host);
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".pages.dev") ||
    h === "127.0.0.1"
  );
}

function isStrictLocalDevHost(host: string): boolean {
  const h = normalizeHost(host);
  return h === "localhost" || h.endsWith(".localhost") || h === "127.0.0.1";
}

function isWorkersAiUseProductionModelLocally(): boolean {
  const v = process.env.WORKERS_AI_USE_PRODUCTION_MODEL;
  return v === "1" || v === "true";
}

function isCloudflarePagesPreviewDeploy(): boolean {
  const url = process.env.CF_PAGES_URL?.toLowerCase() ?? "";
  return url.includes(".pages.dev");
}

/**
 * Production (bilauitmcuti.com): Gemma 4.
 * Local + Pages preview (*.pages.dev, localhost): Llama 3.2 3B.
 * Optional: WORKERS_AI_MODEL, WORKERS_AI_USE_DEV_MODEL=1,
 * WORKERS_AI_USE_PRODUCTION_MODEL=1 (strict localhost only — test Gemma locally).
 */
export function resolveWorkersAiModelTier(requestHost?: string | null): WorkersAiModelTier {
  const override = process.env.WORKERS_AI_MODEL?.trim();
  if (override) {
    return override === MODEL_WORKERS_AI_PRODUCTION ? "production" : "dev";
  }

  if (process.env.WORKERS_AI_USE_DEV_MODEL === "1" || process.env.WORKERS_AI_USE_DEV_MODEL === "true") {
    return "dev";
  }

  if (requestHost) {
    if (isProductionSiteHost(requestHost)) return "production";
    if (isLocalOrPreviewHost(requestHost)) {
      if (
        isWorkersAiUseProductionModelLocally() &&
        isStrictLocalDevHost(requestHost)
      ) {
        return "production";
      }
      return "dev";
    }
  }

  if (process.env.NODE_ENV !== "production") return "dev";

  if (isCloudflarePagesPreviewDeploy()) return "dev";

  if (process.env.CF_PAGES === "1") {
    const pagesUrl = process.env.CF_PAGES_URL?.toLowerCase() ?? "";
    if (pagesUrl && !pagesUrl.includes(".pages.dev")) return "production";
  }

  return "dev";
}

/** Ordered model ids for chat completion (production: Gemma only; dev/preview: Llama). */
export function resolveProductionChatModelChain(requestHost?: string | null): string[] {
  const override = process.env.WORKERS_AI_MODEL?.trim();
  if (override) return [override];

  const tier = resolveWorkersAiModelTier(requestHost);
  if (tier === "dev") return [MODEL_WORKERS_AI_DEV];

  return [MODEL_WORKERS_AI_PRODUCTION];
}

export function resolveWorkersAiModelId(requestHost?: string | null): string {
  return resolveProductionChatModelChain(requestHost)[0]!;
}

/** Tier limits follow the selected model, not only the host. */
export function resolveWorkersAiTierForModelId(
  modelId: string,
  requestHost?: string | null
): WorkersAiModelTier {
  if (
    modelId.includes("gemma-4") ||
    modelId.includes("gemma-3") ||
    modelId.startsWith("google/")
  ) {
    return "production";
  }
  if (modelId === MODEL_WORKERS_AI_DEV) return "dev";
  return resolveWorkersAiModelTier(requestHost);
}

/** Chat UI shows the full reply only after loading; never stream partial tokens to the client. */
export function shouldStreamTokensToClient(_requestHost?: string | null): boolean {
  return false;
}

export function getWorkersAiTierLimits(tier: WorkersAiModelTier): WorkersAiTierLimits {
  return TIER_LIMITS[tier];
}

export function getMaxOutputTokensForHost(requestHost?: string | null): number {
  const tier = resolveWorkersAiModelTier(requestHost);
  return TIER_LIMITS[tier].maxOutputTokens;
}

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

/** Errors where trying the production backup model may succeed. */
export function isModelFallbackError(error: unknown): boolean {
  if (isAiRateLimitError(error)) return true;
  const status = getAiErrorStatus(error);
  if (status === 500 || status === 502 || status === 503 || status === 504) return true;

  const msg = normalizeAiErrorMessage(error).toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("504") ||
    msg.includes("loading") ||
    msg.includes("unavailable") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("empty response") ||
    msg.includes("finish_reason") ||
    msg.includes("model") ||
    msg.includes("not found") ||
    msg.includes("unsupported") ||
    msg.includes("econnreset") ||
    msg.includes("network")
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

function buildChatGatewayMetadata(correlationId?: string): AiGatewayRunOptions["metadata"] {
  return correlationId
    ? { correlationId, path: "chat" }
    : { path: "chat" };
}

async function runAiWithGateway(
  ai: Ai,
  modelId: string,
  input: Record<string, unknown>,
  gatewayOpts?: AiGatewayRunOptions
): Promise<unknown> {
  const options = await buildAiGatewayRunOptions(gatewayOpts);
  if (options) {
    return ai.run(modelId, input, options);
  }
  return ai.run(modelId, input);
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + "...[truncated]";
}

function buildMessages(
  prompt: string,
  systemPrompt: string | undefined,
  history: ChatMessage[] | undefined,
  limits: WorkersAiTierLimits
): { role: "system" | "user" | "assistant"; content: string }[] {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

  if (systemPrompt) {
    messages.push({
      role: "system",
      content: truncate(systemPrompt, limits.maxSystemChars),
    });
  }

  if (history && history.length > 0) {
    const recentHistory = history.slice(-limits.maxHistoryMessages);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: truncate(msg.content, limits.maxMessageChars),
      });
    }
  }

  messages.push({
    role: "user",
    content: truncate(prompt, limits.maxUserPromptChars),
  });
  return messages;
}

function normalizeReasoningFallback(reasoning: string): string | null {
  const trimmed = reasoning.trim();
  if (!trimmed) return null;
  if (/^[\[{]/.test(trimmed) && /"name"\s*:/.test(trimmed)) return null;
  return trimmed;
}

function extractWorkersAiContentFromObject(result: unknown): string | null {
  if (typeof result === "string" && result.trim()) return result.trim();

  if (!result || typeof result !== "object") return null;

  const data = result as WorkersAiTextResponse;
  if (typeof data.response === "string" && data.response.trim()) return data.response.trim();

  const message = data.choices?.[0]?.message as
    | { content?: string | null; reasoning?: string | null }
    | undefined;
  if (typeof message?.content === "string" && message.content.trim()) {
    return message.content.trim();
  }
  if (message?.content == null || String(message.content).trim() === "") {
    if (typeof message?.reasoning === "string") {
      const fromReasoning = normalizeReasoningFallback(message.reasoning);
      if (fromReasoning) return fromReasoning;
    }
  }

  const geminiCandidates = (result as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    .candidates;
  const geminiText = geminiCandidates?.[0]?.content?.parts
    ?.map((p) => (p as { text?: string }).text ?? "")
    .join("");
  if (geminiText?.trim()) return geminiText.trim();

  return null;
}

export function tryExtractWorkersAiContent(result: unknown): string | null {
  return extractWorkersAiContentFromObject(result);
}

function extractWorkersAiContent(result: unknown): string {
  const content = extractWorkersAiContentFromObject(result);
  if (content) return content;
  throw new Error("Empty response from model");
}

function isGooglePartnerModelId(modelId: string): boolean {
  return modelId.startsWith("google/");
}

/** Normalize Workers AI / gateway errors (often plain objects, not Error instances). */
export function normalizeAiErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const o = error as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    if (typeof o.error === "string") return o.error;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

function getAiErrorStatus(error: unknown): number | undefined {
  if (
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }
  return undefined;
}

function isGemmaThinkingCapableModel(modelId: string): boolean {
  return modelId.includes("gemma-4") || modelId.includes("gemma-3");
}

function buildModelRunInput(
  modelId: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  max_tokens: number,
  temperature: number,
  stream: boolean
): Record<string, unknown> {
  if (isGooglePartnerModelId(modelId)) {
    return {
      contents: messagesToGeminiContents(messages),
      generationConfig: {
        maxOutputTokens: max_tokens,
        temperature,
      },
      ...(stream ? { stream: true } : {}),
    };
  }
  const input: Record<string, unknown> = {
    messages,
    max_tokens,
    temperature,
  };
  if (isGemmaThinkingCapableModel(modelId)) {
    input.chat_template_kwargs = { enable_thinking: false, thinking: false };
  }
  if (stream) input.stream = true;
  return input;
}

/** Whether to attempt the next model in the production chain after a failure. */
function shouldTryNextModelInChain(error: unknown, isLast: boolean): boolean {
  if (isLast) return false;
  const status = getAiErrorStatus(error);
  if (status === 401 || status === 403 || status === 413) return false;
  return true;
}

function messagesToGeminiContents(
  messages: { role: "system" | "user" | "assistant"; content: string }[]
): { role: string; parts: { text: string }[] }[] {
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const msg of messages) {
    if (msg.role === "system") {
      contents.push({
        role: "user",
        parts: [{ text: `Instructions:\n${msg.content}` }],
      });
      continue;
    }
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }
  return contents;
}

function isMessagesApiUnsupportedError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes("messages") ||
    msg.includes("invalid") ||
    msg.includes("unsupported") ||
    msg.includes("schema") ||
    msg.includes("unexpected")
  );
}

async function workersAiChatCompletion(params: {
  modelId: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  max_tokens: number;
  temperature: number;
  correlationId?: string;
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
    const input = buildModelRunInput(
      params.modelId,
      params.messages,
      params.max_tokens,
      params.temperature,
      false
    );
    const result = await runAiWithGateway(ai, params.modelId, input, {
      skipCache: false,
      cacheTtl: 120,
      metadata: buildChatGatewayMetadata(params.correlationId),
    });
    return extractWorkersAiContent(result);
  } catch (firstError) {
    const msg = normalizeAiErrorMessage(firstError).toLowerCase();
    if (msg.includes("429") || msg.includes("rate limit")) {
      const err = firstError instanceof Error ? firstError : new Error(msg);
      Object.assign(err, { status: 429 });
      throw err;
    }
    throw firstError;
  }
}

export async function askWorkersAi(
  prompt: string,
  systemPrompt: string | undefined,
  history: ChatMessage[] | undefined,
  options?: {
    maxTokens?: number;
    temperature?: number;
    /** Request Host header — selects production vs dev model on Cloudflare Pages. */
    requestHost?: string | null;
    correlationId?: string;
  }
): Promise<string> {
  const tier = resolveWorkersAiModelTier(options?.requestHost);
  const limits = getWorkersAiTierLimits(tier);
  const modelChain = resolveProductionChatModelChain(options?.requestHost);
  const messages = buildMessages(prompt, systemPrompt, history, limits);
  const max_tokens = options?.maxTokens ?? limits.maxOutputTokens;
  const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;

  let lastError: unknown = null;
  for (let i = 0; i < modelChain.length; i++) {
    const modelId = modelChain[i]!;
    const isLast = i === modelChain.length - 1;
    try {
      return await workersAiChatCompletion({
        modelId,
        messages,
        max_tokens,
        temperature,
        correlationId: options?.correlationId,
      });
    } catch (err) {
      lastError = err;
      if (!shouldTryNextModelInChain(err, isLast)) throw err;
    }
  }
  throw lastError;
}

function extractStreamDelta(chunk: unknown): string {
  if (typeof chunk === "string") return chunk;
  if (!chunk || typeof chunk !== "object") return "";

  const data = chunk as WorkersAiTextResponse & {
    response?: string;
    text?: string;
  };
  if (typeof data.response === "string") return data.response;
  if (typeof data.text === "string") return data.text;

  const choice = (chunk as {
    choices?: Array<{
      delta?: { content?: string; reasoning?: string };
      message?: { content?: string; reasoning?: string };
    }>;
  }).choices?.[0];
  const deltaContent = choice?.delta?.content;
  if (typeof deltaContent === "string" && deltaContent) return deltaContent;

  const messageContent = choice?.message?.content;
  if (typeof messageContent === "string" && messageContent) return messageContent;

  const deltaReasoning = choice?.delta?.reasoning;
  if (typeof deltaReasoning === "string") {
    const fromReasoning = normalizeReasoningFallback(deltaReasoning);
    if (fromReasoning) return fromReasoning;
  }
  const messageReasoning = choice?.message?.reasoning;
  if (typeof messageReasoning === "string") {
    const fromReasoning = normalizeReasoningFallback(messageReasoning);
    if (fromReasoning) return fromReasoning;
  }

  const geminiParts = (
    chunk as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  ).candidates?.[0]?.content?.parts;
  if (geminiParts?.length) {
    return geminiParts.map((p) => p.text ?? "").join("");
  }

  try {
    return extractWorkersAiContent(chunk);
  } catch {
    return "";
  }
}

function isStreamUnsupportedError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes("stream") ||
    msg.includes("unsupported") ||
    isMessagesApiUnsupportedError(error)
  );
}

async function* iterateAiStream(result: unknown): AsyncGenerator<string> {
  if (result == null) return;

  if (typeof result === "string") {
    if (result) yield result;
    return;
  }

  if (result instanceof ReadableStream) {
    const reader = result.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        const jsonStr = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
        try {
          const parsed = JSON.parse(jsonStr) as unknown;
          const delta = extractStreamDelta(parsed);
          if (delta) yield delta;
        } catch {
          if (jsonStr) yield jsonStr;
        }
      }
    }
    if (buffer.trim()) {
      const delta = extractStreamDelta(buffer);
      if (delta) yield delta;
    }
    return;
  }

  if (typeof (result as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function") {
    for await (const chunk of result as AsyncIterable<unknown>) {
      const delta = extractStreamDelta(chunk);
      if (delta) yield delta;
    }
    return;
  }

  const single = extractWorkersAiContent(result);
  if (single) yield single;
}

async function workersAiChatCompletionStream(params: {
  modelId: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  max_tokens: number;
  temperature: number;
  correlationId?: string;
}): Promise<AsyncGenerator<string>> {
  const ai = await getAiBinding();
  if (!ai) {
    const err = new Error(
      "Workers AI binding not available. Add an AI binding named AI in Cloudflare Pages, or run pnpm preview locally."
    );
    Object.assign(err, { status: 503 });
    throw err;
  }

  const input = buildModelRunInput(
    params.modelId,
    params.messages,
    params.max_tokens,
    params.temperature,
    true
  );
  const result = await runAiWithGateway(ai, params.modelId, input, {
    skipCache: true,
    metadata: buildChatGatewayMetadata(params.correlationId),
  });
  return iterateAiStream(result);
}

export interface StreamWorkersAiOptions {
  maxTokens?: number;
  temperature?: number;
  requestHost?: string | null;
  correlationId?: string;
  onToken: (token: string) => void | Promise<void>;
  /** When false, model still runs (and may stream internally) but onToken is not called until the end. */
  emitTokensToClient?: boolean;
}

/** Stream tokens from Workers AI; falls back to buffered completion if streaming unsupported. */
export async function streamWorkersAi(
  prompt: string,
  systemPrompt: string | undefined,
  history: ChatMessage[] | undefined,
  options: StreamWorkersAiOptions
): Promise<string> {
  const tier = resolveWorkersAiModelTier(options.requestHost);
  const limits = getWorkersAiTierLimits(tier);
  const modelChain = resolveProductionChatModelChain(options.requestHost);
  const messages = buildMessages(prompt, systemPrompt, history, limits);
  const max_tokens = options.maxTokens ?? limits.maxOutputTokens;
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  const emitTokens =
    options.emitTokensToClient ?? shouldStreamTokensToClient(options.requestHost);

  let lastError: unknown = null;
  for (let i = 0; i < modelChain.length; i++) {
    const modelId = modelChain[i]!;
    const isLast = i === modelChain.length - 1;
    try {
      const stream = await workersAiChatCompletionStream({
        modelId,
        messages,
        max_tokens,
        temperature,
        correlationId: options.correlationId,
      });
      let full = "";
      for await (const token of stream) {
        full += token;
        if (emitTokens) await options.onToken(token);
      }
      if (!full.trim()) {
        full = await workersAiChatCompletion({
          modelId,
          messages,
          max_tokens,
          temperature,
          correlationId: options.correlationId,
        });
        if (full.trim()) {
          if (emitTokens) await options.onToken(full);
          return full;
        }
        const emptyErr = new Error(`Empty response from model (${modelId})`);
        if (!shouldTryNextModelInChain(emptyErr, isLast)) throw emptyErr;
        lastError = emptyErr;
        continue;
      }
      return full;
    } catch (err) {
      if (isStreamUnsupportedError(err)) {
        const full = await workersAiChatCompletion({
          modelId,
          messages,
          max_tokens,
          temperature,
          correlationId: options.correlationId,
        });
        if (emitTokens) await options.onToken(full);
        return full;
      }
      lastError = err;
      if (!shouldTryNextModelInChain(err, isLast)) throw err;
      continue;
    }
  }
  throw lastError;
}

// --- Agent / function calling ---

export interface WorkersAiToolCall {
  name: string;
  arguments: Record<string, unknown>;
  id?: string;
}

export type AgentChatMessage =
  | {
      role: "system" | "user" | "assistant";
      content: string;
      tool_calls?: WorkersAiToolCall[];
    }
  | { role: "tool"; name: string; content: string; tool_call_id?: string };

/** Models that support Workers AI traditional function calling in this app. */
export function supportsFunctionCalling(modelId: string): boolean {
  if (isGemmaThinkingCapableModel(modelId)) return true;
  if (isGooglePartnerModelId(modelId)) return true;
  return false;
}

export function extractToolCalls(result: unknown): WorkersAiToolCall[] {
  if (!result || typeof result !== "object") return [];
  const r = result as Record<string, unknown>;
  const rawItems: unknown[] = [];

  const topLevel = r.tool_calls ?? r.toolCalls;
  if (Array.isArray(topLevel)) rawItems.push(...topLevel);

  const choiceMessage = (
    r.choices as Array<{ message?: Record<string, unknown> }> | undefined
  )?.[0]?.message;
  if (choiceMessage && typeof choiceMessage === "object") {
    const nested = choiceMessage.tool_calls ?? choiceMessage.toolCalls;
    if (Array.isArray(nested)) rawItems.push(...nested);
  }

  const calls: WorkersAiToolCall[] = [];
  const seen = new Set<string>();
  for (const item of rawItems) {
    const parsed = parseToolCallEntry(item);
    if (!parsed) continue;
    const key = `${parsed.id ?? ""}:${parsed.name}:${JSON.stringify(parsed.arguments)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    calls.push(parsed);
  }
  return calls;
}

function parseToolCallEntry(call: unknown): WorkersAiToolCall | null {
  if (!call || typeof call !== "object") return null;
  const c = call as Record<string, unknown>;
  const id = typeof c.id === "string" ? c.id : undefined;

  const fn = c.function;
  if (fn && typeof fn === "object") {
    const f = fn as Record<string, unknown>;
    const name = typeof f.name === "string" ? f.name : "";
    if (!name) return null;
    let args: unknown = f.arguments ?? f.args;
    if (typeof args === "string") {
      try {
        args = JSON.parse(args) as unknown;
      } catch {
        args = {};
      }
    }
    const argumentsRecord =
      args && typeof args === "object" && !Array.isArray(args)
        ? (args as Record<string, unknown>)
        : {};
    return { name, arguments: argumentsRecord, id };
  }

  const name = typeof c.name === "string" ? c.name : "";
  if (!name) return null;
  let args: unknown = c.arguments ?? c.args;
  if (typeof args === "string") {
    try {
      args = JSON.parse(args) as unknown;
    } catch {
      args = {};
    }
  }
  const argumentsRecord =
    args && typeof args === "object" && !Array.isArray(args)
      ? (args as Record<string, unknown>)
      : {};
  return { name, arguments: argumentsRecord, id };
}

function ensureToolCallIds(calls: WorkersAiToolCall[]): WorkersAiToolCall[] {
  return calls.map((call, index) => ({
    ...call,
    id: call.id ?? `call_${call.name}_${index}`,
  }));
}

function agentMessageToApi(msg: AgentChatMessage, modelId: string): Record<string, unknown> {
  if (msg.role === "tool") {
    if (usesOpenAiFunctionToolFormat(modelId)) {
      return {
        role: "tool",
        tool_call_id: msg.tool_call_id ?? `call_${msg.name}`,
        content: msg.content,
      };
    }
    return { role: "tool", name: msg.name, content: msg.content };
  }
  const out: Record<string, unknown> = { role: msg.role, content: msg.content };
  if (msg.role === "assistant" && msg.tool_calls?.length) {
    if (usesOpenAiFunctionToolFormat(modelId)) {
      out.tool_calls = msg.tool_calls.map((tc, index) => ({
        id: tc.id ?? `call_${tc.name}_${index}`,
        type: "function",
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      }));
    } else {
      out.tool_calls = msg.tool_calls.map((tc) => ({
        name: tc.name,
        arguments: tc.arguments,
      }));
    }
  }
  return out;
}

/** Map agent tool loop messages to Gemini contents (functionCall / functionResponse). */
export function agentMessagesToGeminiContents(
  messages: AgentChatMessage[]
): { role: string; parts: Record<string, unknown>[] }[] {
  const contents: { role: string; parts: Record<string, unknown>[] }[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      contents.push({
        role: "user",
        parts: [{ text: `Instructions:\n${msg.content}` }],
      });
      continue;
    }

    if (msg.role === "user") {
      contents.push({
        role: "user",
        parts: [{ text: msg.content }],
      });
      continue;
    }

    if (msg.role === "assistant") {
      const parts: Record<string, unknown>[] = [];
      if (msg.content.trim()) {
        parts.push({ text: msg.content });
      }
      if (msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          parts.push({
            functionCall: {
              name: tc.name,
              args: tc.arguments,
            },
          });
        }
      }
      if (parts.length > 0) {
        contents.push({ role: "model", parts });
      }
      continue;
    }

    if (msg.role === "tool") {
      let responsePayload: unknown = { output: msg.content };
      try {
        responsePayload = JSON.parse(msg.content) as unknown;
      } catch {
        /* keep text wrapper */
      }
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: msg.name,
              response: responsePayload,
            },
          },
        ],
      });
    }
  }

  return contents;
}

function buildAgentModelRunInput(
  modelId: string,
  messages: AgentChatMessage[],
  tools: FlatToolDefinition[],
  max_tokens: number,
  temperature: number,
  stream = false
): Record<string, unknown> {
  const formattedTools = formatToolsForModel(modelId, tools);

  if (isGooglePartnerModelId(modelId)) {
    const input: Record<string, unknown> = {
      contents: agentMessagesToGeminiContents(messages),
      generationConfig: {
        maxOutputTokens: max_tokens,
        temperature,
      },
    };
    if (formattedTools.length > 0) input.tools = formattedTools;
    if (stream) input.stream = true;
    return input;
  }
  const input: Record<string, unknown> = {
    messages: messages.map((m) => agentMessageToApi(m, modelId)),
    max_tokens,
    temperature,
  };
  if (formattedTools.length > 0) input.tools = formattedTools;
  if (isGemmaThinkingCapableModel(modelId)) {
    input.chat_template_kwargs = { enable_thinking: false, thinking: false };
  }
  if (stream) input.stream = true;
  return input;
}

export const AGENT_SYNTHESIS_NUDGE =
  "Write your complete final answer for the student now based on the conversation and any tool results above. Use tool output as the source of truth for dates and official events. If exact data was not found, say so clearly and still give helpful general UiTM student guidance — never leave the reply empty.";

function appendAgentSynthesisNudge(
  messages: AgentChatMessage[],
  nudge: string
): AgentChatMessage[] {
  if (!nudge.trim()) return messages;
  return [...messages, { role: "user", content: nudge }];
}

async function runAgentCompletionWithOptionalStream(params: {
  ai: Ai;
  modelId: string;
  messages: AgentChatMessage[];
  maxTokens: number;
  temperature: number;
  correlationId?: string;
  onToken?: (token: string) => void | Promise<void>;
  emitTokens?: boolean;
  synthesisNudge?: string;
}): Promise<string> {
  const {
    ai,
    modelId,
    messages,
    maxTokens,
    temperature,
    correlationId,
    onToken,
    emitTokens,
    synthesisNudge = AGENT_SYNTHESIS_NUDGE,
  } = params;
  const synthesisMessages = appendAgentSynthesisNudge(messages, synthesisNudge);

  try {
    const streamInput = buildAgentModelRunInput(
      modelId,
      synthesisMessages,
      [],
      maxTokens,
      temperature,
      true
    );
    const streamResult = await runAiWithGateway(ai, modelId, streamInput, {
      skipCache: false,
      cacheTtl: 120,
      metadata: buildChatGatewayMetadata(correlationId),
    });
    const stream = await iterateAiStream(streamResult);
    let full = "";
    for await (const token of stream) {
      full += token;
      if (emitTokens && onToken) await onToken(token);
    }
    if (full.trim()) return full.trim();
  } catch {
    /* fall through to buffered completion */
  }

  const input = buildAgentModelRunInput(
    modelId,
    synthesisMessages,
    [],
    maxTokens,
    temperature,
    false
  );
  const result = await runAiWithGateway(ai, modelId, input, {
    skipCache: false,
    cacheTtl: 120,
    metadata: buildChatGatewayMetadata(correlationId),
  });
  const full = tryExtractWorkersAiContent(result);
  if (full?.trim()) {
    if (emitTokens && onToken) await onToken(full);
    return full;
  }
  return "";
}

export interface RunWorkersAiAgentParams {
  userMessage: string;
  systemPrompt: string;
  history?: ChatMessage[];
  preloadMessages?: AgentChatMessage[];
  tools: FlatToolDefinition[];
  requestHost?: string | null;
  correlationId?: string;
  maxTokens: number;
  temperature: number;
  maxToolSteps: number;
  executeTool: (name: string, args: Record<string, unknown>) => Promise<string>;
  onToken?: (token: string) => void | Promise<void>;
  emitTokensToClient?: boolean;
}

/** Tool-calling agent loop; uses the first FC-capable model in the host chain. */
export async function runWorkersAiAgent(params: RunWorkersAiAgentParams): Promise<string> {
  const ai = await getAiBinding();
  if (!ai) {
    const err = new Error(
      "Workers AI binding not available. Add an AI binding named AI in Cloudflare Pages, or run pnpm preview locally."
    );
    Object.assign(err, { status: 503 });
    throw err;
  }

  const modelId = resolveProductionChatModelChain(params.requestHost).find((id) =>
    supportsFunctionCalling(id)
  );

  if (!modelId || !supportsFunctionCalling(modelId)) {
    throw new Error("No function-calling model available in the configured chain");
  }

  const tier = resolveWorkersAiTierForModelId(modelId, params.requestHost);
  const limits = getWorkersAiTierLimits(tier);
  const emitTokens =
    params.emitTokensToClient ?? shouldStreamTokensToClient(params.requestHost);

  const workingMessages: AgentChatMessage[] = [
    {
      role: "system",
      content: truncate(params.systemPrompt, limits.maxSystemChars),
    },
  ];

  if (params.history?.length) {
    const recent = params.history.slice(-limits.maxHistoryMessages);
    for (const msg of recent) {
      workingMessages.push({
        role: msg.role,
        content: truncate(msg.content, limits.maxMessageChars),
      });
    }
  }

  if (params.preloadMessages?.length) {
    workingMessages.push(...params.preloadMessages);
  }

  workingMessages.push({
    role: "user",
    content: truncate(params.userMessage, limits.maxUserPromptChars),
  });

  for (let step = 0; step < params.maxToolSteps; step++) {
    const input = buildAgentModelRunInput(
      modelId,
      workingMessages,
      params.tools,
      params.maxTokens,
      params.temperature,
      false
    );
    const result = await runAiWithGateway(ai, modelId, input, {
      skipCache: true,
      metadata: buildChatGatewayMetadata(params.correlationId),
    });
    const toolCalls = ensureToolCallIds(extractToolCalls(result));
    if (toolCalls.length === 0) {
      const content = tryExtractWorkersAiContent(result);
      if (content?.trim()) {
        if (emitTokens && params.onToken) await params.onToken(content);
        return content;
      }
      break;
    }
    workingMessages.push({
      role: "assistant",
      content: "",
      tool_calls: toolCalls,
    });
    const toolResults = await Promise.all(
      toolCalls.map(async (call) => ({
        call,
        content: await params.executeTool(call.name, call.arguments),
      }))
    );
    for (const { call, content } of toolResults) {
      workingMessages.push({
        role: "tool",
        name: call.name,
        tool_call_id: call.id,
        content,
      });
    }
  }

  return runAgentCompletionWithOptionalStream({
    ai,
    modelId,
    messages: workingMessages,
    maxTokens: params.maxTokens,
    temperature: params.temperature,
    correlationId: params.correlationId,
    onToken: params.onToken,
    emitTokens,
  });
}
