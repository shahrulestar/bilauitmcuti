import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MODEL_WORKERS_AI_DEV,
  MODEL_WORKERS_AI_PRODUCTION,
  MODEL_WORKERS_AI_PRODUCTION_BACKUP,
  resolveProductionChatModelChain,
  resolveWorkersAiModelTier,
  shouldStreamTokensToClient,
} from "@/lib/ai";

describe("resolveProductionChatModelChain", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses Llama on dev host", () => {
    expect(resolveProductionChatModelChain("localhost:3000")).toEqual([
      MODEL_WORKERS_AI_DEV,
    ]);
  });

  it("uses Gemma then Gemini backup on production host", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveProductionChatModelChain("bilauitmcuti.com")).toEqual([
      MODEL_WORKERS_AI_PRODUCTION,
      MODEL_WORKERS_AI_PRODUCTION_BACKUP,
    ]);
  });

  it("marks production tier for bilauitmcuti.com", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveWorkersAiModelTier("bilauitmcuti.com")).toBe("production");
  });

  it("uses dev tier on localhost even when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(resolveWorkersAiModelTier("localhost:3000")).toBe("dev");
    expect(resolveProductionChatModelChain("localhost:3000")).toEqual([
      MODEL_WORKERS_AI_DEV,
    ]);
  });

  it("never streams partial tokens to the chat client", () => {
    expect(shouldStreamTokensToClient("bilauitmcuti.com")).toBe(false);
    expect(shouldStreamTokensToClient("localhost:3000")).toBe(false);
  });
});
