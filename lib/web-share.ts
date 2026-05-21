export function isWebShareSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

function canShareData(data: ShareData): boolean {
  if (!navigator.canShare) return true;
  try {
    return navigator.canShare(data);
  } catch {
    return true;
  }
}

/** Try Web Share API with progressively simpler payloads (desktop + mobile). */
export async function shareViaWebShare(
  payload: ShareData
): Promise<"shared" | "aborted" | "unavailable"> {
  if (!isWebShareSupported()) return "unavailable";

  const url = payload.url ?? "";
  const candidates: ShareData[] = [
    payload,
    { title: payload.title, text: payload.text, url },
    { title: payload.title, url },
    { text: payload.text, url },
    { url },
  ].filter((item, index, list) => {
    const key = JSON.stringify(item);
    return list.findIndex((other) => JSON.stringify(other) === key) === index;
  });

  for (const data of candidates) {
    if (!canShareData(data)) continue;
    try {
      await navigator.share(data);
      return "shared";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "aborted";
    }
  }

  return "unavailable";
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof document === "undefined") return false;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy copy
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/** Native share when available; otherwise copy the link (e.g. desktop Firefox/Safari). */
export async function shareOrCopyLink(
  payload: ShareData
): Promise<"shared" | "copied" | "aborted" | "failed"> {
  const shareResult = await shareViaWebShare(payload);
  if (shareResult === "shared" || shareResult === "aborted") {
    return shareResult;
  }

  const url = payload.url?.trim();
  if (!url) return "failed";

  const copied = await copyTextToClipboard(url);
  return copied ? "copied" : "failed";
}
