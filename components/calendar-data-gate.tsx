"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CalendarApiError,
  calendarProgramQueryForRoute,
  fetchCalendarSession,
  fetchMetaCached,
  type MetaResponse,
} from "@/lib/calendar-api";
import { resolveSessionsForProgram } from "@/lib/calendar-session-resolve";
import { getSnapshot, mergeSessions, setMeta } from "@/lib/calendar-store";
import type { Activity, SessionId } from "@/lib/data";
import type { ProgramValue } from "@/lib/route-utils";

const SESSION_NOTICE =
  "Sesi dalam pautan tidak sah. Memaparkan sesi semasa.";

function getGroupFromProgram(program: ProgramValue): "A" | "B" {
  return program === "Foundation/Professional" ? "A" : "B";
}

function metaFromSnapshot(snap: ReturnType<typeof getSnapshot>): MetaResponse {
  return {
    defaultSession: snap.defaultSession,
    sessionOptions: snap.sessionOptions,
    programOptions: snap.programOptions,
  };
}

function friendlyFetchError(error: unknown): string {
  if (error instanceof CalendarApiError) {
    if (error.status >= 500) {
      return "Calendar is temporarily unavailable. Please try again.";
    }
    if (error.status === 429) {
      return "Too many requests. Please try again shortly.";
    }
  }
  return "Failed to load calendar.";
}

function sessionHasCachedActivities(
  snap: ReturnType<typeof getSnapshot>,
  sid: SessionId
): boolean {
  if (!Object.prototype.hasOwnProperty.call(snap.sessions, sid)) return false;
  return Array.isArray(snap.sessions[sid]?.activities);
}

/** SSR snapshot is trustworthy for skip only when each target has real activity rows (not a placeholder key). */
function sessionsHaveHydratedActivities(
  snap: ReturnType<typeof getSnapshot>,
  targets: SessionId[]
): boolean {
  if (targets.length === 0) return true;
  return targets.every((sid) => {
    const row = snap.sessions[sid];
    return (
      row != null &&
      Array.isArray(row.activities) &&
      row.activities.length > 0
    );
  });
}

interface CalendarCommittedView {
  program: ProgramValue;
  sessions: SessionId[];
}

const CalendarCommittedViewContext = createContext<CalendarCommittedView | null>(
  null
);

function useCalendarCommittedView(): CalendarCommittedView {
  const v = useContext(CalendarCommittedViewContext);
  if (v == null) {
    throw new Error(
      "Calendar committed view hooks must be used within CalendarDataGate"
    );
  }
  return v;
}

/**
 * Program whose session payload in the store matches this filter (Group B refetches per program).
 * Use for grid/list so we do not render the new program filter against stale API data.
 */
export function useCalendarCommittedProgram(): ProgramValue {
  return useCalendarCommittedView().program;
}

/**
 * Sessions aligned with the store for the committed program (same lag as `useCalendarCommittedProgram`).
 * Keeps Foundation vs Group B switches from pairing the wrong program with the new session ids (empty grid).
 */
export function useCalendarCommittedSessions(): SessionId[] {
  return useCalendarCommittedView().sessions;
}

interface CalendarDataGateProps {
  children: React.ReactNode;
  selectedSessions: SessionId[];
  selectedProgram: ProgramValue;
  /** Malaysia calendar date (YYYY-MM-DD) for default session when ids are invalid. */
  currentDateStr: string;
  /** Sync parent state + cookie when invalid session ids are replaced. */
  onSessionsCorrected?: (program: ProgramValue, sessions: SessionId[]) => void;
  /** When this equals the current load key and the store already has meta + those sessions, skip duplicate RSC fetch. */
  hydratedLoadKey?: string | null;
  /** Program used when SSR built the snapshot; must match `selectedProgram` to skip client refetch. */
  hydratedSnapshotProgram?: ProgramValue | null;
  /** Server hydrate key; when it changes (new RSC payload), reset fetch bookkeeping. */
  serverHydrateKey?: string | null;
}

/**
 * Loads meta + session activities in the background. Always renders children immediately
 * (same shell as with bundled data); store updates re-render grid/list when data arrives.
 */
export function CalendarDataGate({
  children,
  selectedSessions,
  selectedProgram,
  currentDateStr,
  onSessionsCorrected,
  hydratedLoadKey = null,
  hydratedSnapshotProgram = null,
  serverHydrateKey = null,
}: CalendarDataGateProps) {
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [committedProgram, setCommittedProgram] = useState<ProgramValue>(
    () => hydratedSnapshotProgram ?? selectedProgram
  );
  const [committedSessions, setCommittedSessions] = useState<SessionId[]>(() => [
    ...selectedSessions,
  ]);
  const lastFetchedProgramRef = useRef<ProgramValue | undefined>(undefined);
  const prevServerHydrateKeyRef = useRef<string | null>(null);
  const onSessionsCorrectedRef = useRef(onSessionsCorrected);

  useEffect(() => {
    onSessionsCorrectedRef.current = onSessionsCorrected;
  }, [onSessionsCorrected]);

  const loadKey = useMemo(() => {
    const sessionsPart = [...selectedSessions].sort().join(",");
    return `${selectedProgram}|${sessionsPart}`;
  }, [selectedProgram, selectedSessions]);

  useEffect(() => {
    let cancelled = false;

    if (
      serverHydrateKey != null &&
      serverHydrateKey !== prevServerHydrateKeyRef.current
    ) {
      prevServerHydrateKeyRef.current = serverHydrateKey;
      lastFetchedProgramRef.current = undefined;
    }

    void (async () => {
      if (!cancelled) setFetchError(null);
      try {
        const group = getGroupFromProgram(selectedProgram);
        const programQ = calendarProgramQueryForRoute(selectedProgram);
        const inGroupCandidates = selectedSessions.filter((id) =>
          id.startsWith(`${group}-`)
        );

        let s = getSnapshot();

        const hydrationProgramOk =
          hydratedSnapshotProgram != null &&
          hydratedSnapshotProgram === selectedProgram;
        const canTrustHydration =
          lastFetchedProgramRef.current === undefined ||
          lastFetchedProgramRef.current === selectedProgram;

        if (s.sessionOptions.length === 0) {
          const metaResponse = await fetchMetaCached({ entire: true });
          if (cancelled) return;
          setMeta(metaResponse);
        }
        s = getSnapshot();
        if (s.sessionOptions.length === 0) {
          if (!cancelled) setFetchError("Could not load calendar catalogue.");
          return;
        }

        const meta = metaFromSnapshot(s);
        const resolved = resolveSessionsForProgram({
          meta,
          program: selectedProgram,
          candidates: inGroupCandidates,
          dateStr: currentDateStr,
        });
        const targets = resolved.sessions;
        let effectiveSessions = [...targets];

        if (resolved.wasAdjusted) {
          if (!cancelled) setSessionNotice(true);
          onSessionsCorrectedRef.current?.(selectedProgram, effectiveSessions);
        }

        const resolvedLoadKey = `${selectedProgram}|${[...targets].sort().join(",")}`;

        if (
          canTrustHydration &&
          hydrationProgramOk &&
          hydratedLoadKey != null &&
          hydratedLoadKey === resolvedLoadKey &&
          s.sessionOptions.length > 0 &&
          sessionsHaveHydratedActivities(s, targets)
        ) {
          lastFetchedProgramRef.current = selectedProgram;
          if (!cancelled) {
            setCommittedProgram(selectedProgram);
            setCommittedSessions([...effectiveSessions]);
          }
          if (retryNonce > 0 && !cancelled) setRetryNonce(0);
          return;
        }

        if (targets.length === 0) {
          lastFetchedProgramRef.current = selectedProgram;
          if (!cancelled) {
            setCommittedProgram(selectedProgram);
            setCommittedSessions([...effectiveSessions]);
          }
          if (retryNonce > 0 && !cancelled) setRetryNonce(0);
          return;
        }

        const programChanged =
          lastFetchedProgramRef.current !== undefined &&
          lastFetchedProgramRef.current !== selectedProgram;

        let sessionsToFetch: SessionId[];
        if (retryNonce > 0) {
          sessionsToFetch = [...targets];
        } else if (programChanged) {
          sessionsToFetch = [...targets];
        } else {
          sessionsToFetch = targets.filter(
            (sid) => !sessionHasCachedActivities(s, sid)
          );
        }

        if (sessionsToFetch.length === 0) {
          lastFetchedProgramRef.current = selectedProgram;
          if (!cancelled) {
            setCommittedProgram(selectedProgram);
            setCommittedSessions([...effectiveSessions]);
          }
          if (retryNonce > 0 && !cancelled) setRetryNonce(0);
          return;
        }

        const merges: Record<string, { activities: Activity[] }> = {};
        let fetchAdjusted = false;

        await Promise.all(
          sessionsToFetch.map(async (sid) => {
            try {
              const acts = await fetchCalendarSession({
                sessionId: sid,
                group,
                program: group === "B" ? (programQ ?? "All") : undefined,
              });
              merges[sid] = { activities: acts };
            } catch (e) {
              if (e instanceof CalendarApiError && e.status === 400) {
                const fallback = resolveSessionsForProgram({
                  meta,
                  program: selectedProgram,
                  candidates: [],
                  dateStr: currentDateStr,
                }).sessions[0]!;
                const acts = await fetchCalendarSession({
                  sessionId: fallback,
                  group,
                  program: group === "B" ? (programQ ?? "All") : undefined,
                });
                merges[fallback] = { activities: acts };
                const idx = effectiveSessions.indexOf(sid);
                if (idx >= 0) {
                  effectiveSessions[idx] = fallback;
                } else {
                  effectiveSessions = [fallback];
                }
                fetchAdjusted = true;
                if (!cancelled) setSessionNotice(true);
                return;
              }
              throw e;
            }
          })
        );

        if (fetchAdjusted) {
          onSessionsCorrectedRef.current?.(selectedProgram, effectiveSessions);
        }

        if (cancelled) return;
        mergeSessions(merges);
        lastFetchedProgramRef.current = selectedProgram;
        setCommittedProgram(selectedProgram);
        setCommittedSessions([...effectiveSessions]);
        if (retryNonce > 0 && !cancelled) setRetryNonce(0);
      } catch (e) {
        if (cancelled) return;
        setFetchError(friendlyFetchError(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    loadKey,
    retryNonce,
    hydratedLoadKey,
    hydratedSnapshotProgram,
    serverHydrateKey,
    currentDateStr,
    selectedProgram,
    selectedSessions,
  ]);

  const committedView = useMemo(
    (): CalendarCommittedView => ({
      program: committedProgram,
      sessions: committedSessions,
    }),
    [committedProgram, committedSessions]
  );

  return (
    <CalendarCommittedViewContext.Provider value={committedView}>
      {sessionNotice ? (
        <div className="mx-auto max-w-[1000px] px-4 pt-4 sm:px-6 lg:px-4">
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
          >
            <span>{SESSION_NOTICE}</span>
            <button
              type="button"
              className="shrink-0 rounded-md border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
              onClick={() => setSessionNotice(false)}
            >
              Tutup
            </button>
          </div>
        </div>
      ) : null}
      {fetchError ? (
        <div className="mx-auto max-w-[1000px] px-4 pt-4 sm:px-6 lg:px-4">
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <span>{fetchError}</span>
            <button
              type="button"
              className="shrink-0 rounded-md border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
              onClick={() => setRetryNonce((n) => n + 1)}
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}
      {children}
    </CalendarCommittedViewContext.Provider>
  );
}
