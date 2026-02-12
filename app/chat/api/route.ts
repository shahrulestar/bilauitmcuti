import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { askGroq, askGroqResearch, type ChatMessage } from "@/lib/ai";
import systemRules from "@/lib/system-rules.json";
import {
  activitiesGroupA,
  activitiesGroupB,
  programOptions,
  type Activity,
} from "@/lib/data";
import { UITM_GENERAL_INFO } from "@/lib/uitm-info";

// --- Request size & validation limits ---
const MAX_BODY_SIZE_BYTES = 50 * 1024; // 50KB
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_ARRAY_LENGTH = 20;
const MAX_HISTORY_CONTENT_LENGTH = 8000;

const chatRequestSchema = z.object({
  message: z.string().min(1, "Message is required").max(MAX_MESSAGE_LENGTH),
  program: z.string().optional(),
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

// --- Rate Limiter (in-memory, IP-based sliding window) ---
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_PER_MIN = 10; // max 10 requests per minute
const RATE_LIMIT_MAX_UNKNOWN_PER_MIN = 2; // stricter per-min limit when IP unknown
const RATE_LIMIT_DAILY_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_MAX_PER_DAY = 30; // max 30 requests per IP per day
const RATE_LIMIT_MAX_UNKNOWN_PER_DAY = 10; // stricter daily limit when IP unknown
const RATE_LIMIT_GLOBAL_MAX_PER_DAY = 500; // max 500 total requests across all users per day

const rateLimitMap = new Map<string, number[]>();
let globalDailyTimestamps: number[] = [];

// Clean up stale entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter((t) => now - t < RATE_LIMIT_DAILY_MS);
    if (valid.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, valid);
    }
  }
  globalDailyTimestamps = globalDailyTimestamps.filter((t) => now - t < RATE_LIMIT_DAILY_MS);
}, 5 * 60 * 1000);

function getRateLimitKey(ip: string, request: NextRequest): string {
  if (ip !== "unknown") return ip;
  // When IP is unknown, use a fingerprint to avoid shared bucket abuse
  const ua = request.headers.get("user-agent") ?? "";
  const lang = request.headers.get("accept-language") ?? "";
  return `unknown:${Buffer.from(ua + lang).toString("base64").slice(0, 32)}`;
}

interface RateLimitResult {
  limited: boolean;
  message: string;
}

function checkRateLimit(ip: string, request: NextRequest): RateLimitResult {
  const now = Date.now();

  // 1. Global daily limit
  const globalValid = globalDailyTimestamps.filter((t) => now - t < RATE_LIMIT_DAILY_MS);
  if (globalValid.length >= RATE_LIMIT_GLOBAL_MAX_PER_DAY) {
    return { limited: true, message: "Service is at capacity for today. Please try again tomorrow." };
  }

  const key = getRateLimitKey(ip, request);
  const isUnknown = ip === "unknown";
  const timestamps = rateLimitMap.get(key) || [];

  // 2. Per-IP daily limit
  const dailyValid = timestamps.filter((t) => now - t < RATE_LIMIT_DAILY_MS);
  const maxDaily = isUnknown ? RATE_LIMIT_MAX_UNKNOWN_PER_DAY : RATE_LIMIT_MAX_PER_DAY;
  if (dailyValid.length >= maxDaily) {
    return { limited: true, message: "Daily limit reached. Please try again tomorrow." };
  }

  // 3. Per-IP per-minute limit
  const minuteValid = dailyValid.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  const maxPerMin = isUnknown ? RATE_LIMIT_MAX_UNKNOWN_PER_MIN : RATE_LIMIT_MAX_PER_MIN;
  if (minuteValid.length >= maxPerMin) {
    return { limited: true, message: "Too many requests. Please wait a moment before trying again." };
  }

  // All checks passed — record this request
  dailyValid.push(now);
  rateLimitMap.set(key, dailyValid);
  globalDailyTimestamps = [...globalValid, now];

  return { limited: false, message: "" };
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

const CALENDAR_KEYWORDS = [
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
  "yuran",
  "fee",
  "gugur taraf",
  "group a",
  "group b",
  "kumpulan",
  "jadual",
  "schedule",
  "bila",
  "when",
  "hari raya",
  "aidil",
  "mds",
];

function isCalendarQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  return CALENDAR_KEYWORDS.some((kw) => lower.includes(kw));
}

function getFilteredGroupBActivities(program: string): Activity[] {
  return activitiesGroupB.filter((activity) => {
    if (program === "All" || program === "Foundation/Professional") return true;
    if (activity.semua) return true;
    if (activity.programType === program) return true;
    return false;
  });
}

function toDateFormat(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return dateStr;
}

function formatActivitiesAsContext(activities: Activity[]): string {
  return activities
    .map((a) => {
      let line = `- ${a.name}: ${toDateFormat(a.startDate)}`;
      if (a.endDate) line += ` to ${toDateFormat(a.endDate)}`;
      if (a.duration) line += ` (${a.duration})`;
      if (a.details) line += ` — ${a.details}`;
      if (a.type) line += ` [${a.type}]`;
      if (a.regionalStartDate) {
        line += `\n  Kedah/Kelantan/Terengganu: ${toDateFormat(a.regionalStartDate)}`;
        if (a.regionalEndDate) line += ` to ${toDateFormat(a.regionalEndDate)}`;
      }
      return line;
    })
    .join("\n");
}

/** Aggressive limits to avoid Groq 413. Use compact template (~900 chars) + data. */
const MAX_PRIMARY_CONTEXT_CHARS = 6_000;
const MAX_SECONDARY_CONTEXT_CHARS = 1_000;

function buildCalendarSystemPrompt(
  programLabel: string,
  primaryGroup: string,
  secondaryGroup: string,
  primaryContext: string,
  secondaryContext: string,
  primaryDesc: string,
  secondaryDesc: string
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
  return template
    .replace(/\{\{programLabel\}\}/g, programLabel)
    .replace(/\{\{primaryGroup\}\}/g, primaryGroup)
    .replace(/\{\{secondaryGroup\}\}/g, secondaryGroup)
    .replace(/\{\{primaryContext\}\}/g, truncatedPrimary)
    .replace(/\{\{secondaryContext\}\}/g, truncatedSecondary)
    .replace(/\{\{primaryDesc\}\}/g, primaryDesc)
    .replace(/\{\{secondaryDesc\}\}/g, secondaryDesc);
}

/** Max chars for UiTM info context to avoid Groq 413. */
const MAX_UITM_INFO_CHARS = 4_000;

function buildResearchSystemPrompt(): string {
  const rules = systemRules as { researchPrompt: string };
  const truncatedInfo =
    UITM_GENERAL_INFO.length > MAX_UITM_INFO_CHARS
      ? UITM_GENERAL_INFO.slice(0, MAX_UITM_INFO_CHARS) + "\n...[truncated]"
      : UITM_GENERAL_INFO;

  return rules.researchPrompt.replace(/\{\{uitmInfo\}\}/g, truncatedInfo);
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
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
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const rateLimit = checkRateLimit(ip, request);
    if (rateLimit.limited) {
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

    const { message, program, history } = parseResult.data;

    const selectedProgram =
      program && VALID_PROGRAMS.has(program) ? program : "All";
    const sanitizedMessage = sanitizeMessage(message);

    const programMeta = programOptions.find((p) => p.value === selectedProgram);
    const programLabel = programMeta?.label || selectedProgram;
    const primaryGroup = programMeta?.group || "B";
    const secondaryGroup = primaryGroup === "A" ? "B" : "A";

    const groupAContext = formatActivitiesAsContext(activitiesGroupA);
    const groupBActivities = getFilteredGroupBActivities(selectedProgram);
    const groupBContext = formatActivitiesAsContext(groupBActivities);

    const primaryContext = primaryGroup === "A" ? groupAContext : groupBContext;
    const secondaryContext = primaryGroup === "A" ? groupBContext : groupAContext;
    const primaryDesc =
      primaryGroup === "A"
        ? "Foundation/Professional - Semester December 2025 to May 2026"
        : "Pre-Diploma, Diploma, Bachelor's Degree, Master's & PhD - Semester March to August 2026";
    const secondaryDesc =
      primaryGroup === "A"
        ? "Pre-Diploma, Diploma, Bachelor's Degree, Master's & PhD - Semester March to August 2026"
        : "Foundation/Professional - Semester December 2025 to May 2026";

    const sanitizedHistory: ChatMessage[] = (history ?? [])
      .slice(-2)
      .map((msg) => ({
        role: msg.role,
        content:
          msg.role === "user" ? sanitizeMessage(msg.content) : msg.content,
      }));

    const useCalendarPrompt = isCalendarQuestion(sanitizedMessage);
    const systemPrompt = useCalendarPrompt
      ? buildCalendarSystemPrompt(
          programLabel,
          primaryGroup,
          secondaryGroup,
          primaryContext,
          secondaryContext,
          primaryDesc,
          secondaryDesc
        )
      : buildResearchSystemPrompt();

    const rawReply = useCalendarPrompt
      ? await askGroq(sanitizedMessage, systemPrompt, sanitizedHistory)
      : await askGroqResearch(sanitizedMessage, systemPrompt, sanitizedHistory);

    const reply = rawReply
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/^[\s]*\*\s/gm, "- ")
      .replace(/#{1,6}\s?/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/~~/g, "");

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    if (error instanceof SyntaxError || (error instanceof Error && error.message?.includes("JSON"))) {
      return jsonError("Invalid JSON in request body", 400);
    }
    const errMsg = error instanceof Error ? error.message : String(error);
    const status = (error as { status?: number })?.status;
    if (process.env.NODE_ENV === "development") {
      console.error("Chat API error:", errMsg, "status:", status);
    }

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
      return jsonError("AI service is busy. Please try again in a moment.", 503);
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

    return jsonError("Failed to get response from AI. Please try again.", 500);
  }
}
