import { getSessionForCurrentDate } from "@/lib/data";
import type { SessionId } from "@/lib/data";
import type { FilterStates } from "@/lib/cookie-utils";
import { isProgramValue, type ProgramValue } from "@/lib/route-utils";
import {
  getGroupFromProgram,
  getSessionMemoryKey,
  normalizeSessionsForGroup,
} from "@/lib/session-memory";

export type ProgramSessionMap = Partial<Record<ProgramValue, SessionId[]>>;

export function resolveSessionsForProgram(
  program: ProgramValue,
  sessionCandidates: SessionId[],
  sessionsByProgram: ProgramSessionMap,
  dateStr: string
): SessionId[] {
  const group = getGroupFromProgram(program);
  const sessionMemoryKey = getSessionMemoryKey(program);
  const fromCandidates = normalizeSessionsForGroup(sessionCandidates, group);
  if (fromCandidates.length > 0) return fromCandidates;

  const fromProgramMemory = normalizeSessionsForGroup(sessionsByProgram[sessionMemoryKey] ?? [], group);
  if (fromProgramMemory.length > 0) return fromProgramMemory;

  return [getSessionForCurrentDate(group, dateStr)];
}

export function normalizeEntriesFromSessionMap(
  raw: Partial<Record<ProgramValue, SessionId[]>> | null | undefined
): ProgramSessionMap {
  const normalized: ProgramSessionMap = {};
  if (!raw || typeof raw !== "object") return normalized;
  for (const [programKey, sessionIds] of Object.entries(raw)) {
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) continue;
    const program = programKey as ProgramValue;
    const group = getGroupFromProgram(program);
    const inGroup = normalizeSessionsForGroup(sessionIds, group);
    if (inGroup.length > 0) normalized[getSessionMemoryKey(program)] = inGroup;
  }
  return normalized;
}

/** Prefer `calendar-filters` cookie (homepage / SSR), then localStorage. */
export function mergeSessionMapsFromHomepage(
  fromLocal: Partial<Record<ProgramValue, SessionId[]>> | null,
  filters: FilterStates
): ProgramSessionMap {
  const localNorm = normalizeEntriesFromSessionMap(fromLocal);
  const cookieNorm = normalizeEntriesFromSessionMap(filters.sessionIdsByProgram ?? null);
  const merged: ProgramSessionMap = { ...localNorm, ...cookieNorm };

  if (filters.sessionIds && filters.sessionIds.length > 0) {
    const prog =
      filters.selectedProgram && isProgramValue(filters.selectedProgram)
        ? filters.selectedProgram
        : "All";
    const memKey = getSessionMemoryKey(prog);
    const group = getGroupFromProgram(prog);
    const ids = normalizeSessionsForGroup(filters.sessionIds as SessionId[], group);
    if (ids.length > 0 && (!merged[memKey] || merged[memKey]!.length === 0)) {
      merged[memKey] = ids;
    }
  }

  return merged;
}

export function getInitialChatSessions(program: string): SessionId[] {
  const group: "A" | "B" = program === "Foundation/Professional" ? "A" : "B";
  const dateStr =
    typeof window !== "undefined" ? new Date().toISOString().slice(0, 10) : "2026-03-15";
  return [getSessionForCurrentDate(group, dateStr)];
}
