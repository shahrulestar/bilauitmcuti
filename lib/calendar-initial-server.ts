import { parseFiltersFromCookie } from "@/lib/cookie-utils";
import {
  calendarProgramQueryForRoute,
  fetchCalendarSession,
  fetchMetaCached,
} from "@/lib/calendar-api";
import type { CalendarSnapshot } from "@/lib/calendar-store";
import type { Activity, SessionId } from "@/lib/data";
import {
  getProgramFromRoute,
  isProgramValue,
  type ProgramValue,
} from "@/lib/route-utils";

function getGroupFromProgram(program: ProgramValue): "A" | "B" {
  return program === "Foundation/Professional" ? "A" : "B";
}

function getSessionMemoryKey(program: ProgramValue): ProgramValue {
  return getGroupFromProgram(program) === "B" ? "All" : program;
}

function resolveProgramForServer(
  programFromRoute: string,
  filters: ReturnType<typeof parseFiltersFromCookie>
): ProgramValue {
  if (programFromRoute && programFromRoute !== "All") {
    const fromRoute = getProgramFromRoute(programFromRoute);
    if (fromRoute !== "All") return fromRoute;
  }
  const sp = filters.selectedProgram;
  if (sp && isProgramValue(sp)) return sp;
  return "All";
}

/**
 * Mirrors SharedCalendarLayout session resolution using meta only (no activity date ranges).
 */
function resolveInitialSessionIds(
  program: ProgramValue,
  filters: ReturnType<typeof parseFiltersFromCookie>,
  meta: Awaited<ReturnType<typeof fetchMetaCached>>
): SessionId[] {
  const programGroup = getGroupFromProgram(program);
  const sessionMemoryKey = getSessionMemoryKey(program);

  const nextMap: Partial<Record<ProgramValue, SessionId[]>> = {};
  const rawMap = filters.sessionIdsByProgram;
  if (rawMap && typeof rawMap === "object") {
    for (const [key, value] of Object.entries(rawMap)) {
      if (!Array.isArray(value) || value.length === 0) continue;
      const p = key as ProgramValue;
      const g = getGroupFromProgram(p);
      const normalized = value.filter((id) => id.startsWith(`${g}-`));
      if (normalized.length > 0) nextMap[getSessionMemoryKey(p)] = normalized;
    }
  }

  const fromProgram = nextMap[sessionMemoryKey];
  if (fromProgram && fromProgram.length > 0) return fromProgram;

  const candidates =
    filters.sessionIds && filters.sessionIds.length > 0
      ? filters.sessionIds
      : filters.sessionId
        ? [filters.sessionId]
        : [];
  const inGroup = candidates.filter((id) => id.startsWith(`${programGroup}-`));
  if (inGroup.length > 0) return inGroup;

  const opts = meta.sessionOptions.filter((s) => s.group === programGroup);
  if (opts.length === 0) {
    return [programGroup === "A" ? "A-20251" : "B-20263"];
  }
  // Same as getSessionForCurrentDate when every session has no loaded date range: last listed session.
  return [opts[opts.length - 1]!.id];
}

const CALENDAR_HYDRATE_VERSION = 1;

export interface InitialCalendarLoadResult {
  snapshot: CalendarSnapshot | null;
  /** Program used when fetching `snapshot.sessions` (Group B query varies by program). */
  programUsed: ProgramValue | null;
  /** `${program}|${sorted session ids}` — matches client `loadKey` when SSR and client agree. */
  hydrateKey: string | null;
}

function buildHydrateKey(program: ProgramValue, sessionIds: SessionId[]): string {
  return `${program}|${[...sessionIds].sort().join(",")}`;
}

/** Session ids embedded in `hydrateKey` (must match client `selectedSessions` order for loadKey). */
export function parseSessionIdsFromHydrateKey(hydrateKey: string): SessionId[] {
  const pipe = hydrateKey.indexOf("|");
  if (pipe < 0) return [];
  const tail = hydrateKey.slice(pipe + 1);
  if (!tail) return [];
  return tail.split(",").filter(Boolean) as SessionId[];
}

/**
 * Load meta + selected sessions for the calendar shell so the first paint matches cookies/route.
 */
export async function loadInitialCalendarSnapshot(params: {
  programFromRoute: string;
  /** Raw `calendar-filters` cookie value, or null */
  cookieValue: string | null | undefined;
}): Promise<InitialCalendarLoadResult> {
  try {
    const meta = await fetchMetaCached({ entire: true });
    const filters = parseFiltersFromCookie(params.cookieValue, meta.defaultSession);
    const program = resolveProgramForServer(params.programFromRoute, filters);
    const selectedSessions = resolveInitialSessionIds(program, filters, meta);
    const hydrateKey = buildHydrateKey(program, selectedSessions);
    const group = getGroupFromProgram(program);
    const programQ = calendarProgramQueryForRoute(program);
    const targets = selectedSessions.filter((id) => id.startsWith(`${group}-`));
    const baseSnapshot = {
      version: CALENDAR_HYDRATE_VERSION,
      sessionOptions: meta.sessionOptions,
      programOptions: meta.programOptions,
      defaultSession: meta.defaultSession,
      sessions: {} as Record<string, { activities: Activity[] }>,
    };

    if (targets.length === 0) {
      return {
        snapshot: { ...baseSnapshot, sessions: {} },
        programUsed: program,
        hydrateKey,
      };
    }

    const merges: Record<string, { activities: Activity[] }> = {};
    await Promise.all(
      targets.map(async (sid) => {
        const g = sid.startsWith("A-") ? "A" : "B";
        const acts = await fetchCalendarSession({
          sessionId: sid,
          group: g,
          program: g === "B" ? (programQ ?? "All") : undefined,
        });
        merges[sid] = { activities: acts };
      })
    );

    return {
      snapshot: { ...baseSnapshot, sessions: merges },
      programUsed: program,
      hydrateKey,
    };
  } catch {
    return { snapshot: null, programUsed: null, hydrateKey: null };
  }
}
