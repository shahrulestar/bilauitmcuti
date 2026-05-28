import { NextRequest, NextResponse } from "next/server";
import {
  CALENDAR_FILTERS_COOKIE,
  CALENDAR_FILTERS_MAX_AGE,
  parseFiltersFromCookie,
} from "@/lib/cookie-utils";
import {
  applySessionIdsToFilters,
  hasSessionQueryParams,
  isCalendarPath,
  parseSessionIdsFromSearchParams,
  resolveCleanCalendarPath,
  resolveProgramForSessionQuery,
} from "@/lib/session-query";
import { isSocialPreviewCrawler } from "@/lib/social-preview-crawler";

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

function hasPageOrigin(request: NextRequest): boolean {
  const referer = request.headers.get("referer");
  const origin = request.headers.get("origin");
  const base = "bilauitmcuti.com";
  return !!(referer?.includes(base) || origin?.includes(base)); // matches apex and www
}

function isBot(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  if (isBotUserAgent(ua)) return true;
  // Empty or missing UA with no browser headers is suspicious
  if (!ua.trim() && !hasBrowserHeaders(request)) return true;
  return false;
}

function isLikelyRealBrowser(request: NextRequest, pathname: string): boolean {
  if (pathname !== "/chat/api" && !pathname.startsWith("/chat/api/")) return false;
  // POST from our page (Referer/Origin) is strong signal for real chat client
  return request.method === "POST" && hasPageOrigin(request);
}

function handleSessionQueryRedirect(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  if (!isCalendarPath(pathname)) return null;

  const searchParams = request.nextUrl.searchParams;
  if (!hasSessionQueryParams(searchParams)) return null;

  const sessionIds = parseSessionIdsFromSearchParams(searchParams);
  const existingCookie = request.cookies.get(CALENDAR_FILTERS_COOKIE)?.value;
  const existing = parseFiltersFromCookie(existingCookie);
  const program = resolveProgramForSessionQuery(
    pathname,
    sessionIds,
    existing.selectedProgram
  );
  const merged = applySessionIdsToFilters(existing, sessionIds, program);

  const ua = request.headers.get("user-agent") ?? "";
  const preserveQueryForPreview = isSocialPreviewCrawler(ua);

  const response = preserveQueryForPreview
    ? NextResponse.next()
    : NextResponse.redirect(
        new URL(resolveCleanCalendarPath(pathname, program), request.url)
      );

  response.cookies.set(CALENDAR_FILTERS_COOKIE, JSON.stringify(merged), {
    path: "/",
    maxAge: CALENDAR_FILTERS_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isChatApiPath = pathname === "/chat/api" || pathname.startsWith("/chat/api/");

  const sessionRedirect = handleSessionQueryRedirect(request);
  if (sessionRedirect) return sessionRedirect;

  // Allow /chat/api POST from our page (Referer/Origin) to reduce mobile false-positives
  if (isLikelyRealBrowser(request, pathname)) return NextResponse.next();
  if (isBot(request)) {
    if (isChatApiPath) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/list",
    "/:program",
    "/:program/list",
    "/chat",
    "/chat/:path*",
  ],
};
