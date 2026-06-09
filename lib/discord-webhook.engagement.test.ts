import { describe, expect, it } from "vitest";
import { buildEngagementNotificationEmbed } from "./discord-webhook";

describe("buildEngagementNotificationEmbed", () => {
  it("includes Reason field when reason is provided", () => {
    const embed = buildEngagementNotificationEmbed({
      rating: 2,
      time: "9 Jun 2026, 3:00 pm",
      reason: "Calendar dates are hard to find on mobile.",
    });
    const reasonField = embed.fields?.find((field) => field.name === "Reason");
    expect(reasonField?.value).toBe("Calendar dates are hard to find on mobile.");
    expect(embed.fields?.some((field) => field.name === "Rating")).toBe(true);
  });

  it("omits Reason field for high ratings without reason", () => {
    const embed = buildEngagementNotificationEmbed({
      rating: 5,
      time: "9 Jun 2026, 3:00 pm",
    });
    expect(embed.fields?.some((field) => field.name === "Reason")).toBe(false);
    expect(embed.fields?.find((field) => field.name === "Rating")?.value).toBe(
      "5 out of 5 stars"
    );
  });

  it("truncates very long reasons for Discord field limits", () => {
    const longReason = "x".repeat(1100);
    const embed = buildEngagementNotificationEmbed({
      rating: 1,
      time: "now",
      reason: longReason,
    });
    const reasonField = embed.fields?.find((field) => field.name === "Reason");
    expect(reasonField?.value).toHaveLength(1024);
    expect(reasonField?.value?.endsWith("...")).toBe(true);
  });
});
