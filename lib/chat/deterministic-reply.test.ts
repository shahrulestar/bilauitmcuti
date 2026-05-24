import { describe, expect, it } from "vitest";
import { tryBuildDeterministicReply } from "@/lib/chat/deterministic-reply";
import type { Activity } from "@/lib/data";

const activities: Activity[] = [
  {
    name: "Cuti Pertengahan Semester",
    startDate: "2026-03-15",
    endDate: "2026-03-20",
    type: "break",
    group: "B",
  },
  {
    name: "Minggu Kuliah 1",
    startDate: "2026-02-01",
    endDate: "2026-02-07",
    type: "lecture",
    group: "B",
  },
];

describe("tryBuildDeterministicReply", () => {
  const base = {
    quickReference:
      "CURRENTLY HAPPENING: No active event right now\nNEXT BREAK: Cuti Pertengahan Semester (15 March 2026 to 20 March 2026)",
    programLabel: "Diploma",
    primaryGroup: "B" as const,
    activities,
    todayISO: "2026-02-01",
  };

  it("answers next break via quick reference", () => {
    const reply = tryBuildDeterministicReply({
      ...base,
      message: "When is the next break?",
    });
    expect(reply).toContain("Next break");
  });

  it("answers lecture week 1 from activities", () => {
    const reply = tryBuildDeterministicReply({
      ...base,
      message: "When is Lecture Week 1?",
    });
    expect(reply).toContain("Lecture Week 1");
  });
});
