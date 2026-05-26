import { describe, expect, it, vi, beforeEach } from "vitest";
import { agentModeForModelChain, isChatAgentEnabled } from "@/lib/chat/agent/run-agent";
import {
  MODEL_WORKERS_AI_DEV,
  MODEL_WORKERS_AI_PRODUCTION,
  MODEL_WORKERS_AI_PRODUCTION_BACKUP,
  supportsFunctionCalling,
} from "@/lib/ai";

describe("isChatAgentEnabled", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false by default", () => {
    expect(isChatAgentEnabled()).toBe(false);
  });

  it("is true when CHAT_USE_AGENT=1", () => {
    vi.stubEnv("CHAT_USE_AGENT", "1");
    expect(isChatAgentEnabled()).toBe(true);
  });
});

describe("supportsFunctionCalling", () => {
  it("enables Gemma and Gemini backup", () => {
    expect(supportsFunctionCalling(MODEL_WORKERS_AI_PRODUCTION)).toBe(true);
    expect(supportsFunctionCalling(MODEL_WORKERS_AI_PRODUCTION_BACKUP)).toBe(true);
  });

  it("disables Llama dev model", () => {
    expect(supportsFunctionCalling(MODEL_WORKERS_AI_DEV)).toBe(false);
  });
});

describe("agentModeForModelChain", () => {
  it("uses tools when chain includes a function-calling model", () => {
    expect(
      agentModeForModelChain([
        MODEL_WORKERS_AI_PRODUCTION,
        MODEL_WORKERS_AI_PRODUCTION_BACKUP,
      ])
    ).toBe("tools");
  });

  it("uses compact fallback for dev-only chain", () => {
    expect(agentModeForModelChain([MODEL_WORKERS_AI_DEV])).toBe("compact");
  });
});
