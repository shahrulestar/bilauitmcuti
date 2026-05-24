import { describe, expect, it } from "vitest";
import {
  getRandomSuggestions,
  SUGGESTIONS_GROUP_A,
  SUGGESTIONS_GROUP_B,
} from "@/components/chat/suggestion-data";

function isShortSuggestion(text: string): boolean {
  return text.length <= 48;
}

describe("suggestion pools", () => {
  it("Group A has equal short and long counts", () => {
    const short = SUGGESTIONS_GROUP_A.filter(isShortSuggestion);
    const long = SUGGESTIONS_GROUP_A.filter((s) => !isShortSuggestion(s));
    expect(short.length).toBe(long.length);
  });

  it("Group B has equal short and long counts", () => {
    const short = SUGGESTIONS_GROUP_B.filter(isShortSuggestion);
    const long = SUGGESTIONS_GROUP_B.filter((s) => !isShortSuggestion(s));
    expect(short.length).toBe(long.length);
  });
});

describe("getRandomSuggestions", () => {
  it("returns a mix of short and long for Group A", () => {
    const picks = getRandomSuggestions("A", []);
    expect(picks).toHaveLength(5);
    const short = picks.filter(isShortSuggestion);
    const long = picks.filter((s) => !isShortSuggestion(s));
    expect(short.length).toBeGreaterThanOrEqual(2);
    expect(long.length).toBeGreaterThanOrEqual(2);
  });

  it("returns a mix of short and long for Group B", () => {
    const picks = getRandomSuggestions("B", []);
    expect(picks).toHaveLength(5);
    const short = picks.filter(isShortSuggestion);
    const long = picks.filter((s) => !isShortSuggestion(s));
    expect(short.length).toBeGreaterThanOrEqual(2);
    expect(long.length).toBeGreaterThanOrEqual(2);
  });
});
