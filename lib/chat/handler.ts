import { NextRequest, NextResponse } from "next/server";
import { getAiBinding, getMaxOutputTokensForHost, type ChatMessage } from "@/lib/ai";
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
import { getModelResponseBudget, streamAiWithRetry, askAiWithRetry } from "@/lib/chat/ai-retry";
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
  MAX_PRIMARY_CONTEXT_CHARS,
  MAX_PRIMARY_CONTEXT_CHARS_COMPACT,
  MAX_PRIMARY_CONTEXT_CHARS_NARROW,
  narrowActivitiesForSecondaryReference,
  resolveEffectiveSessions,
} from "@/lib/chat/context";
import { resolveCalendarContextIntent, isNarrowCalendarIntent } from "@/lib/chat/calendar-intent";
import {
  getCompletionInstruction,
  isCalendarQuestion,
  isComparisonQuestion,
  isSimpleCalendarQuestion,
  isTableFormatRequested,
  messageAsksDetail,
  needsSecondaryGroupContext,
} from "@/lib/chat/intent";
import {
  collectAllowedDateTokens,
  DATE_VALIDATION_RETRY_NUDGE,
  replyHasUnknownCalendarDates,
} from "@/lib/chat/reply-validation";
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
import { encodeSseEvent, SSE_HEADERS } from "@/lib/chat/sse";
import { mapChatError } from "@/lib/chat/map-error";

function jsonChatReply(
  reply: string,
  correlationId: string,
  path: "cache" | "llm"
): NextResponse {
  return NextResponse.json({ reply, correlationId, path });
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

    const {
      message,
      program,
      selectedSessions: rawSelectedSessions,
      history,
      turnstileToken,
      stream: wantStream,
    } = parseResult.data;
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

    const contextIntent = resolveCalendarContextIntent(sanitizedMessage);

    const secondaryActivitiesRaw =
      primaryGroup === "A"
        ? getFilteredGroupBActivities(selectedProgram, [getDefaultSessionForGroup("B")])
        : getActivitiesForSession(getDefaultSessionForGroup("A"));
    const secondaryActivities = narrowActivitiesForSecondaryReference(secondaryActivitiesRaw);

    const primaryContext = formatPrimaryCalendarContext(
      contextSessionIds,
      selectedProgram,
      primaryGroup,
      contextIntent
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
      todayISO,
      contextIntent
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
    const isSimple = isSimpleCalendarQuestion(sanitizedMessage);
    const asksDetail = messageAsksDetail(sanitizedMessage);
    const includeSecondary =
      useCalendarPrompt && needsSecondaryGroupContext(sanitizedMessage, primaryGroup);
    const includeUitmSupplement =
      !useCalendarPrompt || (!isSimple && !asksDetail);

    const maxPrimaryChars = isNarrowCalendarIntent(contextIntent)
      ? MAX_PRIMARY_CONTEXT_CHARS_NARROW
      : isSimple && !asksDetail
        ? MAX_PRIMARY_CONTEXT_CHARS_COMPACT
        : MAX_PRIMARY_CONTEXT_CHARS;

    const systemPrompt = useCalendarPrompt
      ? buildCalendarSystemPrompt(
          programLabel,
          primaryGroup,
          secondaryGroup,
          sessionListContext,
          primaryContext,
          includeSecondary ? secondaryContext : "",
          primaryDesc,
          secondaryDesc,
          todayFormatted,
          quickReference,
          comparisonContext,
          wantsTableOutput,
          multipleSessionsSelected,
          includeUitmSupplement ? UITM_GENERAL_INFO : "",
          effectiveSessions.length,
          {
            includeSecondaryContext: includeSecondary,
            maxPrimaryChars,
          }
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
    if (cachedReply) {
      return withVerifiedCookie(jsonChatReply(cachedReply, correlationId, "cache"));
    }

    const aiBinding = await getAiBinding();
    if (!aiBinding) {
      const noAi = mapChatError(
        Object.assign(new Error("Workers AI binding not available"), { status: 503 })
      );
      return withVerifiedCookie(jsonError(noAi.message, noAi.status));
    }

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
      getCompletionInstruction(isSimple, asksDetail) +
      languageDirective +
      (languageDirective
        ? "\n- Before sending: verify every sentence matches the LANGUAGE DIRECTIVE above."
        : "");

    const allowedDates = useCalendarPrompt
      ? collectAllowedDateTokens(primaryActivities)
      : new Set<string>();

    const runLlm = async (
      onToken: (token: string) => void | Promise<void>
    ): Promise<string> => {
      let rawReply = wantStream
        ? await streamAiWithRetry(
            sanitizedMessage,
            systemPromptWithCompletion,
            sanitizedHistory,
            { ...modelBudget, requestHost, onToken }
          )
        : await askAiWithRetry(
            sanitizedMessage,
            systemPromptWithCompletion,
            sanitizedHistory,
            { ...modelBudget, requestHost }
          );

      if (
        useCalendarPrompt &&
        allowedDates.size > 0 &&
        replyHasUnknownCalendarDates(rawReply, allowedDates)
      ) {
        rawReply = wantStream
          ? await streamAiWithRetry(
              sanitizedMessage,
              systemPromptWithCompletion + DATE_VALIDATION_RETRY_NUDGE,
              sanitizedHistory,
              { ...modelBudget, requestHost, onToken }
            )
          : await askAiWithRetry(
              sanitizedMessage,
              systemPromptWithCompletion + DATE_VALIDATION_RETRY_NUDGE,
              sanitizedHistory,
              { ...modelBudget, requestHost }
            );
      }

      return normalizeAssistantTables(cleanAiReply(rawReply));
    };

    if (wantStream) {
      const sseStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const encoder = new TextEncoder();
          const enqueue = (text: string) => controller.enqueue(encoder.encode(text));
          try {
            const onToken = (token: string) => {
              enqueue(encodeSseEvent("token", { token }));
            };
            const reply = await runLlm(onToken);
            setCachedReply(cacheKey, reply);
            enqueue(
              encodeSseEvent("done", {
                reply,
                correlationId,
              })
            );
            controller.close();
          } catch (error) {
            const mapped = mapChatError(error);
            logger.error("Chat stream error", {
              correlationId,
              errMsg: mapped.message,
              status: mapped.status,
              cause: error instanceof Error ? error.message : String(error),
            });
            enqueue(encodeSseEvent("error", { error: mapped.message, status: mapped.status }));
            controller.close();
          }
        },
      });

      const response = new NextResponse(sseStream, { headers: SSE_HEADERS });
      return withVerifiedCookie(response);
    }

    const reply = await runLlm(() => undefined);
    setCachedReply(cacheKey, reply);
    return withVerifiedCookie(jsonChatReply(reply, correlationId, "llm"));
  } catch (error: unknown) {
    if (error instanceof SyntaxError || (error instanceof Error && error.message?.includes("JSON"))) {
      return withVerifiedCookie(jsonError("Invalid JSON in request body", 400));
    }
    const mapped = mapChatError(error);
    logger.error("Chat API error", {
      correlationId,
      errMsg: mapped.message,
      status: mapped.status,
      cause: error instanceof Error ? error.message : String(error),
    });
    return withVerifiedCookie(jsonError(mapped.message, mapped.status));
  }
}
