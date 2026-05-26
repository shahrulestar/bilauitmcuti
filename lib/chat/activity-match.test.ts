import { describe, expect, it } from "vitest";
import {
  formatMatchedActivitiesBlock,
  matchActivitiesInMessage,
} from "@/lib/chat/activity-match";
import type { Activity } from "@/lib/data";

const peperiksaan: Activity = {
  name: "Peperiksaan Akhir",
  startDate: "2026-06-29",
  endDate: "2026-07-12",
  type: "examination",
};

const cutiPertengahan: Activity = {
  name: "Cuti Pertengahan Semester",
  startDate: "2026-04-13",
  endDate: "2026-04-19",
  type: "break",
};

describe("matchActivitiesInMessage", () => {
  it("matches exact activity name in bila question", () => {
    const matches = matchActivitiesInMessage("bila Peperiksaan Akhir?", [
      { activity: peperiksaan, sessionId: "B-20263" },
      { activity: cutiPertengahan, sessionId: "B-20263" },
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.activity.name).toBe("Peperiksaan Akhir");
  });

  it("matches when user copies full title with cuti in name", () => {
    const matches = matchActivitiesInMessage("bila Cuti Pertengahan Semester", [
      { activity: cutiPertengahan, sessionId: "B-20263" },
      { activity: peperiksaan, sessionId: "B-20263" },
    ]);
    expect(matches.some((m) => m.activity.name.includes("Cuti Pertengahan"))).toBe(true);
  });

  it("does not match unrelated short question", () => {
    const matches = matchActivitiesInMessage("hello", [
      { activity: peperiksaan, sessionId: "B-20263" },
    ]);
    expect(matches).toHaveLength(0);
  });
});

describe("formatMatchedActivitiesBlock", () => {
  it("includes authoritative header and dates", () => {
    const block = formatMatchedActivitiesBlock([
      { activity: peperiksaan, sessionId: "B-20263", score: 100 },
    ]);
    expect(block).toContain("MATCHED ACTIVITIES");
    expect(block).toContain("Peperiksaan Akhir");
    expect(block).toContain("29 Jun 2026");
  });
});
