import { NextRequest, NextResponse } from "next/server";
import { getMaxOutputTokensForHost, type ChatMessage } from "@/lib/ai";
import { getLanguageTurnDirective } from "@/lib/chat-language";
import { normalizeAssistantTables } from "@/lib/format-ai-table";
import {
  ensureSessionsInStore,
  loadActivitiesIntoStoreForChat,
  loadMetaIntoStore,
  validSetsFromMeta,
} from "@/lib/chat-calendar-load";
import {
  getActivitiesForSession,
  getDefaultSessionForGroup,
  getProgramOptions,
  type SessionId,
} from "@/lib/data";
import { UITM_GENERAL_INFO } from "@/lib/uitm-info";
import {
  getClientIpForTurnstile,
  getTurnstileExpectedHostname,
  verifyTurnstileToken,
} from "@/lib/turnstile";
import { isTurnstileVerificationRequired } from "@/lib/turnstile-config";
import { jsonError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { askAiWithRetry, getModelResponseBudget } from "@/lib/chat/ai-retry";
import {
  buildCalendarSystemPrompt,
  buildComparisonContext,
  buildResearchSystemPrompt,
  buildSessionListContext,
  computeQuickReferenceForSessions,
  formatActivitiesAsContext,
  formatPrimaryCalendarContext,
  getActivitiesFromSessions,
  getFilteredGroupBActivities,
  narrowActivitiesForSecondaryReference,
  resolveEffectiveSessions,
} from "@/lib/chat/context";
import {
  isCalendarQuestion,
  isComparisonQuestion,
  isSimpleCalendarQuestion,
  isTableFormatRequested,
} from "@/lib/chat/intent";
import {
  CHAT_TURNSTILE_COOKIE,
  CHAT_TURNSTILE_COOKIE_MAX_AGE_SECONDS,
  MAX_BODY_SIZE_BYTES,
  parseChatRequest,
} from "@/lib/chat/parse-request";
import { generateCorrelationId, getCachedReply, setCachedReply } from "@/lib/chat/response-cache";
import { cleanAiReply, sanitizeMessage } from "@/lib/chat/sanitize";
import { getSystemRules } from "@/lib/chat/system-rules";
import { getTodayISO, toReadableDate } from "@/lib/chat/dates";

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
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return jsonError("Content-Type must be application/json", 415);
    }

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
    const rateLimit = checkRateLimit(ip, request);
    if (rateLimit.limited) {
      logger.warn("Rate limited", { correlationId, ip });
      return jsonError(rateLimit.message, 429);
    }

    const rawBody = await request.json();

    const bodyStr = JSON.stringify(rawBody);
    if (bodyStr.length > MAX_BODY_SIZE_BYTES) {
      return jsonError("Request body too large", 413);
    }

    const parseResult = parseChatRequest(rawBody);
    if (!parseResult.success) {
      return jsonError(parseResult.error, 400);
    }

    const { message, program, selectedSessions: rawSelectedSessions, history, turnstileToken } = parseResult.data;
    const isTurnstileRequired = isTurnstileVerificationRequired();
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

    const origin = new URL(request.url).origin;
    await getSystemRules(origin);

    const useCalendarPrompt = isCalendarQuestion(sanitizedMessage);
    const isCompareRequested =
      multipleSessionsSelected && isComparisonQuestion(sanitizedMessage);
    const wantsTableOutput =
      isCompareRequested || isTableFormatRequested(sanitizedMessage);
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
          wantsTableOutput,
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
      wantsTableOutput ? "table" : "normal",
      sanitizedMessage,
      JSON.stringify(sanitizedHistory),
    ].join("||");

    const cachedReply = getCachedReply(cacheKey);
    if (cachedReply) return withVerifiedCookie(NextResponse.json({ reply: cachedReply }));

    const requestHost = request.headers.get("host");
    const maxOutputTokens = getMaxOutputTokensForHost(requestHost);
    const modelBudget = getModelResponseBudget(
      sanitizedMessage,
      useCalendarPrompt,
      wantsTableOutput,
      maxOutputTokens
    );
    const languageDirective = getLanguageTurnDirective(sanitizedMessage, sanitizedHistory);
    const systemPromptWithCompletion =
      systemPrompt +
      "\n\nIMPORTANT: Finish every sentence and paragraph completely—never stop mid-thought or mid-list. For simple questions stay concise; for detailed or long questions use enough length to answer fully without truncating." +
      languageDirective +
      (languageDirective
        ? "\n- Before sending: verify every sentence matches the LANGUAGE DIRECTIVE above."
        : "");
    const rawReply = await askAiWithRetry(
      sanitizedMessage,
      systemPromptWithCompletion,
      sanitizedHistory,
      { ...modelBudget, requestHost }
    );

    const reply = normalizeAssistantTables(cleanAiReply(rawReply));

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
        "Workers AI is not configured. Add an AI binding named AI in Cloudflare Pages settings.",
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
