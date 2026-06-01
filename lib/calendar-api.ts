import type { Activity, ActivityType } from "./data";
import { applyGroupASessionsToMeta } from "./group-a-sessions";

export interface SessionOptionRow {
  id: string;
  label: string;
  group: "A" | "B";
}

export interface ProgramOptionRow {
  label: string;
  value: string;
  group: "A" | "B";
}

export interface MetaResponse {
  defaultSession: string;
  sessionOptions: SessionOptionRow[];
  programOptions: ProgramOptionRow[];
}

const DEFAULT_BASE = "https://api.bilauitmcuti.com";

/** Strip trailing slash and accidental `/api` so we always append `/api/v1/...` once. */
function normalizeCalendarApiOrigin(raw: string): string {
  let u = raw.trim().replace(/\/$/, "");
  if (u.endsWith("/api")) u = u.slice(0, -4);
  return u;
}

/** Upstream origin for server-side fetches (Edge chat, RSC). Matches proxy env order. */
function getCalendarApiBase(): string {
  const raw =
    process.env.CALENDAR_API_BASE?.trim() ||
    process.env.NEXT_PUBLIC_CALENDAR_API_BASE?.trim() ||
    DEFAULT_BASE;
  return normalizeCalendarApiOrigin(raw);
}

/**
 * Browser: same-origin proxy (CSP connect-src). Server/Edge: direct upstream URL.
 */
function buildCalendarRequestUrl(
  apiPath: string,
  searchParams?: URLSearchParams
): string {
  const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";
  if (typeof window !== "undefined") {
    if (apiPath === "v1/meta") return `/api/v1/meta${search}`;
    if (apiPath === "v1/calendar") return `/api/v1/calendar${search}`;
    if (apiPath === "v1/lecture-weeks") return `/api/v1/lecture-weeks${search}`;
    return `/api/calendar-proxy/${apiPath}${search}`;
  }
  return `${getCalendarApiBase()}/api/${apiPath}${search}`;
}

function isActivityType(value: string): value is ActivityType {
  return (
    value === "registration" ||
    value === "lecture" ||
    value === "examination" ||
    value === "break" ||
    value === "other"
  );
}

/** Normalize API activity row to our Activity shape. */
function normalizeApiActivity(raw: Record<string, unknown>): Activity {
  const typeRaw = String(raw.type ?? "other");
  const type: ActivityType = isActivityType(typeRaw) ? typeRaw : "other";
  const group =
    raw.group === "A" || raw.group === "B" ? raw.group : undefined;

  const activity: Activity = {
    name: String(raw.name ?? ""),
    startDate: String(raw.startDate ?? ""),
    type,
  };

  if (group) activity.group = group;
  if (raw.endDate != null) activity.endDate = String(raw.endDate);
  if (raw.details != null) activity.details = String(raw.details);
  if (raw.duration != null) activity.duration = String(raw.duration);
  if (raw.regionalStartDate != null)
    activity.regionalStartDate = String(raw.regionalStartDate);
  if (raw.regionalEndDate != null)
    activity.regionalEndDate = String(raw.regionalEndDate);
  if (raw.programType != null) {
    activity.programType = raw.programType as Activity["programType"];
  }
  if (Array.isArray(raw.programTypes)) {
    activity.programTypes = raw.programTypes.map(String);
  }
  if (typeof raw.allStudents === "boolean") activity.allStudents = raw.allStudents;
  if (typeof raw.general === "boolean") activity.general = raw.general;
  if (Array.isArray(raw.states)) activity.states = raw.states.map(String);
  if (Array.isArray(raw.programs)) activity.programs = raw.programs.map(String);

  return activity;
}

export class CalendarApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CalendarApiError";
    this.status = status;
  }
}

async function fetchJsonWithRetry(url: string): Promise<unknown> {
  let attempt = 0;
  const maxAttempts = 4;
  const isServer = typeof window === "undefined";
  while (attempt < maxAttempts) {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      ...(isServer
        ? { next: { revalidate: 120 } }
        : { cache: "no-store" }),
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After") ?? "2");
      await new Promise((r) => setTimeout(r, Math.min(10, retryAfter) * 1000));
      attempt += 1;
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new CalendarApiError(
        res.status,
        text.slice(0, 200) || res.statusText
      );
    }

    return (await res.json()) as unknown;
  }
  throw new CalendarApiError(429, "rate limited after retries");
}

function asMetaPayload(data: unknown): MetaResponse {
  if (!data || typeof data !== "object") {
    throw new Error("Calendar API meta: invalid JSON");
  }
  const o = data as Record<string, unknown>;
  const sessionOptions = Array.isArray(o.sessionOptions)
    ? (o.sessionOptions as SessionOptionRow[])
    : [];
  const programOptions = Array.isArray(o.programOptions)
    ? (o.programOptions as ProgramOptionRow[])
    : [];
  const defaultSession =
    typeof o.defaultSession === "string" ? o.defaultSession : "B-20263";
  return applyGroupASessionsToMeta({
    defaultSession,
    sessionOptions,
    programOptions,
  });
}

export interface FetchMetaOptions {
  /** When true, requests `/api/v1/meta?all=true` (browser) or upstream equivalent. */
  entire?: boolean;
}

function metaCacheKey(options?: FetchMetaOptions): "default" | "entire" {
  return options?.entire ? "entire" : "default";
}

/** Concurrent callers with the same options share one in-flight request (e.g. React Strict Mode double mount). */
const metaInflight = new Map<
  "default" | "entire",
  Promise<MetaResponse>
>();

/** Full catalogue: both groups’ session and program options. */
export async function fetchMeta(options?: FetchMetaOptions): Promise<MetaResponse> {
  const key = metaCacheKey(options);
  const existing = metaInflight.get(key);
  if (existing) return existing;

  const url = options?.entire
    ? buildCalendarRequestUrl("v1/meta", new URLSearchParams({ all: "true" }))
    : buildCalendarRequestUrl("v1/meta");

  const promise = (async () => {
    try {
      const data = await fetchJsonWithRetry(url);
      return asMetaPayload(data);
    } finally {
      metaInflight.delete(key);
    }
  })();

  metaInflight.set(key, promise);
  return promise;
}

const metaCache = new Map<
  "default" | "entire",
  { meta: MetaResponse; at: number }
>();
const META_CACHE_TTL_MS = 5 * 60 * 1000;

/** Short-lived cache for Edge chat / RSC (reduces duplicate meta calls). Separate entries for full-catalog `entire` option. */
export async function fetchMetaCached(
  options?: FetchMetaOptions
): Promise<MetaResponse> {
  const key = metaCacheKey(options);
  const now = Date.now();
  const hit = metaCache.get(key);
  if (hit && now - hit.at < META_CACHE_TTL_MS) return hit.meta;
  const meta = await fetchMeta(options);
  metaCache.set(key, { meta, at: now });
  return meta;
}

export interface FetchCalendarSessionParams {
  sessionId: string;
  group: "A" | "B";
  /** Group B only; omit for Group A. Use "All" for cohort-wide rows. */
  program?: string;
}

function parseSingleSessionCalendar(data: unknown): Activity[] {
  if (!data || typeof data !== "object") return [];
  const o = data as Record<string, unknown>;
  const activities = o.activities;
  if (!Array.isArray(activities)) return [];
  return activities.map((row) =>
    normalizeApiActivity(typeof row === "object" && row ? (row as Record<string, unknown>) : {})
  );
}

/** Concurrent callers with the same URL share one in-flight request (e.g. Strict Mode). */
const calendarSessionInflight = new Map<string, Promise<Activity[]>>();

let sessionResultCache: Map<string, { activities: Activity[]; at: number }> | null = null;
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000;
const SESSION_CACHE_MAX_KEYS = 48;

function getSessionFromCache(url: string): Activity[] | null {
  if (!sessionResultCache) return null;
  const hit = sessionResultCache.get(url);
  if (!hit) return null;
  if (Date.now() - hit.at >= SESSION_CACHE_TTL_MS) {
    sessionResultCache.delete(url);
    return null;
  }
  return hit.activities;
}

function putSessionInCache(url: string, activities: Activity[]): void {
  if (!sessionResultCache) sessionResultCache = new Map();
  if (sessionResultCache.size >= SESSION_CACHE_MAX_KEYS && !sessionResultCache.has(url)) {
    const first = sessionResultCache.keys().next().value as string | undefined;
    if (first) sessionResultCache.delete(first);
  }
  sessionResultCache.set(url, { activities, at: Date.now() });
}

/**
 * Activities for one session.
 * GET /api/v1/calendar?session=&group=&program=
 */
export async function fetchCalendarSession(
  params: FetchCalendarSessionParams
): Promise<Activity[]> {
  const q = new URLSearchParams();
  q.set("session", params.sessionId);
  q.set("group", params.group);
  if (params.group === "B" && params.program !== undefined && params.program !== "") {
    q.set("program", params.program);
  }
  const url = buildCalendarRequestUrl("v1/calendar", q);

  // Cache session payloads only on the server (SSR / RSC). Client must not reuse a cached
  // response when switching Group B programs: same session id uses different `program=` URLs
  // but wrong skips in CalendarDataGate could pair with stale cache and show empty/wrong rows.
  if (typeof window === "undefined") {
    const cached = getSessionFromCache(url);
    if (cached) return cached;
  }

  const existing = calendarSessionInflight.get(url);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const data = await fetchJsonWithRetry(url);
      const activities = parseSingleSessionCalendar(data);
      if (typeof window === "undefined") putSessionInCache(url, activities);
      return activities;
    } finally {
      calendarSessionInflight.delete(url);
    }
  })();

  calendarSessionInflight.set(url, promise);
  return promise;
}

/** Map ProgramValue / route program to calendar API `program` query (Group B). */
export function calendarProgramQueryForRoute(selectedProgram: string): string | undefined {
  if (selectedProgram === "Foundation/Professional") return undefined;
  if (selectedProgram === "All") return "All";
  return selectedProgram;
}

// ── Lecture weeks ─────────────────────────────────────────────────────────────

interface LectureWeekDay {
  date: string;
  weekday: string;
  label: string;
}

export interface LectureWeek {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  rangeLabel: string;
  days: LectureWeekDay[];
}

export interface LectureWeeksResponse {
  weeks: LectureWeek[];
}

const lectureWeeksInflight = new Map<string, Promise<LectureWeeksResponse>>();

interface LectureWeeksCacheEntry {
  data: LectureWeeksResponse;
  at: number;
}
const lectureWeeksCache = new Map<string, LectureWeeksCacheEntry>();
const LECTURE_WEEKS_TTL_MS = 5 * 60 * 1000;

function parseLectureWeeksResponse(data: unknown): LectureWeeksResponse {
  if (!data || typeof data !== "object") return { weeks: [] };
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.weeks)) return { weeks: [] };
  const weeks: LectureWeek[] = o.weeks.map((w) => {
    const week = w as Record<string, unknown>;
    const days: LectureWeekDay[] = Array.isArray(week.days)
      ? week.days.map((d: unknown) => {
          const day = d as Record<string, unknown>;
          return {
            date: String(day.date ?? ""),
            weekday: String(day.weekday ?? ""),
            label: String(day.label ?? ""),
          };
        })
      : [];
    return {
      weekNumber: Number(week.weekNumber ?? 0),
      weekStart: String(week.weekStart ?? ""),
      weekEnd: String(week.weekEnd ?? ""),
      rangeLabel: String(week.rangeLabel ?? ""),
      days,
    };
  });
  return { weeks };
}

/**
 * Fetches lecture weeks for a session.
 * Browser: same-origin proxy `/api/v1/lecture-weeks`. Server: upstream direct.
 * GET /api/v1/lecture-weeks?session=
 */
export async function fetchLectureWeeks(
  sessionId: string
): Promise<LectureWeeksResponse> {
  const q = new URLSearchParams({ session: sessionId });
  const url = buildCalendarRequestUrl("v1/lecture-weeks", q);

  const now = Date.now();
  const cached = lectureWeeksCache.get(sessionId);
  if (cached && now - cached.at < LECTURE_WEEKS_TTL_MS) return cached.data;

  const existing = lectureWeeksInflight.get(sessionId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const data = await fetchJsonWithRetry(url);
      const result = parseLectureWeeksResponse(data);
      lectureWeeksCache.set(sessionId, { data: result, at: Date.now() });
      return result;
    } finally {
      lectureWeeksInflight.delete(sessionId);
    }
  })();

  lectureWeeksInflight.set(sessionId, promise);
  return promise;
}

// ── Public holidays ───────────────────────────────────────────────────────────

export interface PublicHolidayRow {
  id: string;
  name: string;
  date: string;
  day: string;
  states: string[];
  isSubjectToChange: boolean;
}

export interface PublicHolidaysResponse {
  defaultYear: number;
  year: number;
  total: number;
  holidays: PublicHolidayRow[];
}

const publicHolidaysInflight = new Map<string, Promise<PublicHolidaysResponse>>();
const publicHolidaysCache = new Map<string, { data: PublicHolidaysResponse; at: number }>();
const PUBLIC_HOLIDAYS_TTL_MS = 5 * 60 * 1000;

function parsePublicHolidaysResponse(data: unknown): PublicHolidaysResponse {
  if (!data || typeof data !== "object") {
    return { defaultYear: new Date().getFullYear(), year: new Date().getFullYear(), total: 0, holidays: [] };
  }
  const o = data as Record<string, unknown>;
  const query = (o.query && typeof o.query === "object" ? o.query : {}) as Record<string, unknown>;
  const year =
    typeof query.year === "number"
      ? query.year
      : typeof o.defaultYear === "number"
        ? o.defaultYear
        : new Date().getFullYear();
  const defaultYear = typeof o.defaultYear === "number" ? o.defaultYear : year;
  const holidays: PublicHolidayRow[] = Array.isArray(o.holidays)
    ? o.holidays.map((row) => {
        const h = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
        return {
          id: String(h.id ?? ""),
          name: String(h.name ?? ""),
          date: String(h.date ?? ""),
          day: String(h.day ?? ""),
          states: Array.isArray(h.states) ? h.states.map(String) : [],
          isSubjectToChange: Boolean(h.isSubjectToChange),
        };
      })
    : [];
  const total = typeof o.total === "number" ? o.total : holidays.length;
  return { defaultYear, year, total, holidays };
}

/**
 * Malaysia public holidays (nationwide + state/regional).
 * GET /api/v1/public-holiday?coverage=all
 */
export async function fetchPublicHolidays(
  options?: { coverage?: "all"; year?: number }
): Promise<PublicHolidaysResponse> {
  const q = new URLSearchParams({ coverage: options?.coverage ?? "all" });
  if (options?.year != null) q.set("year", String(options.year));
  const cacheKey = q.toString();
  const url = buildCalendarRequestUrl("v1/public-holiday", q);

  const now = Date.now();
  const cached = publicHolidaysCache.get(cacheKey);
  if (cached && now - cached.at < PUBLIC_HOLIDAYS_TTL_MS) return cached.data;

  const existing = publicHolidaysInflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const data = await fetchJsonWithRetry(url);
      const result = parsePublicHolidaysResponse(data);
      publicHolidaysCache.set(cacheKey, { data: result, at: Date.now() });
      return result;
    } finally {
      publicHolidaysInflight.delete(cacheKey);
    }
  })();

  publicHolidaysInflight.set(cacheKey, promise);
  return promise;
}
