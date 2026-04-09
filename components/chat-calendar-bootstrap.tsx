"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchMetaCached, type MetaResponse } from "@/lib/calendar-api";
import calendarData from "@/lib/calendar.json";
import { getSnapshot, setMeta } from "@/lib/calendar-store";

function metaFromCalendarJson(): MetaResponse {
  const o = calendarData as Record<string, unknown>;
  return {
    defaultSession:
      typeof o.defaultSession === "string" ? o.defaultSession : "A-20251",
    sessionOptions: Array.isArray(o.sessionOptions)
      ? (o.sessionOptions as MetaResponse["sessionOptions"])
      : [],
    programOptions: Array.isArray(o.programOptions)
      ? (o.programOptions as MetaResponse["programOptions"])
      : [],
  };
}

/**
 * Keeps program/session dropdowns aligned with the homepage: same source as SSR and
 * CalendarDataGate — `/api/v1/meta?all=true` (see `fetchMetaCached({ entire: true })`).
 * Fetches meta when the store is still empty; skips a redundant GET when the catalogue
 * was already hydrated (e.g. from the calendar). Prefetch of `/` and `/list` still runs.
 */
export function ChatCalendarBootstrap() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        if (getSnapshot().sessionOptions.length > 0) {
          /* Catalogue already hydrated (e.g. from homepage) — skip redundant meta GET. */
        } else {
          const meta = await fetchMetaCached({ entire: true });
          if (cancelled) return;
          if (meta.sessionOptions.length > 0) {
            setMeta(meta);
          } else if (getSnapshot().sessionOptions.length === 0) {
            setMeta(metaFromCalendarJson());
          }
        }
      } catch {
        if (cancelled) return;
        if (getSnapshot().sessionOptions.length === 0) {
          setMeta(metaFromCalendarJson());
        }
      }

      if (!cancelled) {
        router.prefetch("/");
        router.prefetch("/list");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
