import type { FilterStates } from "@/lib/cookie-utils";
import { type SessionId } from "@/lib/data";
import {
  getGroupFromProgram,
  getSessionMemoryKey,
  normalizeSessionsForGroup,
} from "@/lib/session-memory";
import {
  getProgramFromRoute,
  isProgramValue,
  isValidProgramRoute,
  type ProgramValue,
} from "@/lib/route-utils";

/** Session id format used as query key, e.g. `B-20263`, `A-20251`. */
export const SESSION_ID_QUERY_PATTERN = /^[AB]-\d+$/;

export function isSessionIdQueryKey(key: string): boolean {
  return SESSION_ID_QUERY_PATTERN.test(key);
}

/** Collect session ids from query keys matching `A-20251` / `B-20263`. */
export function parseSessionIdsFromSearchParams(
  searchParams: URLSearchParams
): SessionId[] {
  const seen = new Set<string>();
  const result: SessionId[] = [];
  for (const key of searchParams.keys()) {
    if (!isSessionIdQueryKey(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

export function hasSessionQueryParams(searchParams: URLSearchParams): boolean {
  return parseSessionIdsFromSearchParams(searchParams).length > 0;
}

export function buildCleanCalendarUrl(pathname: string): string {
  return pathname || "/";
}

export function isCalendarPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "/list") return true;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 1) return isValidProgramRoute(segments[0]);
  if (segments.length === 2 && segments[1] === "list") {
    return isValidProgramRoute(segments[0]);
  }
  return false;
}

/** Resolve program from calendar pathname (not query). */
export function resolveProgramFromCalendarPath(pathname: string): ProgramValue {
  const segments = pathname.split("/").filter(Boolean);
  const routeSeg = segments[0] && segments[0] !== "list" ? segments[0] : null;
  if (routeSeg) {
    const fromRoute = getProgramFromRoute(routeSeg);
    if (fromRoute !== "All") return fromRoute;
  }
  return "All";
}

/** Resolve program for session query: path wins; homepage falls back to cookie or All. */
export function resolveProgramForSessionQuery(
  pathname: string,
  _sessionIds: SessionId[],
  existingSelectedProgram?: ProgramValue
): ProgramValue {
  const fromPath = resolveProgramFromCalendarPath(pathname);
  if (fromPath !== "All") return fromPath;

  if (existingSelectedProgram && isProgramValue(existingSelectedProgram)) {
    return existingSelectedProgram;
  }
  return "All";
}

export function normalizeSessionIdsForProgram(
  sessionIds: SessionId[],
  program: ProgramValue
): SessionId[] {
  return normalizeSessionsForGroup(sessionIds, getGroupFromProgram(program));
}

/**
 * Merge session ids from query into existing filter cookie state.
 * If normalized ids are empty for the program group, existing sessions are kept.
 */
export function applySessionIdsToFilters(
  existing: FilterStates,
  sessionIds: SessionId[],
  program: ProgramValue
): FilterStates {
  const targetGroup = getGroupFromProgram(program);
  const sessionMemoryKey = getSessionMemoryKey(program);
  const normalized = normalizeSessionsForGroup(sessionIds, targetGroup);

  if (normalized.length === 0) {
    return { ...existing, selectedProgram: program };
  }

  const nextSessionsByProgram: Partial<Record<ProgramValue, SessionId[]>> = {
    ...(existing.sessionIdsByProgram ?? {}),
    [sessionMemoryKey]: normalized,
  };

  return {
    ...existing,
    sessionId: normalized[0],
    sessionIds: normalized,
    sessionIdsByProgram: nextSessionsByProgram,
    selectedProgram: program,
  };
}
