import { NextRequest, NextResponse } from "next/server";

export const runtime = 'edge';
import { z } from "zod";
import { askGroq, MODEL_LLAMA, type ChatMessage } from "@/lib/ai";
import systemRules from "@/lib/system-rules.json";
import {
  getActivitiesForSession,
  getDefaultSessionForGroup,
  getGroupFromSession,
  programOptions,
  sessionOptions,
  type Activity,
  type SessionId,
} from "@/lib/data";
import { UITM_GENERAL_INFO } from "@/lib/uitm-info";

// --- Request size & validation limits ---
const MAX_BODY_SIZE_BYTES = 50 * 1024; // 50KB
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_ARRAY_LENGTH = 20;
const MAX_HISTORY_CONTENT_LENGTH = 8000;

const MAX_SELECTED_SESSIONS = 6;
const VALID_SESSION_IDS = new Set(sessionOptions.map((s) => s.id));

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
    msg.includes("network")
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
  // Higher maxTokens for complete long-form responses; avoid mid-sentence cutoffs.
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

  if (isCompareRequested) return { maxTokens: 1800, temperature: 0.15 };
  if (useCalendarPrompt && !asksDetail) return { maxTokens: 1200, temperature: 0.15 };
  if (useCalendarPrompt) return { maxTokens: 1600, temperature: 0.2 };
  return { maxTokens: 1800, temperature: 0.25 };
}

const RETRY_DELAYS_MS = [400, 800, 1600];

async function askGroqWithRetry(
  message: string,
  systemPrompt: string,
  history: ChatMessage[] | undefined,
  options: { maxTokens: number; temperature: number }
): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await askGroq(message, systemPrompt, history, MODEL_LLAMA, options);
    } catch (err) {
      lastError = err;
      if (!isTransientModelError(err) || attempt >= RETRY_DELAYS_MS.length) throw err;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

// --- Input Validation ---
const VALID_PROGRAMS = new Set(programOptions.map((p) => p.value));

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

function getActivityDedupeKey(a: Activity): string {
  return [
    a.name,
    a.startDate,
    a.endDate ?? "",
    a.type,
    a.group ?? "",
    a.programTypes?.length ? a.programTypes.join(",") : (a.programType ?? ""),
    a.semua ? "1" : "0",
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

function filterActivityByProgram(activity: Activity, program: string): boolean {
  if (program === "All" || program === "Foundation/Professional") return true;
  if (activity.semua) return true;
  if (activity.programTypes?.length && activity.programTypes.includes(program)) return true;
  if (activity.programType === program) return true;
  return false;
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
  primaryGroup: "A" | "B"
): SessionId[] {
  if (!selectedSessions || selectedSessions.length === 0) {
    return [getDefaultSessionForGroup(primaryGroup)];
  }
  const valid = selectedSessions.filter(
    (id): id is SessionId => id.length > 0 && VALID_SESSION_IDS.has(id)
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
        line += `\n  Kedah/Kelantan/Terengganu: ${toDateFormat(a.regionalStartDate)}`;
        if (a.regionalEndDate) line += ` to ${toDateFormat(a.regionalEndDate)}`;
      }
      return line;
    })
    .join("\n");
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

/** Context char limits to avoid Groq 413. */
const MAX_PRIMARY_CONTEXT_CHARS = 8_000;
const MAX_SECONDARY_CONTEXT_CHARS = 1_500;
const MAX_COMPARISON_CONTEXT_CHARS = 2_000;

function buildComparisonContext(
  sessionIds: SessionId[],
  program: string,
  group: "A" | "B"
): string {
  if (sessionIds.length < 2) return "";
  const lines: string[] = [
    "USER SELECTED MULTIPLE SESSIONS — Use this to compare dates across sessions when asked:",
  ];
  for (const sid of sessionIds) {
    const sess = sessionOptions.find((s) => s.id === sid);
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
    lines.push(`\n${label}:`);
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

function buildCalendarSystemPrompt(
  programLabel: string,
  primaryGroup: string,
  secondaryGroup: string,
  primaryContext: string,
  secondaryContext: string,
  primaryDesc: string,
  secondaryDesc: string,
  todayFormatted: string,
  quickReference: string,
  comparisonContext?: string,
  forceComparisonTable?: boolean
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

  if (comparisonContext && comparisonContext.length > 0) {
    result += `\n\n=== SESSION COMPARISON (user selected multiple sessions) ===\n${comparisonContext}`;
  }
  if (forceComparisonTable) {
    result +=
      "\n\nCOMPARISON OUTPUT RULE (MANDATORY): For comparison answers across sessions, you MUST present the compared data in a [TABLE]...[/TABLE] block. Include a short intro sentence, then one table with clear columns (for example: Session | Activity | Date/Range | Notes). Do not output comparison results as plain paragraphs or bullet-only lists.";
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
    "semua",
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

    const { message, program, selectedSessions: rawSelectedSessions, history } = parseResult.data;

    const selectedProgram =
      program && VALID_PROGRAMS.has(program) ? program : "All";
    const sanitizedMessage = sanitizeMessage(message);

    const programMeta = programOptions.find((p) => p.value === selectedProgram);
    const programLabel = programMeta?.label || selectedProgram;
    const primaryGroup = (programMeta?.group || "B") as "A" | "B";
    const secondaryGroup = primaryGroup === "A" ? "B" : "A";

    const effectiveSessions = resolveEffectiveSessions(rawSelectedSessions, primaryGroup);

    const todayISO = getTodayISO();
    const todayFormatted = toReadableDate(todayISO);

    let primaryActivities = getActivitiesFromSessions(
      effectiveSessions,
      selectedProgram,
      primaryGroup
    );
    if (primaryActivities.length === 0) {
      primaryActivities =
        primaryGroup === "A"
          ? getActivitiesForSession(getDefaultSessionForGroup("A"))
          : getFilteredGroupBActivities(selectedProgram, [getDefaultSessionForGroup("B")]);
    }
    const secondaryActivities =
      primaryGroup === "A"
        ? getFilteredGroupBActivities(selectedProgram, [getDefaultSessionForGroup("B")])
        : getActivitiesForSession(getDefaultSessionForGroup("A"));

    const primaryContext = formatActivitiesAsContext(primaryActivities);
    const secondaryContext = formatActivitiesAsContext(secondaryActivities);
    const comparisonContext =
      effectiveSessions.length > 1
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
    const quickReference = computeQuickReference(primaryActivities, todayISO);

    const sanitizedHistory: ChatMessage[] = (history ?? [])
      .slice(-2)
      .map((msg) => ({
        role: msg.role,
        content:
          msg.role === "user" ? sanitizeMessage(msg.content) : msg.content,
      }));

    const useCalendarPrompt = isCalendarQuestion(sanitizedMessage);
    const isCompareRequested =
      effectiveSessions.length > 1 && isComparisonQuestion(sanitizedMessage);
    const systemPrompt = useCalendarPrompt
      ? buildCalendarSystemPrompt(
          programLabel,
          primaryGroup,
          secondaryGroup,
          primaryContext,
          secondaryContext,
          primaryDesc,
          secondaryDesc,
          todayFormatted,
          quickReference,
          comparisonContext,
          isCompareRequested
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
    if (cachedReply) return NextResponse.json({ reply: cachedReply });

    const modelBudget = getModelResponseBudget(
      sanitizedMessage,
      useCalendarPrompt,
      isCompareRequested
    );
    const systemPromptWithCompletion =
      systemPrompt +
      "\n\nIMPORTANT: Always complete your response fully. Do not stop mid-sentence or cut off mid-paragraph.";
    const rawReply = await askGroqWithRetry(
      sanitizedMessage,
      systemPromptWithCompletion,
      sanitizedHistory,
      modelBudget
    );

    const reply = cleanAiReply(rawReply);

    setCachedReply(cacheKey, reply);
    return NextResponse.json({ reply });
  } catch (error: unknown) {
    if (error instanceof SyntaxError || (error instanceof Error && error.message?.includes("JSON"))) {
      return jsonError("Invalid JSON in request body", 400);
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    const status = (error as { status?: number })?.status;
    logger.error("Chat API error", { correlationId, errMsg, status });

    if (status === 401 || errMsg.includes("401") || errMsg.includes("Unauthorized")) {
      return jsonError(
        "AI service authentication failed. Please check API key configuration.",
        502
      );
    }
    if (status === 403 || errMsg.includes("403") || errMsg.includes("Forbidden")) {
      return jsonError(
        "AI model access denied. Please try again later or contact support.",
        502
      );
    }
    if (status === 413 || errMsg.includes("413")) {
      return jsonError(
        "Request too large. Try a shorter message or clear chat history.",
        413
      );
    }
    if (errMsg.includes("429") || errMsg.includes("rate")) {
      return jsonError("AI service is busy. Please try again in a moment.", 429);
    }
    if (
      errMsg.includes("503") ||
      errMsg.includes("loading") ||
      errMsg.includes("unavailable")
    ) {
      return jsonError(
        "AI model is loading. Please try again in a few seconds.",
        503
      );
    }
    if (errMsg.includes("timeout") || errMsg.includes("timed out")) {
      return jsonError(
        "Request took too long. Please try again.",
        504
      );
    }

    return jsonError("Failed to get response from AI. Please try again.", 500);
  }
}
