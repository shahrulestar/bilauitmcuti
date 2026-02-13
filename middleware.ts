import { NextRequest, NextResponse } from "next/server";

/**
 * Bot patterns to block from accessing chat routes.
 * Blocks search engine crawlers, AI crawlers, HTTP tools, and scrapers.
 */
const BOT_PATTERNS = [
  // Search engine crawlers
  "googlebot",
  "bingbot",
  "yandexbot",
  "baiduspider",
  "duckduckbot",
  // AI crawlers
  "gptbot",
  "chatgpt-user",
  "claudebot",
  "anthropic",
  "ccbot",
  "bytespider",
  // HTTP tools
  "curl",
  "wget",
  "httpie",
  "postman",
  "insomnia",
  // Scrapers / generic
  "scrapy",
  "python-requests",
  "axios",
  "node-fetch",
  "go-http-client",
  // Headless browsers
  "headlesschrome",
  "phantomjs",
];

function isBotUserAgent(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BOT_PATTERNS.some((pattern) => lower.includes(pattern));
}

function hasBrowserHeaders(request: NextRequest): boolean {
  const acceptLanguage = request.headers.get("accept-language");
  const secFetchMode = request.headers.get("sec-fetch-mode");
  const secFetchSite = request.headers.get("sec-fetch-site");
  // Real browsers typically send Accept-Language and Sec-Fetch-* headers
  return !!(acceptLanguage && (secFetchMode || secFetchSite));
}

function isBot(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  if (isBotUserAgent(ua)) return true;
  // Empty or missing UA with no browser headers is suspicious
  if (!ua.trim() && !hasBrowserHeaders(request)) return true;
  return false;
}

export function middleware(request: NextRequest) {
  if (isBot(request)) {
    const pathname = request.nextUrl.pathname;
    if (pathname === "/chat/api" || pathname.startsWith("/chat/api/")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    // /chat page: redirect to homepage
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/chat", "/chat/:path*"],
};
