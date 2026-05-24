import { detectUserLanguage, type UserLanguageMode } from "@/lib/chat-language";
import { resolveCalendarContextIntent, type CalendarContextIntent } from "@/lib/chat/calendar-intent";
import {
  detectQuickReferenceIntent,
  tryBuildQuickReferenceReply,
  type QuickReferenceFastPathParams,
} from "@/lib/chat/fast-reference";
import { toComparableDateValue, toDateFormat, toReadableDate } from "@/lib/chat/dates";
import type { Activity } from "@/lib/data";

export interface DeterministicReplyParams extends QuickReferenceFastPathParams {
  activities: Activity[];
  todayISO: string;
}

function groupHeader(
  language: UserLanguageMode,
  primaryGroup: "A" | "B",
  programLabel: string
): string {
  if (language === "malay") {
    return `Kumpulan ${primaryGroup} (${programLabel}):`;
  }
  return `Group ${primaryGroup} (${programLabel}):`;
}

function formatActivityLine(a: Activity, language: UserLanguageMode): string {
  let line = `${a.name}: ${toReadableDate(a.startDate)}`;
  if (a.endDate) {
    line += language === "malay" ? ` hingga ${toReadableDate(a.endDate)}` : ` to ${toReadableDate(a.endDate)}`;
  }
  if (a.regionalStartDate) {
    const regional =
      language === "malay"
        ? `\nKedah, Kelantan, dan Terengganu: ${toDateFormat(a.regionalStartDate)}`
        : `\nKedah, Kelantan, and Terengganu: ${toDateFormat(a.regionalStartDate)}`;
    line += regional;
    if (a.regionalEndDate) {
      line += language === "malay" ? ` hingga ${toDateFormat(a.regionalEndDate)}` : ` to ${toDateFormat(a.regionalEndDate)}`;
    }
  }
  return line;
}

function findNextActivity(
  activities: Activity[],
  todayISO: string,
  predicate: (a: Activity) => boolean
): Activity | undefined {
  const today = toComparableDateValue(todayISO);
  const sorted = [...activities]
    .filter(predicate)
    .sort((a, b) => toComparableDateValue(a.startDate) - toComparableDateValue(b.startDate));
  return sorted.find((a) => toComparableDateValue(a.startDate) > today);
}

function findFirstLectureWeek(activities: Activity[]): Activity | undefined {
  const lectures = activities
    .filter((a) => a.type === "lecture" || /minggu kuliah|lecture week/i.test(a.name))
    .sort((a, b) => toComparableDateValue(a.startDate) - toComparableDateValue(b.startDate));
  return lectures[0];
}

function findLastLectureWeek(activities: Activity[]): Activity | undefined {
  const lectures = activities
    .filter((a) => a.type === "lecture" || /minggu kuliah|lecture week/i.test(a.name))
    .sort((a, b) => toComparableDateValue(b.startDate) - toComparableDateValue(a.startDate));
  return lectures[0];
}

function countLectureWeeks(activities: Activity[]): number {
  const names = new Set(
    activities
      .filter((a) => a.type === "lecture" || /minggu kuliah|lecture week/i.test(a.name))
      .map((a) => a.name.trim().toLowerCase())
  );
  return names.size;
}

function daysUntilInclusive(fromISO: string, targetStart: string): number {
  const from = toComparableDateValue(fromISO);
  const start = toComparableDateValue(targetStart);
  if (start <= from) return 0;
  const msPerDay = 86_400_000;
  return Math.ceil((start - from) / msPerDay);
}

function buildDaysUntilReply(
  params: DeterministicReplyParams,
  language: UserLanguageMode
): string | null {
  const lower = params.message.toLowerCase();
  const header = groupHeader(language, params.primaryGroup, params.programLabel);

  let target: Activity | undefined;
  if (lower.includes("break") || lower.includes("cuti")) {
    target = findNextActivity(params.activities, params.todayISO, (a) => a.type === "break");
  } else if (lower.includes("exam") || lower.includes("peperiksaan")) {
    target = findNextActivity(params.activities, params.todayISO, (a) => a.type === "examination");
  } else {
    target = findNextActivity(params.activities, params.todayISO, () => true);
  }

  if (!target) {
    const none =
      language === "malay"
        ? "Tiada tarikh seterusnya dijumpai dalam kalendar sesi ini."
        : "No upcoming date found in this session calendar.";
    return `${header}\n\n${none}`;
  }

  const days = daysUntilInclusive(params.todayISO, target.startDate);
  const line = formatActivityLine(target, language);
  if (language === "malay") {
    return `${header}\n\n${days} hari lagi sehingga ${line}.`;
  }
  return `${header}\n\n${days} day(s) until ${line}.`;
}

function buildIntentActivityReply(
  params: DeterministicReplyParams,
  language: UserLanguageMode,
  intent: CalendarContextIntent
): string | null {
  const header = groupHeader(language, params.primaryGroup, params.programLabel);
  const lower = params.message.toLowerCase();

  if (intent === "lecture_count") {
    const count = countLectureWeeks(params.activities);
    if (count === 0) return null;
    const body =
      language === "malay"
        ? `Terdapat ${count} minggu kuliah dalam kalendar sesi ini.`
        : `There are ${count} lecture weeks in this session calendar.`;
    return `${header}\n\n${body}`;
  }

  if (intent === "lecture") {
    const wantsLast = lower.includes("last") || lower.includes("akhir") || lower.includes("terakhir");
    const act = wantsLast
      ? findLastLectureWeek(params.activities)
      : findFirstLectureWeek(params.activities);
    if (!act) return null;
    const label =
      language === "malay"
        ? wantsLast
          ? "Minggu kuliah terakhir"
          : "Minggu Kuliah 1"
        : wantsLast
          ? "Last lecture week"
          : "Lecture Week 1";
    return `${header}\n\n${label}: ${formatActivityLine(act, language)}`;
  }

  if (intent === "registration" || intent === "fee") {
    const act = findNextActivity(
      params.activities,
      params.todayISO,
      (a) =>
        a.type === "registration" ||
        /pendaftaran|registration|gt|rpgt|yuran|validation|sahkan/i.test(a.name)
    );
    if (!act) return null;
    const label =
      language === "malay" ? "Tarikh pendaftaran/yuran seterusnya" : "Next registration/fee date";
    return `${header}\n\n${label}: ${formatActivityLine(act, language)}`;
  }

  if (intent === "revision") {
    const act = params.activities.find((a) => /ulangkaji|revision/i.test(a.name));
    if (!act) return null;
    const label = language === "malay" ? "Minggu ulangkaji" : "Revision week";
    return `${header}\n\n${label}: ${formatActivityLine(act, language)}`;
  }

  if (intent === "gugur") {
    const act = params.activities.find((a) => /gugur/i.test(a.name));
    if (!act) return null;
    return `${header}\n\n${formatActivityLine(act, language)}`;
  }

  if (intent === "festive") {
    const act = params.activities.find(
      (a) => a.type === "break" && /raya|aidil|festive/i.test(a.name)
    );
    if (!act) {
      const none =
        language === "malay"
          ? "Tiada cuti perayaan dijumpai dalam kalendar sesi ini."
          : "No festive break found in this session calendar.";
      return `${header}\n\n${none}`;
    }
    return `${header}\n\n${formatActivityLine(act, language)}`;
  }

  if (intent === "exam") {
    const wantsSlip = lower.includes("slip");
    if (wantsSlip) {
      const act = params.activities.find((a) => /slip/i.test(a.name));
      if (!act) return null;
      const label = language === "malay" ? "Slip peperiksaan" : "Examination slip";
      return `${header}\n\n${label}: ${formatActivityLine(act, language)}`;
    }
    const act = findNextActivity(
      params.activities,
      params.todayISO,
      (a) => a.type === "examination"
    );
    if (!act) return null;
    return `${header}\n\n${formatActivityLine(act, language)}`;
  }

  return null;
}

/** Deterministic calendar reply without LLM (quick reference + activity scan). */
export function tryBuildDeterministicReply(params: DeterministicReplyParams): string | null {
  const quick = tryBuildQuickReferenceReply(params);
  if (quick) return quick;

  const intent = resolveCalendarContextIntent(params.message);
  const language = detectUserLanguage(params.message);

  if (intent === "days_until") {
    return buildDaysUntilReply(params, language);
  }

  if (intent !== "all") {
    const intentReply = buildIntentActivityReply(params, language, intent);
    if (intentReply) return intentReply;
  }

  return null;
}
