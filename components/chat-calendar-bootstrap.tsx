"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchMeta, type MetaResponse } from "@/lib/calendar-api";
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
 * CalendarDataGate — `/api/v1/meta?entire=true` (see `fetchMeta({ entire: true })`).
 * Refetches on every /chat visit so the catalogue matches even after navigating from other routes.
 */
export function ChatCalendarBootstrap() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const meta = await fetchMeta({ entire: true });
        if (cancelled) return;
        if (meta.sessionOptions.length > 0) {
          setMeta(meta);
        } else if (getSnapshot().sessionOptions.length === 0) {
          setMeta(metaFromCalendarJson());
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
