import type { ChatToolName, WorkersAiToolSchema } from "@/lib/chat/agent/types";

const TOOL_DEFINITIONS: Record<ChatToolName, WorkersAiToolSchema> = {
  search_calendar_activities: {
    name: "search_calendar_activities",
    description:
      "Find official UiTM academic calendar rows by activity name or keywords. Returns authoritative dates for matched events.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Activity name or keywords from the user question (e.g. peperiksaan akhir, cuti semester)",
        },
      },
      required: ["query"],
    },
  },
  get_academic_calendar: {
    name: "get_academic_calendar",
    description:
      "Get the academic calendar activity list for the user's selected program and session(s). Use for schedule overview or when search returns nothing.",
    parameters: {
      type: "object",
      properties: {
        include_secondary_group: {
          type: "boolean",
          description: "Include Group A/B reference calendar when user asks about the other group",
        },
      },
    },
  },
  get_upcoming_events: {
    name: "get_upcoming_events",
    description:
      "Get next break, next exam, and currently happening events for selected session(s). Use for next/upcoming questions.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  get_session_timeline: {
    name: "get_session_timeline",
    description:
      "Get session ordering, relative session hints (next/previous semester), and query scope for the message.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  get_lecture_weeks: {
    name: "get_lecture_weeks",
    description:
      "Get lecture week numbers and date ranges (Week 1..N). Use for minggu kuliah / lecture week questions — not Kuliah activity rows.",
    parameters: {
      type: "object",
      properties: {
        full_table: {
          type: "boolean",
          description: "When true, return all weeks 1..N; when false, current week quick reference only",
        },
      },
    },
  },
  get_public_holidays: {
    name: "get_public_holidays",
    description:
      "Get Malaysia public holidays (cuti umum). Not UiTM semester break unless user asks UiTM schedule.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional state, month, or date hint from the user message",
        },
      },
    },
  },
  search_uitm_knowledge: {
    name: "search_uitm_knowledge",
    description:
      "Search static UiTM knowledge: campuses, faculties, admission, fees, portals. For general UiTM questions.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Topic keywords from the user question",
        },
      },
      required: ["query"],
    },
  },
};

export function getToolSchema(name: ChatToolName): WorkersAiToolSchema {
  return TOOL_DEFINITIONS[name];
}

export function schemasForTools(names: ChatToolName[]): WorkersAiToolSchema[] {
  return names.map((n) => getToolSchema(n));
}

export function toWorkersAiToolsParam(schemas: WorkersAiToolSchema[]): Array<{
  name: string;
  description: string;
  parameters: WorkersAiToolSchema["parameters"];
}> {
  return schemas.map((s) => ({
    name: s.name,
    description: s.description,
    parameters: s.parameters,
  }));
}
