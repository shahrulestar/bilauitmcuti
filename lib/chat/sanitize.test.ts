import { describe, expect, it } from "vitest";
import { cleanAiReply, extractFinalAnswerFromPlanning } from "@/lib/chat/sanitize";

describe("extractFinalAnswerFromPlanning", () => {
  it("extracts text after Answer:", () => {
    const raw = `Language: English.
Answer: The Peperiksaan Intersesi exam week is from 21-09-2026 to 25-09-2026.
Language: English? Yes.`;
    expect(extractFinalAnswerFromPlanning(raw)).toBe(
      "The Peperiksaan Intersesi exam week is from 21-09-2026 to 25-09-2026."
    );
  });
});

describe("cleanAiReply", () => {
  it("strips planning monologue and keeps final answer", () => {
    const raw = `User Question: When is exam?
Language: English.
Answer: Group B (Diploma):

The exam week is 21-09-2026 to 25-09-2026.`;
    const out = cleanAiReply(raw);
    expect(out).toContain("21-09-2026");
    expect(out).not.toContain("User Question");
    expect(out).not.toMatch(/^Language:/m);
  });
});
