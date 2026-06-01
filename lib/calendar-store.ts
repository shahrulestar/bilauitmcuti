import type { Activity } from "./data";
import type { ProgramOptionRow, SessionOptionRow } from "./calendar-api";

export interface CalendarSnapshot {
  version: number;
  sessionOptions: SessionOptionRow[];
  programOptions: ProgramOptionRow[];
  defaultSession: string;
  sessions: Record<string, { activities: Activity[] }>;
}

const FALLBACK_DEFAULT_SESSION = "B-20263";

const emptySnapshot: CalendarSnapshot = {
  version: 0,
  sessionOptions: [],
  programOptions: [],
  defaultSession: FALLBACK_DEFAULT_SESSION,
  sessions: {},
};

let snapshot: CalendarSnapshot = { ...emptySnapshot, sessions: {} };

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): CalendarSnapshot {
  return snapshot;
}

export function setMeta(meta: {
  defaultSession: string;
  sessionOptions: SessionOptionRow[];
  programOptions: ProgramOptionRow[];
}): void {
  snapshot = {
    ...snapshot,
    version: snapshot.version + 1,
    defaultSession: meta.defaultSession || FALLBACK_DEFAULT_SESSION,
    sessionOptions: meta.sessionOptions,
    programOptions: meta.programOptions,
  };
  emit();
}

export function mergeSessions(
  partial: Record<string, { activities: Activity[] }>
): void {
  snapshot = {
    ...snapshot,
    version: snapshot.version + 1,
    sessions: { ...snapshot.sessions, ...partial },
  };
  emit();
}

/** Clear cached session activities before loading chat context (avoids stale merges on reused Edge isolates). */
export function resetSessionActivitiesCache(): void {
  snapshot = {
    ...snapshot,
    version: snapshot.version + 1,
    sessions: {},
  };
  emit();
}

/**
 * Replace entire store without notifying subscribers — safe during React render
 * (e.g. useMemo while hydrating from RSC). Call notifyCalendarStoreListeners in useLayoutEffect.
 */
export function assignCalendarStoreSnapshot(next: CalendarSnapshot): void {
  snapshot = {
    version: next.version,
    sessionOptions: [...next.sessionOptions],
    programOptions: [...next.programOptions],
    defaultSession: next.defaultSession || FALLBACK_DEFAULT_SESSION,
    sessions: { ...next.sessions },
  };
}

/** Flush after assignCalendarStoreSnapshot once the current commit has finished. */
export function notifyCalendarStoreListeners(): void {
  emit();
}
