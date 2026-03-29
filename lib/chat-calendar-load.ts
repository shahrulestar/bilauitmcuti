import {
  fetchMetaCached,
  normalizeApiActivity,
  type MetaResponse,
} from "./calendar-api";
import calendarJson from "./calendar.json";
import {
  getSnapshot,
  mergeSessions,
  resetSessionActivitiesCache,
  setMeta,
} from "./calendar-store";
import { getDefaultSessionForGroup, type Activity, type SessionId } from "./data";

interface LocalCalendarFile {
  defaultSession: string;
  sessionOptions: MetaResponse["sessionOptions"];
  programOptions: MetaResponse["programOptions"];
  sessions: Record<string, { activities: Record<string, unknown>[] }>;
}

function readLocalCalendar(): LocalCalendarFile {
  const d = calendarJson as unknown;
  if (!d || typeof d !== "object") {
    return {
      defaultSession: "A-20251",
      sessionOptions: [],
      programOptions: [],
      sessions: {},
    };
  }
  const o = d as Record<string, unknown>;
  const sessionOptions = Array.isArray(o.sessionOptions)
    ? (o.sessionOptions as MetaResponse["sessionOptions"])
    : [];
  const programOptions = Array.isArray(o.programOptions)
    ? (o.programOptions as MetaResponse["programOptions"])
    : [];
  const defaultSession =
    typeof o.defaultSession === "string" ? o.defaultSession : "A-20251";
  const rawSessions =
    o.sessions && typeof o.sessions === "object" && !Array.isArray(o.sessions)
      ? (o.sessions as Record<string, unknown>)
      : {};
  const sessions: LocalCalendarFile["sessions"] = {};
  for (const [k, v] of Object.entries(rawSessions)) {
    if (!v || typeof v !== "object") continue;
    const bucket = v as { activities?: unknown };
    const acts = Array.isArray(bucket.activities)
      ? (bucket.activities as Record<string, unknown>[])
      : [];
    sessions[k] = { activities: acts };
  }
  return { defaultSession, sessionOptions, programOptions, sessions };
}

const localCalendar = readLocalCalendar();

export async function loadMetaIntoStore(): Promise<MetaResponse> {
  const fallback: MetaResponse = {
    defaultSession: localCalendar.defaultSession,
    sessionOptions: localCalendar.sessionOptions,
    programOptions: localCalendar.programOptions,
  };

  let meta: MetaResponse;
  try {
    meta = await fetchMetaCached({ entire: true });
    if (meta.sessionOptions.length === 0) meta = fallback;
    setMeta(meta);
  } catch {
    meta = fallback;
    setMeta(meta);
  }

  resetSessionActivitiesCache();
  return meta;
}

export function validSetsFromMeta(meta: MetaResponse): {
  validSessionIds: Set<string>;
  validPrograms: Set<string>;
} {
  return {
    validSessionIds: new Set(meta.sessionOptions.map((s) => s.id)),
    validPrograms: new Set(meta.programOptions.map((p) => p.value)),
  };
}

function activitiesForSession(sessionId: SessionId): Activity[] {
  const raw = localCalendar.sessions[sessionId]?.activities ?? [];
  return raw.map((row) =>
    normalizeApiActivity(typeof row === "object" && row ? row : {})
  );
}

/**
 * Load activities for chat context from `lib/calendar.json` (no calendar HTTP API).
 */
export async function loadActivitiesIntoStoreForChat(
  _selectedProgram: string,
  primaryGroup: "A" | "B",
  effectiveSessionIds: SessionId[]
): Promise<void> {
  const secondaryGroup = primaryGroup === "A" ? "B" : "A";
  const secondaryDefault = getDefaultSessionForGroup(secondaryGroup);

  const needed = new Set<SessionId>();
  for (const sid of effectiveSessionIds) needed.add(sid);
  needed.add(secondaryDefault);

  const merges: Record<string, { activities: Activity[] }> = {};
  for (const sid of needed) {
    merges[sid] = { activities: activitiesForSession(sid) };
  }
  mergeSessions(merges);
}

/** Ensure session ids are present in the store (from local JSON). */
export async function ensureSessionsInStore(
  sessionIds: SessionId[],
  _selectedProgram: string
): Promise<void> {
  const snap = getSnapshot();
  const toFetch = sessionIds.filter((sid) => {
    const bucket = snap.sessions[sid];
    return !bucket || !Array.isArray(bucket.activities);
  });
  if (toFetch.length === 0) return;

  const merges: Record<string, { activities: Activity[] }> = {};
  for (const sid of toFetch) {
    merges[sid] = { activities: activitiesForSession(sid) };
  }
  mergeSessions(merges);
}
