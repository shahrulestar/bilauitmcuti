import { describe, expect, it } from "vitest";
import {
  detectQuickReferenceIntent,
  tryBuildQuickReferenceReply,
} from "@/lib/chat/fast-reference";

describe("detectQuickReferenceIntent", () => {
  it("detects next break", () => {
    expect(detectQuickReferenceIntent("When is the next break?")).toBe("next_break");
    expect(detectQuickReferenceIntent("Bila cuti seterusnya?")).toBe("next_break");
  });

  it("detects next exam", () => {
    expect(detectQuickReferenceIntent("Bila peperiksaan seterusnya?")).toBe("next_exam");
  });
});

describe("tryBuildQuickReferenceReply", () => {
  const quickReference = [
    "CURRENTLY HAPPENING: No active event right now",
    "NEXT BREAK: Cuti Pertengahan Semester (15 March 2026 to 20 March 2026)",
    "NEXT EXAM: Peperiksaan Akhir (1 June 2026 to 15 June 2026)",
  ].join("\n");

  it("returns formatted reply for next break", () => {
    const reply = tryBuildQuickReferenceReply({
      message: "When is the next break?",
      quickReference,
      programLabel: "Diploma",
      primaryGroup: "B",
    });
    expect(reply).toContain("Group B (Diploma)");
    expect(reply).toContain("Next break:");
    expect(reply).toContain("Cuti Pertengahan Semester");
  });

  it("returns null when intent is unknown", () => {
    const reply = tryBuildQuickReferenceReply({
      message: "Tell me about UiTM admission requirements",
      quickReference,
      programLabel: "Diploma",
      primaryGroup: "B",
    });
    expect(reply).toBeNull();
  });
});
