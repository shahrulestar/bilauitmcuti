"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchLectureWeeks } from "@/lib/calendar-api";
import type { ProgramGroup, SessionId } from "@/lib/data";
import { getGroupFromSession } from "@/lib/data";
import {
  buildDateToWeekNumberMap,
  getLectureWeekNumberForDate,
} from "@/lib/lecture-weeks-resolve";
import { useIsStandaloneDisplayMode } from "@/lib/use-standalone-display-mode";

interface CalendarHeaderProps {
  selectedSessions?: SessionId[];
  programGroup: ProgramGroup;
  initialCurrentDate?: string;
}

function getMalaysiaDateParts() {
  const now = new Date();
  const dayShort = new Intl.DateTimeFormat("en-MY", {
    weekday: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(now);
  const dateLabel = new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(now);
  return { dayShort, dateLabel };
}

function getMalaysiaTodayStr(): string {
  if (typeof window === "undefined") return "";
  try {
    const now = new Date();
    const malaysiaTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" })
    );
    const y = malaysiaTime.getFullYear();
    const m = String(malaysiaTime.getMonth() + 1).padStart(2, "0");
    const d = String(malaysiaTime.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  } catch {
    return "";
  }
}

function filterSessionsForGroup(
  sessions: SessionId[],
  group: ProgramGroup
): SessionId[] {
  return sessions.filter((id) => getGroupFromSession(id) === group);
}

const calendarTitleH1Class =
  "font-semibold leading-[2.5rem] tracking-tight text-5xl text-foreground transition-none";
const calendarTitleH1Style = { transition: "none" } as const;
const calendarHeaderBadgeClass =
  "mb-2 text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/50 dark:bg-[#2A2A2A] text-foreground transition-none whitespace-nowrap";
const calendarHeaderBadgeStyle = { transition: "none" } as const;

export function CalendarHeader({
  selectedSessions = [],
  programGroup,
  initialCurrentDate,
}: CalendarHeaderProps) {
  const textColor = "text-foreground";
  const mutedColor = "text-muted-foreground";
  const isStandalonePwa = useIsStandaloneDisplayMode();
  const { dayShort, dateLabel } = useMemo(() => getMalaysiaDateParts(), []);
  const [currentDateStr, setCurrentDateStr] = useState(
    initialCurrentDate ?? ""
  );
  const [lectureWeekByDate, setLectureWeekByDate] = useState<Map<
    string,
    number
  > | null>(null);

  const groupSessionIdsKey = useMemo(() => {
    const ids = filterSessionsForGroup(selectedSessions, programGroup);
    return [...ids].sort().join(",");
  }, [selectedSessions, programGroup]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setCurrentDateStr(getMalaysiaTodayStr());
    sync();
    const interval = setInterval(sync, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!groupSessionIdsKey) {
      setLectureWeekByDate(null);
      return;
    }
    const ids = groupSessionIdsKey.split(",") as SessionId[];
    let cancelled = false;
    Promise.all(
      ids.map((id) => fetchLectureWeeks(id).catch(() => ({ weeks: [] })))
    ).then((responses) => {
      if (cancelled) return;
      const merged = new Map<string, number>();
      for (const res of responses) {
        const m = buildDateToWeekNumberMap(res.weeks);
        m.forEach((weekNum, date) => merged.set(date, weekNum));
      }
      setLectureWeekByDate(merged.size > 0 ? merged : null);
    });
    return () => {
      cancelled = true;
    };
  }, [groupSessionIdsKey]);

  const weekNum = useMemo(() => {
    const dateStr = currentDateStr || initialCurrentDate;
    if (!dateStr || !lectureWeekByDate) return null;
    return getLectureWeekNumberForDate(lectureWeekByDate, dateStr);
  }, [currentDateStr, initialCurrentDate, lectureWeekByDate]);

  const headerBadgeLabel = useMemo(() => {
    if (weekNum != null) return `Week ${weekNum}`;
    const dateStr = currentDateStr || initialCurrentDate;
    if (dateStr) {
      const y = Number.parseInt(dateStr.slice(0, 4), 10);
      if (Number.isFinite(y) && y > 0) return String(y);
    }
    const now = new Date();
    const malaysiaTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" })
    );
    return String(malaysiaTime.getFullYear());
  }, [weekNum, currentDateStr, initialCurrentDate]);

  return (
    <div suppressHydrationWarning className="flex flex-col justify-center items-start gap-[2px] transition-none" style={{ transition: 'none' }}>
      {isStandalonePwa ? (
        <>
          <span
            className={calendarHeaderBadgeClass}
            suppressHydrationWarning
            style={calendarHeaderBadgeStyle}
          >
            {headerBadgeLabel}
          </span>
          <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
            <h1
              className={`shrink-0 ${calendarTitleH1Class}`}
              suppressHydrationWarning
              style={calendarTitleH1Style}
            >
              {dayShort}
            </h1>
            <h1
              className={`min-w-0 ${calendarTitleH1Class}`}
              suppressHydrationWarning
              style={calendarTitleH1Style}
            >
              {dateLabel}
            </h1>
          </div>
        </>
      ) : (
        <>
          <span
            className={calendarHeaderBadgeClass}
            suppressHydrationWarning
            style={calendarHeaderBadgeStyle}
          >
            {headerBadgeLabel}
          </span>
          <h1
            className={`mb-2 ${calendarTitleH1Class}`}
            suppressHydrationWarning
            style={calendarTitleH1Style}
          >
            Bila <span className="text-[#8b5cf6]">UiTM</span> Cuti?
          </h1>
        </>
      )}

      <div className="flex flex-wrap gap-2 justify-start text-sm transition-none" role="list" aria-label="Activity type legend" suppressHydrationWarning style={{ transition: 'none' }}>
        <div className="flex items-center gap-2" role="listitem">
          <div className="h-2 w-2 rounded-full bg-[#d1d5db]" aria-hidden="true" />
          <span className={mutedColor} suppressHydrationWarning>Registration</span>
        </div>
        <div className="flex items-center gap-2" role="listitem">
          <div className="h-2 w-2 rounded-full bg-[#8b5cf6]" aria-hidden="true" />
          <span className={mutedColor} suppressHydrationWarning>Lecture</span>
        </div>
        <div className="flex items-center gap-2" role="listitem">
          <div className="h-2 w-2 rounded-full bg-[#dc2626]" aria-hidden="true" />
          <span className={mutedColor} suppressHydrationWarning>Examination</span>
        </div>
        <div className="flex items-center gap-2" role="listitem">
          <div className="h-2 w-2 rounded-full bg-[#10b981]" aria-hidden="true" />
          <span className={mutedColor} suppressHydrationWarning>Break</span>
        </div>
      </div>
    </div>
  );
}
