import { NextRequest, NextResponse } from "next/server";

export const runtime = 'edge';
import { z } from "zod";
import {
  askGroq,
  isGroqRateLimitError,
  MAX_TOKENS_LLAMA,
  MODEL_LLAMA,
  MODEL_LLAMA_FALLBACK,
  MODEL_LLAMA_RATE_LIMIT_ESCAPE,
  type ChatMessage,
} from "@/lib/ai";
import systemRules from "@/lib/system-rules.json";
import {
  ensureSessionsInStore,
  loadActivitiesIntoStoreForChat,
  loadMetaIntoStore,
  validSetsFromMeta,
} from "@/lib/chat-calendar-load";
import {
  getActivitiesForSession,
  getDefaultSessionForGroup,
  getGroupFromSession,
  getProgramOptions,
  getSessionOptions,
  type Activity,
  type SessionId,
} from "@/lib/data";
import { UITM_GENERAL_INFO } from "@/lib/uitm-info";
import {
  getClientIpForTurnstile,
  getTurnstileExpectedHostname,
  verifyTurnstileToken,
} from "@/lib/turnstile";

// --- Request size & validation limits ---
const MAX_BODY_SIZE_BYTES = 50 * 1024; // 50KB
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_ARRAY_LENGTH = 20;
const MAX_HISTORY_CONTENT_LENGTH = 8000;

const MAX_SELECTED_SESSIONS = 6;
const CHAT_TURNSTILE_COOKIE = "chat_turnstile_verified";
const CHAT_TURNSTILE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

const chatRequestSchema = z.object({
  message: z.string().min(1, "Message is required").max(MAX_MESSAGE_LENGTH),
  program: z.string().optional(),
  selectedSessions: z
    .array(z.string())
    .max(MAX_SELECTED_SESSIONS)
    .optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(MAX_HISTORY_CONTENT_LENGTH),
      })
    )
    .max(MAX_HISTORY_ARRAY_LENGTH)
    .optional(),
  turnstileToken: z.string().min(1).optional(),
});

// --- Rate Limiter (KV when on Cloudflare, in-memory fallback) ---
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

function generateCorrelationId(): string {
  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// --- Fast response cache for repeated/retry prompts ---
const RESPONSE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const MAX_RESPONSE_CACHE_ITEMS = 120;
const responseCache = new Map<string, { reply: string; expiresAt: number }>();

function getCachedReply(cacheKey: string): string | null {
  const item = responseCache.get(cacheKey);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    return null;
  }
  return item.reply;
}

function setCachedReply(cacheKey: string, reply: string): void {
  const now = Date.now();
  // Remove expired keys first
  for (const [key, value] of responseCache.entries()) {
    if (value.expiresAt <= now) responseCache.delete(key);
  }
  // Keep cache bounded
  if (responseCache.size >= MAX_RESPONSE_CACHE_ITEMS) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(cacheKey, { reply, expiresAt: now + RESPONSE_CACHE_TTL_MS });
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  return String(error).toLowerCase();
}

function isTransientModelError(error: unknown): boolean {
  const msg = normalizeErrorMessage(error);
  return (
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("busy") ||
    msg.includes("loading") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("network") ||
    msg.includes("empty response") ||
    msg.includes("finish_reason")
  );
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function getModelResponseBudget(
  message: string,
  useCalendarPrompt: boolean,
  isCompareRequested: boolean
): { maxTokens: number; temperature: number } {
  const lower = message.toLowerCase();
  const asksDetail =
    lower.includes("explain") ||
    lower.includes("why") ||
    lower.includes("how") ||
    lower.includes("detail") ||
    lower.includes("huraikan") ||
    lower.includes("jelaskan") ||
    lower.includes("full") ||
    lower.includes("complete") ||
    lower.includes("lengkap");

  if (!useCalendarPrompt) {
    return { maxTokens: MAX_TOKENS_LLAMA, temperature: 0.25 };
  }
  if (isCompareRequested) {
    return { maxTokens: MAX_TOKENS_LLAMA, temperature: 0.15 };
  }
  if (asksDetail) {
    return { maxTokens: MAX_TOKENS_LLAMA, temperature: 0.2 };
  }
  if (isSimpleCalendarQuestion(message)) {
    return { maxTokens: 600, temperature: 0.1 };
  }
  return { maxTokens: 1600, temperature: 0.15 };
}

const RETRY_DELAYS_MS = [350];

function isFallbackWorthyError(error: unknown): boolean {
  const msg = normalizeErrorMessage(error);
  if (msg.includes("401") || msg.includes("unauthorized")) return false;
  if (msg.includes("403") || msg.includes("forbidden")) return false;
  if (msg.includes("api key") && msg.includes("invalid")) return false;
  return true;
}

async function askGroqWithRetry(
  message: string,
  systemPrompt: string,
  history: ChatMessage[] | undefined,
  options: { maxTokens: number; temperature: number },
  model: string
): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await askGroq(message, systemPrompt, history, model, options);
    } catch (err) {
      lastError = err;
      if (!isTransientModelError(err) || attempt >= RETRY_DELAYS_MS.length) throw err;
      // Same model stays rate-limited; switch model in askGroqWithPrimaryThenFallback instead of retrying here.
      if (isGroqRateLimitError(err)) throw err;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

async function askGroqWithPrimaryThenFallback(
  message: string,
  systemPrompt: string,
  history: ChatMessage[] | undefined,
  options: { maxTokens: number; temperature: number },
  correlationId: string
): Promise<string> {
  try {
    return await askGroqWithRetry(
      message,
      systemPrompt,
      history,
      options,
      MODEL_LLAMA
    );
  } catch (primaryErr) {
    if (!isFallbackWorthyError(primaryErr)) throw primaryErr;
    const rateLimitedPrimary = isGroqRateLimitError(primaryErr);
    if (rateLimitedPrimary) {
      logger.warn("Chat using rate-limit escape model", {
        correlationId,
        primaryModel: MODEL_LLAMA,
        escapeModel: MODEL_LLAMA_RATE_LIMIT_ESCAPE,
        reason: "primary_rate_limit",
        err:
          primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
      });
      return await askGroqWithRetry(
        message,
        systemPrompt,
        history,
        options,
        MODEL_LLAMA_RATE_LIMIT_ESCAPE
      );
    }
    logger.warn("Chat using fallback model", {
      correlationId,
      primaryModel: MODEL_LLAMA,
      fallbackModel: MODEL_LLAMA_FALLBACK,
      reason: rateLimitedPrimary ? "rate_limit" : "primary_failed",
      err:
        primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
    });
    try {
      return await askGroqWithRetry(
        message,
        systemPrompt,
        history,
        options,
        MODEL_LLAMA_FALLBACK
      );
    } catch (fallbackErr) {
      if (!isFallbackWorthyError(fallbackErr)) throw fallbackErr;
      if (!isGroqRateLimitError(fallbackErr)) throw fallbackErr;
      logger.warn("Chat using rate-limit escape model", {
        correlationId,
        escapeModel: MODEL_LLAMA_RATE_LIMIT_ESCAPE,
        err:
          fallbackErr instanceof Error
            ? fallbackErr.message
            : String(fallbackErr),
      });
      return await askGroqWithRetry(
        message,
        systemPrompt,
        history,
        options,
        MODEL_LLAMA_RATE_LIMIT_ESCAPE
      );
    }
  }
}

// --- Input Validation ---
function sanitizeMessage(message: string): string {
  return message
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, "")
    .replace(/ignore\s+(all\s+)?above\s+instructions/gi, "")
    .replace(/disregard\s+(all\s+)?previous/gi, "")
    .replace(/you\s+are\s+now\s+/gi, "")
    .replace(/new\s+instructions?\s*:/gi, "")
    .replace(/system\s*:/gi, "")
    .replace(/\[INST\]/gi, "")
    .replace(/<\|im_start\|>/gi, "")
    .replace(/<\|im_end\|>/gi, "")
    .trim();
}

const CALENDAR_STRONG_KEYWORDS = [
  "cuti",
  "semester",
  "peperiksaan",
  "exam",
  "tarikh",
  "date",
  "break",
  "kuliah",
  "lecture",
  "pendaftaran",
  "registration",
  "minggu ulangkaji",
  "revision",
  "gugur taraf",
  "group a",
  "group b",
  "kumpulan",
  "jadual",
  "schedule",
  "hari raya",
  "aidil",
  "short semester",
  "intersession classes",
];

const CALENDAR_AMBIGUOUS_KEYWORDS = [
  "class",
  "classes",
  "lectures",
  "yuran",
  "fee",
  "bila",
  "when",
  "mds",
];

const GENERAL_UITM_INFO_KEYWORDS = [
  "kampus",
  "campus",
  "fakulti",
  "faculty",
  "program",
  "course",
  "courses",
  "subjek",
  "subject",
  "subjects",
  "admission",
  "intake",
  "syarat",
  "requirement",
  "requirements",
  "scholarship",
  "biasiswa",
];

const CALENDAR_INTENT_HINTS = [
  "mula",
  "start",
  "akhir",
  "end",
  "next",
  "upcoming",
  "seterusnya",
  "akan datang",
  "lepas ni",
  "current",
  "sekarang",
  "tarikh",
  "date",
  "jadual",
  "schedule",
  "cuti",
  "semester",
  "exam",
  "peperiksaan",
  "registration",
  "pendaftaran",
];

function isCalendarQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  if (CALENDAR_STRONG_KEYWORDS.some((kw) => lower.includes(kw))) return true;

  const hasAmbiguousKeyword = CALENDAR_AMBIGUOUS_KEYWORDS.some((kw) =>
    lower.includes(kw)
  );
  if (!hasAmbiguousKeyword) return false;

  const hasGeneralUitmIntent = GENERAL_UITM_INFO_KEYWORDS.some((kw) =>
    lower.includes(kw)
  );
  if (hasGeneralUitmIntent) return false;

  return CALENDAR_INTENT_HINTS.some((kw) => lower.includes(kw));
}

const COMPARE_KEYWORDS = [
  "compare",
  "comparison",
  "difference",
  "different",
  "vs",
  "versus",
  "bezakan",
  "beza",
  "perbandingan",
  "banding",
];

function isComparisonQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  return COMPARE_KEYWORDS.some((kw) => lower.includes(kw));
}

function isSimpleCalendarQuestion(message: string): boolean {
  const lower = message.toLowerCase().trim();
  const simpleHints = [
    "when",
    "bila",
    "tarikh",
    "date",
    "next",
    "seterusnya",
    "mula",
    "start",
    "end",
    "akhir",
    "cuti",
    "break",
    "exam",
    "peperiksaan",
  ];
  const hasSimpleHint = simpleHints.some((kw) => lower.includes(kw));
  return hasSimpleHint && lower.length <= 120;
}

function getActivityDedupeKey(a: Activity): string {
  return [
    a.name,
    a.startDate,
    a.endDate ?? "",
    a.type,
    a.group ?? "",
    a.programTypes?.length ? a.programTypes.join(",") : (a.programType ?? ""),
    a.allStudents ? "1" : "0",
    a.details ?? "",
    a.duration ?? "",
    a.regionalStartDate ?? "",
    a.regionalEndDate ?? "",
  ].join("|");
}

function dedupeActivities(activities: Activity[]): Activity[] {
  const seen = new Set<string>();
  return activities.filter((a) => {
    const key = getActivityDedupeKey(a);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Align with {@link shouldIncludeActivity} in lib/data.ts: cohort-wide rows have no programType/programTypes.
 */
function filterActivityByProgram(activity: Activity, program: string): boolean {
  if (program === "All" || program === "Foundation/Professional") return true;
  if (activity.allStudents) return true;
  if (activity.general) return true;
  if (activity.programTypes?.length)
    return activity.programTypes.includes(program);
  if (activity.programType) return activity.programType === program;
  return true;
}

function getActivitiesFromSessions(
  sessionIds: SessionId[],
  program: string,
  group: "A" | "B"
): Activity[] {
  const all: Activity[] = [];
  for (const sid of sessionIds) {
    if (getGroupFromSession(sid) !== group) continue;
    const acts = getActivitiesForSession(sid).filter((a) => a.group === group);
    all.push(...acts);
  }
  const deduped = dedupeActivities(all);
  if (group === "B") {
    return deduped.filter((a) => filterActivityByProgram(a, program));
  }
  return deduped;
}

function resolveEffectiveSessions(
  selectedSessions: string[] | undefined,
  primaryGroup: "A" | "B",
  validSessionIds: Set<string>
): SessionId[] {
  if (!selectedSessions || selectedSessions.length === 0) {
    return [getDefaultSessionForGroup(primaryGroup)];
  }
  const valid = selectedSessions.filter(
    (id): id is SessionId => id.length > 0 && validSessionIds.has(id)
  );
  const inGroup = valid.filter((id) => getGroupFromSession(id) === primaryGroup);
  if (inGroup.length === 0) {
    return [getDefaultSessionForGroup(primaryGroup)];
  }
  return inGroup;
}

function getFilteredGroupBActivities(program: string, sessionIds: SessionId[]): Activity[] {
  const activities = getActivitiesFromSessions(sessionIds, program, "B");
  if (activities.length > 0) return activities;
  const fallback = getActivitiesForSession(getDefaultSessionForGroup("B"));
  return fallback.filter((a) => filterActivityByProgram(a, program));
}

// --- Date helpers ---
function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeDateString(dateStr: string): string {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/;
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/;
  const ymdMatch = dateStr.match(ymd);
  if (ymdMatch) return dateStr;
  const dmyMatch = dateStr.match(dmy);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

function toComparableDateValue(dateStr: string): number {
  const normalized = normalizeDateString(dateStr);
  const value = new Date(normalized).getTime();
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

function toDateFormat(dateStr: string): string {
  const normalized = normalizeDateString(dateStr);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return dateStr;
}

function toReadableDate(dateStr: string): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const normalized = normalizeDateString(dateStr);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const day = parseInt(match[3], 10);
    const monthIdx = parseInt(match[2], 10) - 1;
    return `${String(day).padStart(2, "0")} ${months[monthIdx]} ${match[1]}`;
  }
  return dateStr;
}

function formatActivitiesAsContext(activities: Activity[]): string {
  // Sort chronologically by startDate for clearer AI reasoning
  const sorted = [...activities].sort(
    (a, b) => toComparableDateValue(a.startDate) - toComparableDateValue(b.startDate)
  );

  return sorted
    .map((a) => {
      let line = `- ${a.name}: ${toDateFormat(a.startDate)}`;
      if (a.endDate) line += ` to ${toDateFormat(a.endDate)}`;
      if (a.duration) line += ` (${a.duration})`;
      if (a.details) line += ` — ${a.details}`;
      if (a.regionalStartDate) {
        line += `\n  Kedah, Kelantan, and Terengganu (regional dates): ${toDateFormat(a.regionalStartDate)}`;
        if (a.regionalEndDate) line += ` to ${toDateFormat(a.regionalEndDate)}`;
      }
      return line;
    })
    .join("\n");
}

function sessionLabelForContext(sessionId: SessionId): string {
  const sess = getSessionOptions().find((s) => s.id === sessionId);
  const short = sess?.label.replace(/^Group [AB]:\s*/, "") ?? "";
  return short ? `${sessionId} (${short})` : sessionId;
}

/** Activities for one session only (no cross-session dedupe), same filters as getActivitiesFromSessions. */
function getFilteredActivitiesForSession(
  sessionId: SessionId,
  program: string,
  group: "A" | "B"
): Activity[] {
  if (getGroupFromSession(sessionId) !== group) return [];
  let acts = getActivitiesForSession(sessionId).filter((a) => a.group === group);
  if (group === "B") {
    acts = acts.filter((a) => filterActivityByProgram(a, program));
  }
  return dedupeActivities(acts);
}

/** Single merged block for one session; multiple === SESSION === sections when user selected more than one. */
function formatPrimaryCalendarContext(
  sessionIds: SessionId[],
  program: string,
  group: "A" | "B"
): string {
  if (sessionIds.length === 0) return "";
  if (sessionIds.length === 1) {
    const acts = getFilteredActivitiesForSession(sessionIds[0]!, program, group);
    return formatActivitiesAsContext(acts);
  }
  const parts: string[] = [];
  for (const sid of sessionIds) {
    const acts = getFilteredActivitiesForSession(sid, program, group);
    parts.push(`=== SESSION ${sessionLabelForContext(sid)} ===`, formatActivitiesAsContext(acts));
  }
  return parts.join("\n\n");
}

function computeQuickReferenceForSessions(
  sessionIds: SessionId[],
  program: string,
  group: "A" | "B",
  todayISO: string
): string {
  if (sessionIds.length === 0) return "";
  if (sessionIds.length === 1) {
    const acts = getFilteredActivitiesForSession(sessionIds[0]!, program, group);
    return computeQuickReference(acts, todayISO);
  }
  return sessionIds
    .map((sid) => {
      const acts = getFilteredActivitiesForSession(sid, program, group);
      return `[${sessionLabelForContext(sid)}]\n${computeQuickReference(acts, todayISO)}`;
    })
    .join("\n\n");
}

/**
 * Pre-compute context hints so LLaMA doesn't need to compare dates.
 * This gives immediate answers for common "next break / next exam" questions.
 */
function computeQuickReference(activities: Activity[], todayISO: string): string {
  const sorted = [...activities].sort(
    (a, b) => toComparableDateValue(a.startDate) - toComparableDateValue(b.startDate)
  );
  const todayValue = toComparableDateValue(todayISO);

  // Find current activities (happening right now)
  const currentActivities = sorted.filter(
    (a) => {
      const start = toComparableDateValue(a.startDate);
      const end = toComparableDateValue(a.endDate ?? a.startDate);
      return start <= todayValue && end >= todayValue;
    }
  );

  // Find next upcoming break (type=break, starts after today)
  const nextBreak = sorted.find(
    (a) => a.type === "break" && toComparableDateValue(a.startDate) > todayValue
  );

  // Find next upcoming exam
  const nextExam = sorted.find(
    (a) => a.type === "examination" && toComparableDateValue(a.startDate) > todayValue
  );

  // Find semester break (Cuti Semester)
  const semesterBreak = sorted.find(
    (a) => a.name.includes("Cuti Semester") && toComparableDateValue(a.startDate) > todayValue
  );

  const lines: string[] = [];

  if (currentActivities.length > 0) {
    const current = currentActivities
      .map((a) => {
        let s = `${a.name} (${toReadableDate(a.startDate)}`;
        if (a.endDate) s += ` to ${toReadableDate(a.endDate)}`;
        s += `)`;
        return s;
      })
      .join(", ");
    lines.push(`CURRENTLY HAPPENING: ${current}`);
  } else {
    lines.push("CURRENTLY HAPPENING: No active event right now");
  }

  if (nextBreak) {
    let s = `NEXT BREAK: ${nextBreak.name} (${toReadableDate(nextBreak.startDate)}`;
    if (nextBreak.endDate) s += ` to ${toReadableDate(nextBreak.endDate)}`;
    s += `)`;
    if (nextBreak.details) s += ` — ${nextBreak.details}`;
    lines.push(s);
  }

  if (nextExam) {
    let s = `NEXT EXAM: ${nextExam.name} (${toReadableDate(nextExam.startDate)}`;
    if (nextExam.endDate) s += ` to ${toReadableDate(nextExam.endDate)}`;
    s += `)`;
    lines.push(s);
  }

  if (semesterBreak && semesterBreak !== nextBreak) {
    let s = `SEMESTER BREAK: ${semesterBreak.name} (${toReadableDate(semesterBreak.startDate)}`;
    if (semesterBreak.endDate) s += ` to ${toReadableDate(semesterBreak.endDate)}`;
    s += `)`;
    lines.push(s);
  }

  return lines.join("\n");
}

/** Context char limits to avoid Groq 413 and reduce latency. */
const MAX_PRIMARY_CONTEXT_CHARS = 4_500;
const MAX_SECONDARY_CONTEXT_CHARS = 1_800;
const MAX_COMPARISON_CONTEXT_CHARS = 2_000;
/** Calendar prompt: uitm-info.json supplement (system-rules DATA PRIORITY). */
const MAX_CALENDAR_UITM_SUPPLEMENT_CHARS = 2_000;

function isKeyScheduleActivityForReference(a: Activity): boolean {
  return (
    a.type === "registration" ||
    a.type === "lecture" ||
    a.type === "examination" ||
    a.type === "break" ||
    a.name.includes("Ujian Pertengahan") ||
    a.name.includes("Cuti Semester") ||
    a.name.includes("Minggu Ulangkaji") ||
    a.name.includes("Peperiksaan Akhir")
  );
}

/** When reference group has very long JSON-backed lists, keep milestone rows so truncation does not hide breaks/exams. */
function narrowActivitiesForSecondaryReference(activities: Activity[]): Activity[] {
  if (activities.length <= 50) return activities;
  const sorted = [...activities].sort(
    (a, b) => toComparableDateValue(a.startDate) - toComparableDateValue(b.startDate)
  );
  const key = sorted.filter((a) => isKeyScheduleActivityForReference(a));
  const narrowed = key.length > 0 ? key : sorted.slice(0, 60);
  return narrowed.length > 100 ? narrowed.slice(0, 100) : narrowed;
}

function buildComparisonContext(
  sessionIds: SessionId[],
  program: string,
  group: "A" | "B"
): string {
  if (sessionIds.length < 2) return "";
    const lines: string[] = [
    "USER SELECTED MULTIPLE SESSIONS — Use this to compare dates across sessions when asked. Each block is one session (id + label):",
  ];
  for (const sid of sessionIds) {
    const sess = getSessionOptions().find((s) => s.id === sid);
    const label = sess?.label.replace(/^Group [AB]:\s*/, "") ?? sid;
    const activities = getActivitiesFromSessions([sid], program, group);
    const sorted = [...activities].sort(
      (a, b) => toComparableDateValue(a.startDate) - toComparableDateValue(b.startDate)
    );
    const keyEvents = sorted.filter(
      (a) =>
        a.type === "lecture" ||
        a.type === "examination" ||
        a.type === "break" ||
        a.name.includes("Ujian Pertengahan") ||
        a.name.includes("Cuti Semester") ||
        a.name.includes("Minggu Ulangkaji") ||
        a.name.includes("Peperiksaan Akhir")
    );
    lines.push(`\n${sid} — ${label}:`);
    for (const a of keyEvents.slice(0, 12)) {
      const range = a.endDate ? `${toDateFormat(a.startDate)} to ${toDateFormat(a.endDate)}` : toDateFormat(a.startDate);
      lines.push(`  - ${a.name}: ${range}`);
    }
  }
  const out = lines.join("\n");
  return out.length > MAX_COMPARISON_CONTEXT_CHARS
    ? out.slice(0, MAX_COMPARISON_CONTEXT_CHARS) + "\n...[truncated]"
    : out;
}

function buildSessionListContext(
  group: "A" | "B",
  selectedSessionIds: SessionId[]
): string {
  const selected = new Set(selectedSessionIds);
  const sessionsInGroup = getSessionOptions().filter((session) => session.group === group);
  if (sessionsInGroup.length === 0) return "No session options available.";
  return sessionsInGroup
    .map((session) => {
      const label = session.label.replace(/^Group [AB]:\s*/, "");
      const marker = selected.has(session.id) ? " (selected)" : "";
      return `- ${session.id}: ${label}${marker}`;
    })
    .join("\n");
}

function buildCalendarSystemPrompt(
  programLabel: string,
  primaryGroup: string,
  secondaryGroup: string,
  sessionListContext: string,
  primaryContext: string,
  secondaryContext: string,
  primaryDesc: string,
  secondaryDesc: string,
  todayFormatted: string,
  quickReference: string,
  comparisonContext?: string,
  forceComparisonTable?: boolean,
  multipleSessionsSelected?: boolean,
  uitmSupplement?: string,
  selectedSessionCount?: number
): string {
  const truncatedPrimary =
    primaryContext.length > MAX_PRIMARY_CONTEXT_CHARS
      ? primaryContext.slice(0, MAX_PRIMARY_CONTEXT_CHARS) + "\n...[truncated]"
      : primaryContext;
  const truncatedSecondary =
    secondaryContext.length > MAX_SECONDARY_CONTEXT_CHARS
      ? secondaryContext.slice(0, MAX_SECONDARY_CONTEXT_CHARS) + "\n...[truncated]"
      : secondaryContext;

  const rules = systemRules as { calendarPromptCompact: string; calendarPromptTemplate: string };
  const template = rules.calendarPromptCompact;
  let result = template
    .replace(/\{\{programLabel\}\}/g, programLabel)
    .replace(/\{\{primaryGroup\}\}/g, primaryGroup)
    .replace(/\{\{secondaryGroup\}\}/g, secondaryGroup)
    .replace(/\{\{primaryContext\}\}/g, truncatedPrimary)
    .replace(/\{\{secondaryContext\}\}/g, truncatedSecondary)
    .replace(/\{\{primaryDesc\}\}/g, primaryDesc)
    .replace(/\{\{secondaryDesc\}\}/g, secondaryDesc)
    .replace(/\{\{today\}\}/g, todayFormatted)
    .replace(/\{\{quickReference\}\}/g, quickReference);

  result += `\n\n=== SESSION LIST (GROUP ${primaryGroup}) ===\n${sessionListContext}`;

  const n = selectedSessionCount ?? 0;
  result += `\n\n=== SELECTED SESSIONS (USER CHOICE) ===\nRows marked "(selected)" are the user's current session choice(s). Count: ${n}. Unless the user names a different session id explicitly, treat vague wording about semester calendar, sessions, sesi, next/last semester, or Malay equivalents (e.g. kalendar semester, semester depan, semester lepas, sesi seterusnya) as referring to these selected session(s) and the GROUP calendar sections below. With multiple selections, scope or compare answers per session (id + label).`;

  if (comparisonContext && comparisonContext.length > 0) {
    result += `\n\n=== SESSION COMPARISON (user selected multiple sessions) ===\n${comparisonContext}`;
  }
  if (multipleSessionsSelected) {
    result +=
      "\n\nMULTI-SESSION LABELING (MANDATORY): The user selected more than one session in the dropdown. The primary calendar is split into === SESSION sessionId (label) === sections. For every calendar answer, state which session each date or event belongs to—use both the session id and the human-readable label from the SESSION LIST (same format as the section headers). Do not combine dates from different sessions in one sentence without naming each session. For Malay replies, you may write sesi or penggal with the id/label.";
  }
  if (forceComparisonTable) {
    result +=
      "\n\nCOMPARISON OUTPUT RULE (MANDATORY): The user is comparing sessions or timelines. Present results in a [TABLE]...[/TABLE] block. First column MUST identify the session using session id plus label from the SESSION LIST (e.g. B-20263 with its date range). Other columns: Activity/Event, Date or range, Notes if useful. Include a one-line intro, then the table. Do not use comparison-only bullet lists without a table.";
  }
  const uitm =
    uitmSupplement && uitmSupplement.length > 0
      ? uitmSupplement.length > MAX_CALENDAR_UITM_SUPPLEMENT_CHARS
        ? uitmSupplement.slice(0, MAX_CALENDAR_UITM_SUPPLEMENT_CHARS) + "\n...[truncated]"
        : uitmSupplement
      : "";
  if (uitm.length > 0) {
    result +=
      "\n\n=== UITM KNOWLEDGE (SUPPLEMENTARY — from uitm-info.json; use for campuses, faculties, portals, admissions. For dates/schedules prefer GROUP sections and QUICK REFERENCE above.) ===\n" +
      uitm;
  }
  return result;
}

/** Max chars for UiTM info context to avoid Groq 413. */
const MAX_UITM_INFO_CHARS = 5_000;

function buildResearchSystemPrompt(todayFormatted: string): string {
  const rules = systemRules as { researchPrompt: string };
  const truncatedInfo =
    UITM_GENERAL_INFO.length > MAX_UITM_INFO_CHARS
      ? UITM_GENERAL_INFO.slice(0, MAX_UITM_INFO_CHARS) + "\n...[truncated]"
      : UITM_GENERAL_INFO;

  return rules.researchPrompt
    .replace(/\{\{uitmInfo\}\}/g, truncatedInfo)
    .replace(/\{\{today\}\}/g, todayFormatted);
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function cleanAiReply(rawReply: string): string {
  const internalFields = [
    "type",
    "startDate",
    "endDate",
    "programType",
    "programTypes",
    "group",
    "details",
    "duration",
    "allStudents",
    "regionalStartDate",
    "regionalEndDate",
  ].join("|");

  const cleaned = rawReply
    .replace(/\((?:PAST|NOW|UPCOMING)\)\s*/gi, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^[\s]*\*\s/gm, "- ")
    .replace(/#{1,6}\s?/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/~~/g, "")
    // Strip leaked key/value fragments like: | type: lecture
    .replace(new RegExp(`\\|\\s*(?:${internalFields})\\s*:\\s*[^|\\n]+`, "gi"), "")
    // Strip leaked JSON-style key/value fragments like: "type":"lecture"
    .replace(new RegExp(`["'](?:${internalFields})["']\\s*:\\s*["'][^"']+["']`, "gi"), "")
    // Remove trailing commas/semicolons left by removed fragments
    .replace(/[ \t]*[,;][ \t]*(?=\n|$)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
}

export async function POST(request: NextRequest) {
  let correlationId = "unknown";
  let shouldSetVerifiedCookie = false;
  const withVerifiedCookie = (response: NextResponse): NextResponse => {
    if (!shouldSetVerifiedCookie) return response;
    response.cookies.set({
      name: CHAT_TURNSTILE_COOKIE,
      value: "1",
      maxAge: CHAT_TURNSTILE_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
    });
    return response;
  };
  try {
    // Content-Type validation
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return jsonError("Content-Type must be application/json", 415);
    }

    // Request body size limit
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE_BYTES) {
      return jsonError("Request body too large", 413);
    }

    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    correlationId = generateCorrelationId();
    const rateLimit = await checkRateLimit(ip, request);
    if (rateLimit.limited) {
      logger.warn("Rate limited", { correlationId, ip });
      return jsonError(rateLimit.message, 429);
    }

    const rawBody = await request.json();

    // Validate body size after parsing (Content-Length can be spoofed)
    const bodyStr = JSON.stringify(rawBody);
    if (bodyStr.length > MAX_BODY_SIZE_BYTES) {
      return jsonError("Request body too large", 413);
    }

    const parseResult = chatRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      const path = firstError?.path?.join(".") ?? "";
      const message = firstError?.message ?? "";
      let userMsg: string;
      if (path.startsWith("history") || (message.includes("at most") && message.includes("element"))) {
        userMsg = "Chat history too long. Please start a new conversation.";
      } else if (path === "message" && message.includes("at most")) {
        userMsg = "Message is too long. Please shorten your message.";
      } else {
        userMsg = "Invalid request. Please try again.";
      }
      return jsonError(userMsg, 400);
    }

    const { message, program, selectedSessions: rawSelectedSessions, history, turnstileToken } = parseResult.data;
    const isTurnstileRequired = process.env.NODE_ENV === "production";
    const hasVerifiedCookie =
      request.cookies.get(CHAT_TURNSTILE_COOKIE)?.value === "1";

    if (isTurnstileRequired && !hasVerifiedCookie) {
      if (!turnstileToken?.trim()) {
        return jsonError("Please complete verification first.", 403);
      }
      const hostname = request.headers.get("host") ?? "";
      const turnstileResult = await verifyTurnstileToken({
        token: turnstileToken,
        expectedAction: "chat_message",
        expectedHostname: getTurnstileExpectedHostname(hostname),
        remoteip: getClientIpForTurnstile(request),
      });
      if (!turnstileResult.success) {
        return jsonError("Access was blocked. Please refresh and try again.", 403);
      }
      shouldSetVerifiedCookie = true;
    }

    const meta = await loadMetaIntoStore();
    const { validSessionIds, validPrograms } = validSetsFromMeta(meta);

    const selectedProgram =
      program && validPrograms.has(program) ? program : "All";
    const sanitizedMessage = sanitizeMessage(message);

    const programMeta = getProgramOptions().find((p) => p.value === selectedProgram);
    const programLabel = programMeta?.label || selectedProgram;
    const primaryGroup = (programMeta?.group || "B") as "A" | "B";
    const secondaryGroup = primaryGroup === "A" ? "B" : "A";

    const effectiveSessions = resolveEffectiveSessions(
      rawSelectedSessions,
      primaryGroup,
      validSessionIds
    );

    await loadActivitiesIntoStoreForChat(
      selectedProgram,
      primaryGroup,
      effectiveSessions
    );

    const todayISO = getTodayISO();
    const todayFormatted = toReadableDate(todayISO);

    let contextSessionIds: SessionId[] = effectiveSessions;
    let primaryActivities = getActivitiesFromSessions(
      effectiveSessions,
      selectedProgram,
      primaryGroup
    );
    if (primaryActivities.length === 0) {
      const fallbackId =
        primaryGroup === "A"
          ? getDefaultSessionForGroup("A")
          : getDefaultSessionForGroup("B");
      contextSessionIds = [fallbackId];
      await ensureSessionsInStore(contextSessionIds, selectedProgram);
      primaryActivities =
        primaryGroup === "A"
          ? getActivitiesForSession(fallbackId)
          : getFilteredGroupBActivities(selectedProgram, [fallbackId]);
    }
    const secondaryActivitiesRaw =
      primaryGroup === "A"
        ? getFilteredGroupBActivities(selectedProgram, [getDefaultSessionForGroup("B")])
        : getActivitiesForSession(getDefaultSessionForGroup("A"));
    const secondaryActivities = narrowActivitiesForSecondaryReference(secondaryActivitiesRaw);

    const primaryContext = formatPrimaryCalendarContext(
      contextSessionIds,
      selectedProgram,
      primaryGroup
    );
    const secondaryContext = formatActivitiesAsContext(secondaryActivities);
    const sessionListContext = buildSessionListContext(primaryGroup, effectiveSessions);
    const multipleSessionsSelected = effectiveSessions.length > 1;
    const comparisonContext = multipleSessionsSelected
      ? buildComparisonContext(effectiveSessions, selectedProgram, primaryGroup)
      : "";
    const primaryDesc =
      primaryGroup === "A"
        ? "Foundation/Professional - Semester December 2025 to May 2026"
        : "Pre-Diploma, Diploma, Bachelor's Degree, Master's & PhD - Semester March to August 2026";
    const secondaryDesc =
      primaryGroup === "A"
        ? "Pre-Diploma, Diploma, Bachelor's Degree, Master's & PhD - Semester March to August 2026"
        : "Foundation/Professional - Semester December 2025 to May 2026";

    // Pre-compute quick reference for the AI (next break, current activity, etc.)
    const quickReference = computeQuickReferenceForSessions(
      contextSessionIds,
      selectedProgram,
      primaryGroup,
      todayISO
    );

    const sanitizedHistory: ChatMessage[] = (history ?? [])
      .slice(-2)
      .map((msg) => ({
        role: msg.role,
        content:
          msg.role === "user" ? sanitizeMessage(msg.content) : msg.content,
      }));

    const useCalendarPrompt = isCalendarQuestion(sanitizedMessage);
    const isCompareRequested =
      multipleSessionsSelected && isComparisonQuestion(sanitizedMessage);
    const includeUitmSupplement = !useCalendarPrompt || !isSimpleCalendarQuestion(sanitizedMessage);
    const systemPrompt = useCalendarPrompt
      ? buildCalendarSystemPrompt(
          programLabel,
          primaryGroup,
          secondaryGroup,
          sessionListContext,
          primaryContext,
          secondaryContext,
          primaryDesc,
          secondaryDesc,
          todayFormatted,
          quickReference,
          comparisonContext,
          isCompareRequested,
          multipleSessionsSelected,
          includeUitmSupplement ? UITM_GENERAL_INFO : "",
          effectiveSessions.length
        )
      : buildResearchSystemPrompt(todayFormatted);

    const cacheKey = [
      todayISO,
      selectedProgram,
      effectiveSessions.join(","),
      useCalendarPrompt ? "calendar" : "research",
      isCompareRequested ? "compare" : "normal",
      sanitizedMessage,
      JSON.stringify(sanitizedHistory),
    ].join("||");

    const cachedReply = getCachedReply(cacheKey);
    if (cachedReply) return withVerifiedCookie(NextResponse.json({ reply: cachedReply }));

    const modelBudget = getModelResponseBudget(
      sanitizedMessage,
      useCalendarPrompt,
      isCompareRequested
    );
    const systemPromptWithCompletion =
      systemPrompt +
      "\n\nIMPORTANT: Finish every sentence and paragraph completely—never stop mid-thought or mid-list. For simple questions stay concise; for detailed or long questions use enough length to answer fully without truncating.";
    const rawReply = await askGroqWithPrimaryThenFallback(
      sanitizedMessage,
      systemPromptWithCompletion,
      sanitizedHistory,
      modelBudget,
      correlationId
    );

    const reply = cleanAiReply(rawReply);

    setCachedReply(cacheKey, reply);
    return withVerifiedCookie(NextResponse.json({ reply }));
  } catch (error: unknown) {
    if (error instanceof SyntaxError || (error instanceof Error && error.message?.includes("JSON"))) {
      return withVerifiedCookie(jsonError("Invalid JSON in request body", 400));
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    const status = (error as { status?: number })?.status;
    logger.error("Chat API error", { correlationId, errMsg, status });

    if (status === 401 || errMsg.includes("401") || errMsg.includes("Unauthorized")) {
      return withVerifiedCookie(jsonError(
        "AI service authentication failed. Please check API key configuration.",
        502
      ));
    }
    if (status === 403 || errMsg.includes("403") || errMsg.includes("Forbidden")) {
      return withVerifiedCookie(jsonError(
        "AI model access denied. Please try again later or contact support.",
        502
      ));
    }
    if (status === 413 || errMsg.includes("413")) {
      return withVerifiedCookie(jsonError(
        "Request too large. Try a shorter message or clear chat history.",
        413
      ));
    }
    if (errMsg.includes("429") || errMsg.includes("rate")) {
      return withVerifiedCookie(jsonError("AI service is busy. Please try again in a moment.", 429));
    }
    if (
      errMsg.includes("503") ||
      errMsg.includes("loading") ||
      errMsg.includes("unavailable")
    ) {
      return withVerifiedCookie(jsonError(
        "AI model is loading. Please try again in a few seconds.",
        503
      ));
    }
    if (errMsg.includes("timeout") || errMsg.includes("timed out")) {
      return withVerifiedCookie(jsonError(
        "Request took too long. Please try again.",
        504
      ));
    }

    return withVerifiedCookie(jsonError("Failed to get response from AI. Please try again.", 500));
  }
}
