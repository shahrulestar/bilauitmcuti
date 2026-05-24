/** Target max duration for typing reveal on long replies (ms). */
const MAX_TYPING_DURATION_MS = 8_000;
const MIN_MS_PER_CHAR = 8;
const MAX_MS_PER_CHAR = 28;

export interface RevealReplyWithTypingOptions {
  fullText: string;
  onChunk: (visibleText: string) => void;
  signal?: AbortSignal;
}

function msPerCharForLength(length: number): number {
  if (length <= 0) return MIN_MS_PER_CHAR;
  const budget = Math.min(MAX_TYPING_DURATION_MS, length * MAX_MS_PER_CHAR);
  return Math.max(MIN_MS_PER_CHAR, Math.min(MAX_MS_PER_CHAR, Math.floor(budget / length)));
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const id = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Reveal `fullText` incrementally for a typing effect (after server finished thinking). */
export async function revealReplyWithTyping(
  options: RevealReplyWithTypingOptions
): Promise<void> {
  const { fullText, onChunk, signal } = options;
  if (!fullText) {
    onChunk("");
    return;
  }

  const delay = msPerCharForLength(fullText.length);
  let visible = "";

  for (let i = 0; i < fullText.length; i++) {
    if (signal?.aborted) {
      onChunk(fullText);
      return;
    }
    visible += fullText[i];
    onChunk(visible);
    if (i < fullText.length - 1) {
      try {
        await sleep(delay, signal);
      } catch {
        onChunk(fullText);
        return;
      }
    }
  }
}
