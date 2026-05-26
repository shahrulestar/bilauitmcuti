import {
  formatMatchedActivitiesBlock,
  matchActivitiesInMessage,
  flattenActivitiesWithSession,
} from "@/lib/chat/activity-match";
import {
  computeQuickReferenceForSessions,
  formatPrimaryCalendarContext,
  formatActivitiesAsContext,
  getFilteredActivitiesForSession,
  MAX_PRIMARY_CONTEXT_CHARS_COMPACT,
  MAX_SECONDARY_CONTEXT_CHARS,
} from "@/lib/chat/context";
import { filterActivitiesByDateScope, resolveDateScope } from "@/lib/chat/date-scope";
import {
  buildLectureWeekQuickReference,
  buildLectureWeeksTableBlock,
  needsLectureWeekTable,
} from "@/lib/chat/lecture-week-context";
import { buildPublicHolidayChatContext } from "@/lib/chat/public-holiday-context";
import { buildQueryScopeBlock, buildSessionTimelineBlock } from "@/lib/chat/query-scope";
import { messageAsksNextUpcomingEvent } from "@/lib/chat/topic-router";
import { toPromptDate } from "@/lib/chat/dates";
import type { AgentTurnContext, ChatToolName } from "@/lib/chat/agent/types";
import { truncateToolOutput } from "@/lib/chat/agent/types";
import { searchUitmKnowledge } from "@/lib/chat/agent/tools/search-uitm-knowledge";
import { getFilteredGroupBActivities } from "@/lib/chat/context";
import { getDefaultSessionForGroup } from "@/lib/data";

function parseToolArgs(args: Record<string, unknown>): Record<string, unknown> {
  return args ?? {};
}

export async function executeChatTool(
  name: ChatToolName,
  args: Record<string, unknown>,
  ctx: AgentTurnContext
): Promise<string> {
  switch (name) {
    case "search_calendar_activities":
      return executeSearchCalendarActivities(args, ctx);
    case "get_academic_calendar":
      return executeGetAcademicCalendar(args, ctx);
    case "get_upcoming_events":
      return executeGetUpcomingEvents(ctx);
    case "get_session_timeline":
      return executeGetSessionTimeline(ctx);
    case "get_lecture_weeks":
      return executeGetLectureWeeks(args, ctx);
    case "get_public_holidays":
      return executeGetPublicHolidays(args, ctx);
    case "search_uitm_knowledge":
      return executeSearchUitmKnowledge(args, ctx);
    default:
      return `(unknown tool: ${name})`;
  }
}

function executeSearchCalendarActivities(
  args: Record<string, unknown>,
  ctx: AgentTurnContext
): string {
  const parsed = parseToolArgs(args);
  const query = String(parsed.query ?? ctx.message).trim();

  if (ctx.activityMatches.length > 0 && !parsed.query) {
    return truncateToolOutput(formatMatchedActivitiesBlock(ctx.activityMatches));
  }

  const flatPool = flattenActivitiesWithSession(ctx.contextSessionIds, (sid) =>
    getFilteredActivitiesForSession(sid, ctx.program, ctx.primaryGroup)
  );
  const matches = matchActivitiesInMessage(query || ctx.message, flatPool);
  if (matches.length > 0) {
    return truncateToolOutput(formatMatchedActivitiesBlock(matches));
  }

  const dateScope = resolveDateScope(query || ctx.message, ctx.todayISO);
  if (dateScope) {
    const scoped = filterActivitiesByDateScope(ctx.primaryActivities, dateScope);
    const lines: string[] = [
      `=== SCOPED CALENDAR (${dateScope.kind}: ${dateScope.label}) ===`,
    ];
    if (scoped.length === 0) {
      lines.push("(no rows overlap this period)");
    } else {
      for (const a of scoped.slice(0, 24)) {
        let range = toPromptDate(a.startDate);
        if (a.endDate) range += ` to ${toPromptDate(a.endDate)}`;
        lines.push(`- ${a.name}: ${range}`);
      }
    }
    return truncateToolOutput(lines.join("\n"));
  }

  return "(no matching calendar activities — try get_academic_calendar or rephrase the event name)";
}

function executeGetAcademicCalendar(
  args: Record<string, unknown>,
  ctx: AgentTurnContext
): string {
  const parsed = parseToolArgs(args);
  const includeSecondary =
    parsed.include_secondary_group === true || ctx.includeSecondary;

  const primary = formatPrimaryCalendarContext(
    ctx.contextSessionIds,
    ctx.program,
    ctx.primaryGroup,
    ctx.contextIntent,
    { useIntentFilter: ctx.useIntentFilter }
  );
  let out = [
    `=== SESSION LIST (GROUP ${ctx.primaryGroup}) ===`,
    ctx.sessionListContext,
    `=== GROUP ${ctx.primaryGroup} ACADEMIC CALENDAR ===`,
    truncateToolOutput(primary, MAX_PRIMARY_CONTEXT_CHARS_COMPACT),
  ].join("\n\n");

  if (includeSecondary) {
    const secondaryId =
      ctx.primaryGroup === "A"
        ? getDefaultSessionForGroup("B")
        : getDefaultSessionForGroup("A");
    const secondaryGroup = ctx.primaryGroup === "A" ? "B" : "A";
    const secondaryActs =
      secondaryGroup === "B"
        ? getFilteredGroupBActivities(ctx.program, [secondaryId])
        : getFilteredActivitiesForSession(secondaryId, ctx.program, "A");
    const secondaryText = truncateToolOutput(
      formatActivitiesAsContext(secondaryActs),
      MAX_SECONDARY_CONTEXT_CHARS
    );
    out += `\n\n=== GROUP ${ctx.secondaryGroup} (reference only) ===\n${secondaryText}`;
  }

  if (ctx.comparisonContext) {
    out += `\n\n=== SESSION COMPARISON ===\n${ctx.comparisonContext}`;
  }

  return truncateToolOutput(out);
}

function executeGetUpcomingEvents(ctx: AgentTurnContext): string {
  if (!messageAsksNextUpcomingEvent(ctx.message) && ctx.activityMatches.length > 0) {
    return "(use search_calendar_activities for named events)";
  }
  const ref = computeQuickReferenceForSessions(
    ctx.contextSessionIds,
    ctx.program,
    ctx.primaryGroup,
    ctx.todayISO,
    ctx.useIntentFilter ? ctx.contextIntent : "all"
  );
  if (!ref) return "(no upcoming hints for this session)";
  return truncateToolOutput(
    `=== UPCOMING HINTS (today ${ctx.todayISO}) ===\n${ref}`
  );
}

function executeGetSessionTimeline(ctx: AgentTurnContext): string {
  const parts: string[] = [];
  const scopeBlock = buildQueryScopeBlock(ctx.queryScope, ctx.effectiveSessions);
  if (scopeBlock) parts.push(scopeBlock);
  parts.push(buildSessionTimelineBlock(ctx.contextSessionIds, ctx.primaryGroup));
  return truncateToolOutput(parts.filter(Boolean).join("\n\n"));
}

async function executeGetLectureWeeks(
  args: Record<string, unknown>,
  ctx: AgentTurnContext
): Promise<string> {
  const parsed = parseToolArgs(args);
  const wantTable =
    parsed.full_table === true || needsLectureWeekTable(ctx.message);

  if (wantTable) {
    const table = await buildLectureWeeksTableBlock(ctx.contextSessionIds);
    return truncateToolOutput(table || "(lecture weeks data unavailable)");
  }
  const quick = await buildLectureWeekQuickReference(ctx.contextSessionIds, ctx.todayISO);
  return truncateToolOutput(quick || "(lecture weeks data unavailable)");
}

async function executeGetPublicHolidays(
  args: Record<string, unknown>,
  ctx: AgentTurnContext
): Promise<string> {
  const parsed = parseToolArgs(args);
  const query = String(parsed.query ?? ctx.message);
  const ph = await buildPublicHolidayChatContext(query, ctx.todayISO);
  const parts: string[] = [];
  if (ph.block) parts.push(ph.block);
  if (!ph.block) parts.push("(no public holiday rows for this query)");
  return truncateToolOutput(parts.join("\n\n"));
}

function executeSearchUitmKnowledge(
  args: Record<string, unknown>,
  ctx: AgentTurnContext
): string {
  const parsed = parseToolArgs(args);
  const query = String(parsed.query ?? ctx.message).trim();
  return searchUitmKnowledge(query);
}
