"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  getFiltersFromCookie,
  setFiltersToCookie,
} from "@/lib/cookie-utils";
import { resolveSessionsForProgram } from "@/lib/calendar-session-resolve";
import { getSnapshot } from "@/lib/calendar-store";
import type { SessionId } from "@/lib/data";
import {
  applySessionIdsToFilters,
  hasSessionQueryParams,
  isHomepageCalendarPath,
  normalizeSessionIdsForProgram,
  parseSessionIdsFromSearchParams,
  resolveProgramForSessionQuery,
} from "@/lib/session-query";
import type { ProgramValue } from "@/lib/route-utils";
import { getRoutePath } from "@/lib/route-utils";

interface SessionQueryConsumerProps {
  onSessionQueryConsumed: (program: ProgramValue, sessionIds: SessionId[]) => void;
}

export function SessionQueryConsumer({
  onSessionQueryConsumed,
}: SessionQueryConsumerProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const consumedKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!hasSessionQueryParams(searchParams)) return;

    const sessionIds = parseSessionIdsFromSearchParams(searchParams);
    if (sessionIds.length === 0) return;

    const consumeKey = `${pathname}?${sessionIds.join("&")}`;
    if (consumedKeyRef.current === consumeKey) return;
    consumedKeyRef.current = consumeKey;

    const existing = getFiltersFromCookie();
    const program = resolveProgramForSessionQuery(
      pathname,
      sessionIds,
      existing.selectedProgram
    );
    const normalized = normalizeSessionIdsForProgram(sessionIds, program);
    if (normalized.length === 0) return;

    let sessionsToApply = normalized;
    const snap = getSnapshot();
    if (snap.sessionOptions.length > 0) {
      const dateStr = new Date().toISOString().slice(0, 10);
      sessionsToApply = resolveSessionsForProgram({
        meta: {
          defaultSession: snap.defaultSession,
          sessionOptions: snap.sessionOptions,
          programOptions: snap.programOptions,
        },
        program,
        candidates: normalized,
        dateStr,
      }).sessions;
    }

    if (sessionsToApply.length === 0) return;

    const merged = applySessionIdsToFilters(existing, sessionsToApply, program);

    setFiltersToCookie(merged);
    try {
      if (merged.sessionIdsByProgram) {
        localStorage.setItem(
          "sessionIdsByProgram",
          JSON.stringify(merged.sessionIdsByProgram)
        );
      }
      localStorage.setItem("selectedProgram", program);
    } catch {
      // Ignore storage errors (private mode / quota).
    }

    onSessionQueryConsumed(program, sessionsToApply);
    if (isHomepageCalendarPath(pathname) && program !== "All") {
      router.replace(getRoutePath(program, pathname === "/list" ? "list" : "grid"), {
        scroll: false,
      });
      return;
    }
    router.replace(pathname, { scroll: false });
  }, [searchParams, pathname, router, onSessionQueryConsumed]);

  return null;
}

