import type { SessionId } from "@/lib/data";
import { buildCalendarUrlPath } from "@/lib/session-query";

const SITE_ORIGIN = "https://bilauitmcuti.com";

function getPathnameOnly(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

/** Path-only canonical URL (no session query). */
export function getPageCanonicalUrl(): string {
  if (typeof window !== "undefined") {
    const pathname = getPathnameOnly();
    if (pathname === "/") return window.location.origin;
    return `${window.location.origin}${pathname}`;
  }
  return SITE_ORIGIN;
}

/** Current page URL for sharing, including session query when present. */
export function getPageShareUrl(): string {
  if (typeof window !== "undefined") {
    const { origin, pathname, search } = window.location;
    if (pathname === "/" && !search) return origin;
    return `${origin}${pathname}${search}`;
  }
  return SITE_ORIGIN;
}

/** Keep canonical path-only; og:url includes session query for social previews. */
export function syncPageShareUrl(): void {
  if (typeof document === "undefined") return;

  const canonicalUrl = getPageCanonicalUrl();
  const shareUrl = getPageShareUrl();

  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", canonicalUrl);

  let ogUrl = document.querySelector('meta[property="og:url"]');
  if (!ogUrl) {
    ogUrl = document.createElement("meta");
    ogUrl.setAttribute("property", "og:url");
    document.head.appendChild(ogUrl);
  }
  ogUrl.setAttribute("content", shareUrl);
}

export function replaceCalendarHistoryUrl(path: string, sessionIds: SessionId[] = []): void {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", buildCalendarUrlPath(path, sessionIds));
  syncPageShareUrl();
}
