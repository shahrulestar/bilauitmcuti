import type { Activity, ActivityType } from "./data";

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
export function normalizeCalendarApiOrigin(raw: string): string {
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
export function normalizeApiActivity(raw: Record<string, unknown>): Activity {
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
      throw new Error(
        `Calendar API ${res.status}: ${text.slice(0, 200) || res.statusText}`
      );
    }

    return (await res.json()) as unknown;
  }
  throw new Error("Calendar API: rate limited after retries");
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
    typeof o.defaultSession === "string" ? o.defaultSession : "A-20251";
  return { defaultSession, sessionOptions, programOptions };
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

function parseAllSessionsCalendar(
  data: unknown
): Record<string, { activities: Activity[] }> {
  const out: Record<string, { activities: Activity[] }> = {};
  if (!data || typeof data !== "object") return out;
  const o = data as Record<string, unknown>;
  const sessions = o.sessions;
  if (!Array.isArray(sessions)) return out;
  for (const entry of sessions) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const session = e.session as Record<string, unknown> | undefined;
    const id = session && typeof session.id === "string" ? session.id : null;
    if (!id) continue;
    const activities = e.activities;
    if (!Array.isArray(activities)) {
      out[id] = { activities: [] };
      continue;
    }
    out[id] = {
      activities: activities.map((row) =>
        normalizeApiActivity(
          typeof row === "object" && row ? (row as Record<string, unknown>) : {}
        )
      ),
    };
  }
  return out;
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

/**
 * All sessions in a group (merge into store).
 * Group A: GET /api/v1/calendar?group=A&allSessions=true
 * Group B: GET /api/v1/calendar?group=B&allSessions=true&program=All (or specific program).
 */
export async function fetchCalendarAllSessions(params: {
  group: "A" | "B";
  program?: string;
}): Promise<Record<string, { activities: Activity[] }>> {
  const q = new URLSearchParams();
  q.set("group", params.group);
  q.set("allSessions", "true");
  if (params.group === "B" && params.program !== undefined && params.program !== "") {
    q.set("program", params.program);
  }
  const data = await fetchJsonWithRetry(
    buildCalendarRequestUrl("v1/calendar", q)
  );
  return parseAllSessionsCalendar(data);
}

/** Map ProgramValue / route program to calendar API `program` query (Group B). */
export function calendarProgramQueryForRoute(selectedProgram: string): string | undefined {
  if (selectedProgram === "Foundation/Professional") return undefined;
  if (selectedProgram === "All") return "All";
  return selectedProgram;
}
