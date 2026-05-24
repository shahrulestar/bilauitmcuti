import { describe, expect, it } from "vitest";
import { getModelResponseBudget } from "@/lib/chat/ai-retry";

describe("getModelResponseBudget", () => {
  const ceiling = 4096;

  it("caps simple calendar questions", () => {
    const budget = getModelResponseBudget("When is the next break?", true, false, ceiling);
    expect(budget.maxTokens).toBe(384);
    expect(budget.temperature).toBe(0.1);
  });

  it("caps table/compare requests", () => {
    const budget = getModelResponseBudget("Compare sessions in a table", true, true, ceiling);
    expect(budget.maxTokens).toBe(1536);
  });

  it("caps detailed calendar questions higher than simple", () => {
    const budget = getModelResponseBudget("Explain all breaks in detail", true, false, ceiling);
    expect(budget.maxTokens).toBe(3072);
  });

  it("raises cap for long user messages", () => {
    const long = "a".repeat(400);
    const budget = getModelResponseBudget(long, true, false, ceiling);
    expect(budget.maxTokens).toBe(3072);
  });

  it("caps research prompts", () => {
    const budget = getModelResponseBudget("What faculties are at UiTM?", false, false, ceiling);
    expect(budget.maxTokens).toBe(2048);
  });
});
