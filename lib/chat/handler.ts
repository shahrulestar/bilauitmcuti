import { NextRequest, NextResponse } from "next/server";
import {
  getAiBinding,
  getMaxOutputTokensForHost,
  resolveProductionChatModelChain,
  resolveWorkersAiModelTier,
  shouldStreamTokensToClient,
  type ChatMessage,
} from "@/lib/ai";
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
  getGroupFromSession,
  getProgramOptions,
  type SessionId,
} from "@/lib/data";
import {
  addDatesFromContextText,
  collectAllowedDateTokens,
} from "@/lib/chat/allowed-dates";
import { mergeSessionsForLoad, resolveQueryScope } from "@/lib/chat/query-scope";
import { UITM_GENERAL_INFO } from "@/lib/uitm-info";
import {
  getClientIpForTurnstile,
  getTurnstileExpectedHostname,
  verifyTurnstileToken,
} from "@/lib/turnstile";
import { isTurnstileVerificationRequired } from "@/lib/turnstile-config";
import { jsonError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import {
  getModelResponseBudget,
  streamAiWithRetry,
  askAiWithRetry,
  askAgentWithRetry,
} from "@/lib/chat/ai-retry";
import {
  agentModeForModelChain,
  buildAgentTurnContext,
  buildCompactFallbackSystemPrompt,
  isChatAgentEnabled,
} from "@/lib/chat/agent";
import {
  buildComparisonContext,
  buildResearchSystemPrompt,
  buildSessionListContext,
  formatActivitiesAsContext,
  formatPrimaryCalendarContext,
  getActivitiesFromSessions,
  getFilteredActivitiesForSession,
  getFilteredGroupBActivities,
  MAX_PRIMARY_CONTEXT_CHARS,
  narrowActivitiesForSecondaryReference,
  resolveEffectiveSessions,
} from "@/lib/chat/context";
import { resolveCalendarContextIntent } from "@/lib/chat/calendar-intent";
import {
  buildDataContextForTurn,
  shouldUseCalendarIntentFilter,
  topicNeedsCalendarPrompt,
} from "@/lib/chat/build-data-context";
import {
  flattenActivitiesWithSession,
  matchActivitiesInMessage,
} from "@/lib/chat/activity-match";
import {
  buildChatAssistantSystemPrompt,
  usesResearchStylePrompt,
} from "@/lib/chat/chat-prompt";
import { routeChatTopics } from "@/lib/chat/topic-router";
import {
  getCalendarUnderstandingDirective,
  getCompletionInstruction,
  isComparisonQuestion,
  isSimpleCalendarQuestion,
  isTableFormatRequested,
  messageAsksDetail,
  messageNeedsListOrSchedule,
  needsSecondaryGroupContext,
  needsUitmKnowledgeSupplement,
} from "@/lib/chat/intent";
import {
  DATE_VALIDATION_RETRY_NUDGE,
  replyHasUnknownCalendarDates,
} from "@/lib/chat/reply-validation";
import {
  detectIncompleteReply,
  REPLY_COMPLETION_RETRY_NUDGE,
} from "@/lib/chat/reply-completion";
import {
  CHAT_TURNSTILE_COOKIE,
  CHAT_TURNSTILE_COOKIE_MAX_AGE_SECONDS,
  MAX_BODY_SIZE_BYTES,
  parseChatRequest,
} from "@/lib/chat/parse-request";
import { generateCorrelationId, getCachedReply, setCachedReply } from "@/lib/chat/response-cache";
import { cleanAiReply, sanitizeMessage } from "@/lib/chat/sanitize";
import { getSystemRules } from "@/lib/chat/system-rules";
import { getTodayISO, toPromptDate } from "@/lib/chat/dates";
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

    correlationId = generateCorrelationId();

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

    const todayISO = getTodayISO();
    const todayFormatted = toPromptDate(todayISO);

    const queryScope = resolveQueryScope(
      sanitizedMessage,
      primaryGroup,
      validSessionIds,
      todayISO
    );
    const loadSessions = mergeSessionsForLoad(
      effectiveSessions,
      queryScope,
      primaryGroup,
      getGroupFromSession
    );

    await loadActivitiesIntoStoreForChat(
      selectedProgram,
      primaryGroup,
      loadSessions
    );

    let contextSessionIds: SessionId[] = loadSessions;
    let primaryActivities = getActivitiesFromSessions(
      loadSessions,
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

    const flatPool = flattenActivitiesWithSession(contextSessionIds, (sid) =>
      getFilteredActivitiesForSession(sid, selectedProgram, primaryGroup)
    );
    const activityMatches = matchActivitiesInMessage(sanitizedMessage, flatPool);
    const hasMatchedActivity = activityMatches.length > 0;

    const topicRoute = routeChatTopics(sanitizedMessage, hasMatchedActivity);
    const useIntentFilter = shouldUseCalendarIntentFilter(topicRoute, activityMatches.length);

    const secondaryActivitiesRaw =
      primaryGroup === "A"
        ? getFilteredGroupBActivities(selectedProgram, [getDefaultSessionForGroup("B")])
        : getActivitiesForSession(getDefaultSessionForGroup("A"));
    const secondaryActivities = narrowActivitiesForSecondaryReference(secondaryActivitiesRaw);

    const primaryContext = formatPrimaryCalendarContext(
      contextSessionIds,
      selectedProgram,
      primaryGroup,
      contextIntent,
      { useIntentFilter }
    );
    const secondaryContext = formatActivitiesAsContext(secondaryActivities);
    const sessionListContext = buildSessionListContext(primaryGroup, effectiveSessions);
    const multipleSessionsSelected = effectiveSessions.length > 1;
    const comparisonContext = multipleSessionsSelected
      ? buildComparisonContext(effectiveSessions, selectedProgram, primaryGroup)
      : "";

    const sanitizedHistory: ChatMessage[] = (history ?? [])
      .slice(-4)
      .map((msg) => ({
        role: msg.role,
        content:
          msg.role === "user" ? sanitizeMessage(msg.content) : msg.content,
      }));

    const origin = new URL(request.url).origin;
    await getSystemRules(origin);

    const useCalendarPrompt = topicNeedsCalendarPrompt(topicRoute.topics);

    const { dataContext, publicHolidayDirective } = await buildDataContextForTurn({
      message: sanitizedMessage,
      todayISO,
      route: topicRoute,
      contextSessionIds,
      primaryGroup,
      program: selectedProgram,
      queryScope,
      effectiveSessions,
      primaryActivities,
      contextIntent,
      useIntentFilter,
    });

    let dataContextFull = dataContext;
    if (comparisonContext) {
      dataContextFull = dataContextFull
        ? `${dataContextFull}\n\n=== SESSION COMPARISON ===\n${comparisonContext}`
        : comparisonContext;
    }

    const isCompareRequested =
      multipleSessionsSelected && isComparisonQuestion(sanitizedMessage);
    const wantsTableOutput =
      isCompareRequested || isTableFormatRequested(sanitizedMessage);
    const isSimple = isSimpleCalendarQuestion(sanitizedMessage, { hasMatchedActivity });
    const asksDetail = messageAsksDetail(sanitizedMessage);
    const needsList = messageNeedsListOrSchedule(sanitizedMessage);

    const includeSecondary =
      useCalendarPrompt && needsSecondaryGroupContext(sanitizedMessage, primaryGroup);
    const includeUitmSupplement =
      topicRoute.topics.includes("uitm_general") ||
      needsUitmKnowledgeSupplement(sanitizedMessage);

    const maxPrimaryChars = needsList || hasMatchedActivity
      ? MAX_PRIMARY_CONTEXT_CHARS
      : MAX_PRIMARY_CONTEXT_CHARS;

    const useResearchOnly =
      usesResearchStylePrompt(topicRoute.topics) && !useCalendarPrompt;

    const requestHost = request.headers.get("host");
    const useAgentPath = isChatAgentEnabled();
    const modelChain = resolveProductionChatModelChain(requestHost);
    const agentMode = useAgentPath ? agentModeForModelChain(modelChain) : "compact";

    const agentTurnContext = buildAgentTurnContext({
      message: sanitizedMessage,
      todayISO,
      todayFormatted,
      program: selectedProgram,
      programLabel,
      primaryGroup,
      secondaryGroup,
      effectiveSessions,
      contextSessionIds,
      topicRoute,
      activityMatches: activityMatches,
      queryScope,
      contextIntent,
      useIntentFilter,
      primaryActivities,
      sessionListContext,
      comparisonContext,
      includeSecondary,
    });

    let systemPrompt = "";
    if (!useAgentPath || agentMode !== "tools") {
      if (useAgentPath && agentMode === "compact") {
        systemPrompt = await buildCompactFallbackSystemPrompt({
          ctx: agentTurnContext,
          sessionListContext,
          secondaryContext,
          comparisonContext,
          includeSecondary,
          includeUitmSupplement,
          uitmSupplement: UITM_GENERAL_INFO,
          wantsTableOutput,
          multipleSessionsSelected,
          contextIntent,
          useIntentFilter,
        });
      } else {
        systemPrompt = useResearchOnly
          ? buildResearchSystemPrompt(todayFormatted) +
            (dataContextFull ? `\n\n${dataContextFull}` : "")
          : buildChatAssistantSystemPrompt({
              programLabel,
              primaryGroup,
              secondaryGroup,
              todayFormatted,
              sessionListContext,
              primaryContext,
              secondaryContext: includeSecondary ? secondaryContext : "",
              dataContext: dataContextFull,
              topics: topicRoute.topics,
              selectedSessionCount: effectiveSessions.length,
              forceTableOutput: wantsTableOutput,
              multipleSessionsSelected,
              uitmSupplement: includeUitmSupplement ? UITM_GENERAL_INFO : "",
              includeSecondaryContext: includeSecondary,
              maxPrimaryChars,
            });
      }
    }

    const cacheKey = [
      useAgentPath ? `agent:${agentMode}` : "legacy",
      todayISO,
      selectedProgram,
      effectiveSessions.join(","),
      topicRoute.topics.join("+"),
      hasMatchedActivity ? "matched" : "nomatch",
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

    const modelTier = resolveWorkersAiModelTier(requestHost);
    const maxOutputTokens = getMaxOutputTokensForHost(requestHost);
    const modelBudget = getModelResponseBudget(
      sanitizedMessage,
      !useResearchOnly,
      wantsTableOutput,
      maxOutputTokens,
      { hasMatchedActivity }
    );
    const languageDirective = getLanguageTurnDirective(sanitizedMessage, sanitizedHistory);
    const understandingDirective =
      !useResearchOnly && topicRoute.topics.includes("academic_calendar")
        ? getCalendarUnderstandingDirective(sanitizedMessage)
        : "";

    const systemPromptWithCompletion =
      systemPrompt +
      getCompletionInstruction(isSimple, asksDetail, needsList, hasMatchedActivity) +
      understandingDirective +
      publicHolidayDirective +
      languageDirective;

    const validationActivityPool = !useResearchOnly
      ? getActivitiesFromSessions(loadSessions, selectedProgram, primaryGroup)
      : [];
    const allowedDates = !useResearchOnly
      ? collectAllowedDateTokens(validationActivityPool)
      : new Set<string>();
    if (!useResearchOnly) {
      addDatesFromContextText(allowedDates, dataContextFull);
      addDatesFromContextText(allowedDates, primaryContext);
    }

    const streamTokensToClient = shouldStreamTokensToClient(requestHost);

    const runLlm = async (
      onToken: (token: string) => void | Promise<void>
    ): Promise<string> => {
      let rawReply: string;
      if (useAgentPath && agentMode === "tools") {
        const agentResult = await askAgentWithRetry({
          userMessage: sanitizedMessage,
          history: sanitizedHistory,
          ctx: agentTurnContext,
          requestHost,
          correlationId,
          maxTokens: modelBudget.maxTokens,
          temperature: modelBudget.temperature,
          extraSystemDirectives: systemPromptWithCompletion,
          onToken,
          emitTokensToClient: streamTokensToClient,
        });
        rawReply = agentResult.reply;
      } else if (wantStream) {
        rawReply = await streamAiWithRetry(
          sanitizedMessage,
          systemPromptWithCompletion,
          sanitizedHistory,
          { ...modelBudget, requestHost, correlationId, onToken, emitTokensToClient: streamTokensToClient }
        );
      } else {
        rawReply = await askAiWithRetry(
          sanitizedMessage,
          systemPromptWithCompletion,
          sanitizedHistory,
          { ...modelBudget, requestHost, correlationId }
        );
      }

      if (
        !useResearchOnly &&
        !hasMatchedActivity &&
        allowedDates.size > 0 &&
        replyHasUnknownCalendarDates(rawReply, allowedDates)
      ) {
        if (useAgentPath && agentMode === "tools") {
          const agentRetry = await askAgentWithRetry({
            userMessage: sanitizedMessage,
            history: sanitizedHistory,
            ctx: agentTurnContext,
            requestHost,
            correlationId,
            maxTokens: modelBudget.maxTokens,
            temperature: modelBudget.temperature,
            extraSystemDirectives:
              systemPromptWithCompletion + DATE_VALIDATION_RETRY_NUDGE,
            onToken,
            emitTokensToClient: streamTokensToClient,
          });
          rawReply = agentRetry.reply;
        } else if (wantStream) {
          rawReply = await streamAiWithRetry(
            sanitizedMessage,
            systemPromptWithCompletion + DATE_VALIDATION_RETRY_NUDGE,
            sanitizedHistory,
            { ...modelBudget, requestHost, correlationId, onToken, emitTokensToClient: streamTokensToClient }
          );
        } else {
          rawReply = await askAiWithRetry(
            sanitizedMessage,
            systemPromptWithCompletion + DATE_VALIDATION_RETRY_NUDGE,
            sanitizedHistory,
            { ...modelBudget, requestHost, correlationId }
          );
        }
      }

      const cleanedFirst = normalizeAssistantTables(cleanAiReply(rawReply));
      const incomplete = detectIncompleteReply(cleanedFirst, needsList || asksDetail);
      if (incomplete) {
        const bumpedBudget = {
          ...modelBudget,
          maxTokens: maxOutputTokens,
        };
        let retryReply: string;
        if (useAgentPath && agentMode === "tools") {
          const agentCompletion = await askAgentWithRetry({
            userMessage: sanitizedMessage,
            history: sanitizedHistory,
            ctx: agentTurnContext,
            requestHost,
            correlationId,
            maxTokens: bumpedBudget.maxTokens,
            temperature: bumpedBudget.temperature,
            extraSystemDirectives:
              systemPromptWithCompletion + REPLY_COMPLETION_RETRY_NUDGE,
            onToken,
            emitTokensToClient: streamTokensToClient,
          });
          retryReply = agentCompletion.reply;
        } else if (wantStream) {
          retryReply = await streamAiWithRetry(
            sanitizedMessage,
            systemPromptWithCompletion + REPLY_COMPLETION_RETRY_NUDGE,
            sanitizedHistory,
            {
              ...bumpedBudget,
              requestHost,
              correlationId,
              onToken,
              emitTokensToClient: streamTokensToClient,
            }
          );
        } else {
          retryReply = await askAiWithRetry(
            sanitizedMessage,
            systemPromptWithCompletion + REPLY_COMPLETION_RETRY_NUDGE,
            sanitizedHistory,
            { ...bumpedBudget, requestHost, correlationId }
          );
        }
        const cleanedRetry = normalizeAssistantTables(cleanAiReply(retryReply));
        if (cleanedRetry.length >= cleanedFirst.length) {
          return cleanedRetry;
        }
      }

      return cleanedFirst;
    };

    if (wantStream) {
      const sseStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const encoder = new TextEncoder();
          const enqueue = (text: string) => controller.enqueue(encoder.encode(text));
          try {
            const onToken = streamTokensToClient
              ? (token: string) => {
                  enqueue(encodeSseEvent("token", { token }));
                }
              : () => {};
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
              modelTier,
              modelChain: modelChain.join(" → "),
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
    const requestHost = request.headers.get("host");
    logger.error("Chat API error", {
      correlationId,
      errMsg: mapped.message,
      status: mapped.status,
      cause: error instanceof Error ? error.message : String(error),
      modelTier: resolveWorkersAiModelTier(requestHost),
      modelChain: resolveProductionChatModelChain(requestHost).join(" → "),
    });
    return withVerifiedCookie(jsonError(mapped.message, mapped.status));
  }
}
