import { getToolSchema } from "@/lib/chat/agent/tool-schemas";
import type { AgentTurnContext, ChatToolName } from "@/lib/chat/agent/types";
import {
  CHAT_ANSWER_MODE_POLICY,
  CHAT_GRACEFUL_FALLBACK_POLICY,
  CHAT_RESPONSE_FORMAT_RULES,
  messageLooksLikeExplanationOrOpinion,
} from "@/lib/chat/response-format";

const AGENT_IDENTITY = `You are "Bila UiTM Cuti?" — a chatbot for UiTM students.

You help with: academic calendar dates, lecture weeks, Malaysia public holidays, and general UiTM information.`;

const AGENT_DATA_POLICY = `DATA RULES:
- Never invent dates or events. For precise dates, use tool output from this turn.
- Academic event dates → search_calendar_activities / get_academic_calendar.
- Lecture week numbers and ranges → get_lecture_weeks only (not Kuliah activity rows).
- Public holidays → get_public_holidays only (not UiTM Cuti Semester unless they ask UiTM schedule).
- IMPORTANT TERM SPLIT: "cuti/holiday/break" may mean UiTM academic breaks or Malaysia public holidays. Treat UiTM break names (Cuti Semester, Cuti Pertengahan Semester, study/revision week) as academic calendar items, not public holidays.
- General UiTM info → search_uitm_knowledge.
- Tool output overrides your prior knowledge for factual dates and official rows.`;

const TOOL_USE_POLICY = `TOOL USE:
- For questions about dates, schedules, weeks, breaks, exams, or holidays, call the relevant tool(s) before stating dates.
- For explain / why / opinion questions, call search_uitm_knowledge and/or domain tools when available, then synthesize a helpful answer.
- You may call multiple tools in sequence (e.g. get_lecture_weeks then search_calendar_activities).
- Program and session are pre-selected — do not ask the user to confirm them on follow-ups.
- For UiTM general questions: use search_uitm_knowledge as primary source (from lib/uitm-info.json). If exact details are missing there, reason from available tool output and give best-effort guidance with a clear uncertainty note instead of hard refusal.`;

export function buildAgentSystemPrompt(
  ctx: AgentTurnContext,
  availableTools: ChatToolName[],
  extraDirectives = ""
): string {
  const toolLines = availableTools.map((name) => {
    const schema = getToolSchema(name);
    return `- ${name}: ${schema.description}`;
  });

  const sessionLine =
    ctx.effectiveSessions.length > 0
      ? ctx.effectiveSessions.join(", ")
      : "(default session)";

  let prompt = [
    AGENT_IDENTITY,
    AGENT_DATA_POLICY,
    CHAT_ANSWER_MODE_POLICY,
    CHAT_GRACEFUL_FALLBACK_POLICY,
    CHAT_RESPONSE_FORMAT_RULES,
    TOOL_USE_POLICY,
    "",
    `Program: ${ctx.programLabel} (GROUP ${ctx.primaryGroup}). Default GROUP ${ctx.primaryGroup}; other group is ${ctx.secondaryGroup}.`,
    `Selected session(s): ${sessionLine}`,
    `TODAY (Malaysia, UTC+8): ${ctx.todayFormatted}`,
    `Topics this turn: ${ctx.topicRoute.topics.join(", ")}.`,
    "",
    "AVAILABLE TOOLS:",
    ...toolLines,
  ].join("\n");

  if (ctx.activityMatches.length > 0) {
    prompt +=
      "\n\nNOTE: The user's message likely names a specific calendar row — call search_calendar_activities first.";
  }

  if (messageLooksLikeExplanationOrOpinion(ctx.message)) {
    prompt +=
      "\n\nNOTE: This turn looks like explain/opinion/justification — use EXPLAIN or OPINION mode; answer helpfully even if tool data is partial.";
  }

  if (extraDirectives) {
    prompt += `\n\n${extraDirectives}`;
  }

  return prompt;
}
