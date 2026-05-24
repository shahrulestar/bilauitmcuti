import { describe, expect, it } from "vitest";
import { resolveCalendarContextIntent } from "@/lib/chat/calendar-intent";
import { filterActivitiesByContextIntent } from "@/lib/chat/context";
import type { Activity } from "@/lib/data";

const sample: Activity[] = [
  {
    name: "Cuti Pertengahan Semester",
    startDate: "2026-03-15",
    endDate: "2026-03-20",
    type: "break",
    group: "B",
  },
  {
    name: "Peperiksaan Akhir",
    startDate: "2026-06-01",
    type: "examination",
    group: "B",
  },
  {
    name: "Minggu Kuliah 1",
    startDate: "2026-02-01",
    type: "lecture",
    group: "B",
  },
];

describe("resolveCalendarContextIntent", () => {
  it("detects break intent", () => {
    expect(resolveCalendarContextIntent("When is the next break?")).toBe("break");
  });

  it("detects days until intent", () => {
    expect(resolveCalendarContextIntent("How many days until semester break?")).toBe(
      "days_until"
    );
  });
});

describe("filterActivitiesByContextIntent", () => {
  it("filters to breaks only", () => {
    const filtered = filterActivitiesByContextIntent(sample, "break");
    expect(filtered.every((a) => a.type === "break" || a.name.toLowerCase().includes("cuti"))).toBe(
      true
    );
  });
});
