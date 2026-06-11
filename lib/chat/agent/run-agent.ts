import {
  resolveProductionChatModelChain,
  runWorkersAiAgent,
  supportsFunctionCalling,
  type ChatMessage,
} from "@/lib/ai";
import { formatMatchedActivitiesBlock } from "@/lib/chat/activity-match";
import { schemasForTools, toWorkersAiToolsParam } from "@/lib/chat/agent/tool-schemas";
import { buildToolRegistryForTurn } from "@/lib/chat/agent/tool-registry";
import { buildAgentSystemPrompt } from "@/lib/chat/agent/system-prompt";
import { executeChatTool } from "@/lib/chat/agent/tools/execute";
import type { AgentRunResult, AgentTurnContext, ChatToolName } from "@/lib/chat/agent/types";
import { MAX_AGENT_TOOL_STEPS } from "@/lib/chat/agent/types";

/** Global kill-switch only — FC models use agent path when not disabled. */
export function isChatAgentEnabled(): boolean {
  const v = process.env.CHAT_USE_AGENT;
  if (v === "0" || v === "false") return false;
  return true;
}

export function agentModeForModelId(modelId: string): "tools" | "compact" {
  if (supportsFunctionCalling(modelId)) return "tools";
  return "compact";
}

/** @deprecated Use agentModeForModelId with user-selected model id. */
export function agentModeForModelChain(modelChain: string[]): "tools" | "compact" {
  if (modelChain.some((id) => supportsFunctionCalling(id))) return "tools";
  return "compact";
}

export interface RunChatAgentOptions {
  userMessage: string;
  history: ChatMessage[] | undefined;
  ctx: AgentTurnContext;
  requestHost?: string | null;
  correlationId?: string;
  maxTokens: number;
  temperature: number;
  extraSystemDirectives?: string;
  onToken?: (token: string) => void | Promise<void>;
  emitTokensToClient?: boolean;
}

export async function runChatAgent(options: RunChatAgentOptions): Promise<AgentRunResult> {
  const modelChain = resolveProductionChatModelChain(options.requestHost);
  const mode = agentModeForModelChain(modelChain);

  if (mode === "compact") {
    return {
      reply: "",
      toolsUsed: [],
      usedAgentLoop: false,
    };
  }

  let availableTools = buildToolRegistryForTurn(options.ctx);
  let extraDirectives = options.extraSystemDirectives ?? "";
  const toolsUsed: string[] = [];

  if (options.ctx.activityMatches.length > 0) {
    const preloadedResult = await executeChatTool(
      "search_calendar_activities",
      { query: options.ctx.message },
      options.ctx
    );
    toolsUsed.push("search_calendar_activities");
    extraDirectives += `\n\n=== PRELOADED CALENDAR MATCH (authoritative — do not re-search same activity) ===\n${preloadedResult}`;
    availableTools = availableTools.filter((t) => t !== "search_calendar_activities");
  }

  const schemas = schemasForTools(availableTools);
  const workersTools = toWorkersAiToolsParam(schemas);

  const systemPrompt = buildAgentSystemPrompt(
    options.ctx,
    availableTools,
    extraDirectives
  );

  const reply = await runWorkersAiAgent({
    userMessage: options.userMessage,
    systemPrompt,
    history: options.history,
    tools: workersTools,
    requestHost: options.requestHost,
    correlationId: options.correlationId,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    maxToolSteps: MAX_AGENT_TOOL_STEPS,
    onToken: options.onToken,
    emitTokensToClient: options.emitTokensToClient,
    executeTool: async (name, args) => {
      const toolName = name as ChatToolName;
      if (!availableTools.includes(toolName)) {
        return `(tool ${name} is not available for this turn)`;
      }
      toolsUsed.push(toolName);
      return executeChatTool(toolName, args, options.ctx);
    },
  });

  return {
    reply,
    toolsUsed: [...new Set(toolsUsed)],
    usedAgentLoop: true,
  };
}
