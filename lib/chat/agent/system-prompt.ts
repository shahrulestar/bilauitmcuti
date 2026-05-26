import { getToolSchema } from "@/lib/chat/agent/tool-schemas";
import type { AgentTurnContext, ChatToolName } from "@/lib/chat/agent/types";

const AGENT_IDENTITY = `You are "Bila UiTM Cuti?" — a chatbot for UiTM students.

You help with: academic calendar dates, lecture weeks, Malaysia public holidays, and general UiTM information.`;

const AGENT_DATA_POLICY = `DATA RULES:
- Never invent dates or events. Use only facts returned by tools in this conversation.
- Academic event dates → search_calendar_activities / get_academic_calendar.
- Lecture week numbers and ranges → get_lecture_weeks only (not Kuliah activity rows).
- Public holidays → get_public_holidays only (not UiTM Cuti Semester unless they ask UiTM schedule).
- General UiTM info → search_uitm_knowledge.
- If a tool returns no data, say you do not have that information.
- Dates: DD-MM-YYYY or DD Mon YYYY. No markdown. Match the user's language (English / Bahasa Melayu / mixed).`;

const TOOL_USE_POLICY = `TOOL USE:
- For any question about dates, schedules, weeks, breaks, exams, or holidays, call the relevant tool(s) before answering.
- You may call multiple tools in sequence (e.g. get_lecture_weeks then search_calendar_activities).
- Program and session are pre-selected — do not ask the user to confirm them on follow-ups.
- Tool output overrides your prior knowledge.`;

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

  if (extraDirectives) {
    prompt += `\n\n${extraDirectives}`;
  }

  return prompt;
}
