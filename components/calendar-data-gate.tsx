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
  calendarProgramQueryForRoute,
  fetchCalendarSession,
  fetchMetaCached,
} from "@/lib/calendar-api";
import { getSnapshot, mergeSessions, setMeta } from "@/lib/calendar-store";
import type { Activity, SessionId } from "@/lib/data";
import type { ProgramValue } from "@/lib/route-utils";

function getGroupFromProgram(program: ProgramValue): "A" | "B" {
  return program === "Foundation/Professional" ? "A" : "B";
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
 *
 * Fetch strategy: refetch all selected sessions when `selectedProgram` changes (Group B query
 * differs by program). When only sessions are added, fetch missing ids only. Retry refetches all targets.
 * Do not clear session activities before fetch — clearing caused empty store during the request,
 * wrong month fallbacks in grid and a brief empty list; mergeSessions overwrites when data arrives.
 *
 * Exposes `useCalendarCommittedProgram` + `useCalendarCommittedSessions`: grid/list should use these
 * (not route `selectedProgram` / raw `selectedSessions`) until the store matches that load, avoiding
 * empty cells when switching Group A ↔ Group B or Group B programs.
 */
export function CalendarDataGate({
  children,
  selectedSessions,
  selectedProgram,
  hydratedLoadKey = null,
  hydratedSnapshotProgram = null,
  serverHydrateKey = null,
}: CalendarDataGateProps) {
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [committedProgram, setCommittedProgram] = useState<ProgramValue>(
    () => hydratedSnapshotProgram ?? selectedProgram
  );
  const [committedSessions, setCommittedSessions] = useState<SessionId[]>(() => [
    ...selectedSessions,
  ]);
  const lastFetchedProgramRef = useRef<ProgramValue | undefined>(undefined);
  const prevServerHydrateKeyRef = useRef<string | null>(null);

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
        const targets = selectedSessions.filter((id) => id.startsWith(`${group}-`));

        let s = getSnapshot();

        const hydrationProgramOk =
          hydratedSnapshotProgram != null &&
          hydratedSnapshotProgram === selectedProgram;
        if (
          hydrationProgramOk &&
          hydratedLoadKey != null &&
          hydratedLoadKey === loadKey &&
          s.sessionOptions.length > 0 &&
          sessionsHaveHydratedActivities(s, targets)
        ) {
          lastFetchedProgramRef.current = selectedProgram;
          if (!cancelled) {
            setCommittedProgram(selectedProgram);
            setCommittedSessions([...selectedSessions]);
          }
          if (retryNonce > 0 && !cancelled) setRetryNonce(0);
          return;
        }

        if (s.sessionOptions.length === 0) {
          const meta = await fetchMetaCached({ entire: true });
          if (cancelled) return;
          setMeta(meta);
        }
        s = getSnapshot();
        if (s.sessionOptions.length === 0) {
          if (!cancelled) setFetchError("Could not load calendar catalogue.");
          return;
        }

        if (targets.length === 0) {
          lastFetchedProgramRef.current = selectedProgram;
          if (!cancelled) {
            setCommittedProgram(selectedProgram);
            setCommittedSessions([...selectedSessions]);
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
            setCommittedSessions([...selectedSessions]);
          }
          if (retryNonce > 0 && !cancelled) setRetryNonce(0);
          return;
        }

        const merges: Record<string, { activities: Activity[] }> = {};
        await Promise.all(
          sessionsToFetch.map(async (sid) => {
            const acts = await fetchCalendarSession({
              sessionId: sid,
              group,
              program: group === "B" ? (programQ ?? "All") : undefined,
            });
            merges[sid] = { activities: acts };
          })
        );
        if (cancelled) return;
        mergeSessions(merges);
        lastFetchedProgramRef.current = selectedProgram;
        setCommittedProgram(selectedProgram);
        setCommittedSessions([...selectedSessions]);
        if (retryNonce > 0 && !cancelled) setRetryNonce(0);
      } catch (e) {
        if (cancelled) return;
        setFetchError(e instanceof Error ? e.message : "Failed to load calendar.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadKey encodes program + sessions
  }, [loadKey, retryNonce, hydratedLoadKey, hydratedSnapshotProgram, serverHydrateKey]);

  const committedView = useMemo(
    (): CalendarCommittedView => ({
      program: committedProgram,
      sessions: committedSessions,
    }),
    [committedProgram, committedSessions]
  );

  return (
    <CalendarCommittedViewContext.Provider value={committedView}>
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
