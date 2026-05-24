import { describe, expect, it } from "vitest";
import {
  getRandomSuggestions,
  SUGGESTIONS_GROUP_A,
  SUGGESTIONS_GROUP_B,
} from "@/components/chat/suggestion-data";

const POOL_SIZE = 30;
const HALF_POOL = 15;

describe("suggestion pools", () => {
  it("Group A has 30 questions", () => {
    expect(SUGGESTIONS_GROUP_A).toHaveLength(POOL_SIZE);
  });

  it("Group B has 30 questions", () => {
    expect(SUGGESTIONS_GROUP_B).toHaveLength(POOL_SIZE);
  });
});

describe("getRandomSuggestions", () => {
  it("returns 5 suggestions from Group A pools", () => {
    const picks = getRandomSuggestions("A", []);
    expect(picks).toHaveLength(5);
    expect(picks.every((s) => SUGGESTIONS_GROUP_A.includes(s))).toBe(true);
  });

  it("returns 5 suggestions from Group B pools", () => {
    const picks = getRandomSuggestions("B", []);
    expect(picks).toHaveLength(5);
    expect(picks.every((s) => SUGGESTIONS_GROUP_B.includes(s))).toBe(true);
  });

  it("mixes first-half and second-half pools for Group A", () => {
    const firstHalf = SUGGESTIONS_GROUP_A.slice(0, HALF_POOL);
    const secondHalf = SUGGESTIONS_GROUP_A.slice(HALF_POOL);
    const picks = getRandomSuggestions("A", []);
    const fromFirst = picks.filter((s) => firstHalf.includes(s)).length;
    const fromSecond = picks.filter((s) => secondHalf.includes(s)).length;
    expect(fromFirst).toBeGreaterThanOrEqual(2);
    expect(fromSecond).toBeGreaterThanOrEqual(2);
  });

  it("mixes first-half and second-half pools for Group B", () => {
    const firstHalf = SUGGESTIONS_GROUP_B.slice(0, HALF_POOL);
    const secondHalf = SUGGESTIONS_GROUP_B.slice(HALF_POOL);
    const picks = getRandomSuggestions("B", []);
    const fromFirst = picks.filter((s) => firstHalf.includes(s)).length;
    const fromSecond = picks.filter((s) => secondHalf.includes(s)).length;
    expect(fromFirst).toBeGreaterThanOrEqual(2);
    expect(fromSecond).toBeGreaterThanOrEqual(2);
  });
});
