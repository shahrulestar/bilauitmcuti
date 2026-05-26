import {
  runWorkersAiAgent,
  supportsFunctionCalling,
  resolveProductionChatModelChain,
  type AgentChatMessage,
  type ChatMessage,
} from "@/lib/ai";
import { formatMatchedActivitiesBlock } from "@/lib/chat/activity-match";
import { schemasForTools, toWorkersAiToolsParam } from "@/lib/chat/agent/tool-schemas";
import { buildToolRegistryForTurn } from "@/lib/chat/agent/tool-registry";
import { buildAgentSystemPrompt } from "@/lib/chat/agent/system-prompt";
import { executeChatTool } from "@/lib/chat/agent/tools/execute";
import type { AgentRunResult, AgentTurnContext } from "@/lib/chat/agent/types";
import { MAX_AGENT_TOOL_STEPS } from "@/lib/chat/agent/types";

export function isChatAgentEnabled(): boolean {
  const v = process.env.CHAT_USE_AGENT;
  return v === "1" || v === "true";
}

export function agentModeForModelChain(modelChain: string[]): "tools" | "compact" {
  if (modelChain.some((id) => supportsFunctionCalling(id))) return "tools";
  return "compact";
}

export interface RunChatAgentOptions {
  userMessage: string;
  history: ChatMessage[] | undefined;
  ctx: AgentTurnContext;
  requestHost?: string | null;
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

  const availableTools = buildToolRegistryForTurn(options.ctx);
  const schemas = schemasForTools(availableTools);
  const workersTools = toWorkersAiToolsParam(schemas);

  let extraDirectives = options.extraSystemDirectives ?? "";
  if (options.ctx.activityMatches.length > 0) {
    const preloaded = formatMatchedActivitiesBlock(options.ctx.activityMatches);
    extraDirectives += `\n\n=== PRELOADED MATCH (call search_calendar_activities to confirm) ===\n${preloaded}`;
  }

  const systemPrompt = buildAgentSystemPrompt(
    options.ctx,
    availableTools,
    extraDirectives
  );

  const toolsUsed: string[] = [];

  const preloadMessages: AgentChatMessage[] = [];
  if (options.ctx.activityMatches.length > 0) {
    const preloadedResult = await executeChatTool(
      "search_calendar_activities",
      { query: options.ctx.message },
      options.ctx
    );
    toolsUsed.push("search_calendar_activities");
    preloadMessages.push({
      role: "assistant",
      content: "[Called search_calendar_activities]",
    });
    preloadMessages.push({
      role: "tool",
      name: "search_calendar_activities",
      content: preloadedResult,
    });
  }

  const reply = await runWorkersAiAgent({
    userMessage: options.userMessage,
    systemPrompt,
    history: options.history,
    preloadMessages,
    tools: workersTools,
    requestHost: options.requestHost,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    maxToolSteps: MAX_AGENT_TOOL_STEPS,
    onToken: options.onToken,
    emitTokensToClient: options.emitTokensToClient,
    executeTool: async (name, args) => {
      const toolName = name as import("@/lib/chat/agent/types").ChatToolName;
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
