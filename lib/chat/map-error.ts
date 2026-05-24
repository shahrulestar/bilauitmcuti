export function mapChatError(error: unknown): { message: string; status: number } {
  const errMsg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const status = (error as { status?: number })?.status;

  if (
    status === 503 ||
    errMsg.includes("binding not available") ||
    errMsg.includes("workers ai binding") ||
    errMsg.includes("not configured")
  ) {
    return {
      message:
        "Workers AI is not available. For local dev, restart after `pnpm dev` (loads wrangler.jsonc) or use `pnpm preview`. On Cloudflare Pages, add a Workers AI binding named AI.",
      status: 503,
    };
  }
  if (status === 401 || errMsg.includes("401") || errMsg.includes("unauthorized")) {
    return {
      message:
        "Workers AI is not configured. Add an AI binding named AI in Cloudflare Pages settings.",
      status: 502,
    };
  }
  if (status === 403 || errMsg.includes("403") || errMsg.includes("forbidden")) {
    return {
      message: "AI model access denied. Please try again later or contact support.",
      status: 502,
    };
  }
  if (status === 413 || errMsg.includes("413")) {
    return { message: "Request too large. Try a shorter message or clear chat history.", status: 413 };
  }
  if (
    status === 429 ||
    errMsg.includes("429") ||
    errMsg.includes("rate limit") ||
    errMsg.includes("too many requests")
  ) {
    return { message: "AI service is busy. Please try again in a moment.", status: 429 };
  }
  if (
    status === 503 ||
    errMsg.includes("503") ||
    errMsg.includes("loading") ||
    errMsg.includes("unavailable") ||
    errMsg.includes("temporarily unavailable")
  ) {
    return { message: "AI model is loading. Please try again in a few seconds.", status: 503 };
  }
  if (status === 504 || errMsg.includes("timeout") || errMsg.includes("timed out")) {
    return { message: "Request took too long. Please try again.", status: 504 };
  }
  if (errMsg.includes("empty response")) {
    return {
      message: "The AI model returned an empty reply. Please try again or rephrase your question.",
      status: 502,
    };
  }
  return { message: "Failed to get response from AI. Please try again.", status: 500 };
}

/** @internal */
export const mapChatErrorForTest = mapChatError;
