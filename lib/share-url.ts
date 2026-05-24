const SITE_ORIGIN = "https://bilauitmcuti.com";

/** Current page URL for sharing (no query/hash). Prefers live location over Next pathname. */
export function getPageShareUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${window.location.pathname}`;
  }
  return SITE_ORIGIN;
}

/** Keep canonical + og:url aligned with the address bar (native share reads these). */
export function syncPageShareUrl(): void {
  if (typeof document === "undefined") return;

  const url = getPageShareUrl();

  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", url);

  let ogUrl = document.querySelector('meta[property="og:url"]');
  if (!ogUrl) {
    ogUrl = document.createElement("meta");
    ogUrl.setAttribute("property", "og:url");
    document.head.appendChild(ogUrl);
  }
  ogUrl.setAttribute("content", url);
}

export function replaceCalendarHistoryUrl(path: string): void {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", path);
  syncPageShareUrl();
}
