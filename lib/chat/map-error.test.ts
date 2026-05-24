import { describe, expect, it } from "vitest";
import { mapChatErrorForTest } from "@/lib/chat/map-error";

describe("mapChatError", () => {
  it("maps missing AI binding to 503 with setup hint", () => {
    const err = Object.assign(new Error("Workers AI binding not available"), { status: 503 });
    const mapped = mapChatErrorForTest(err);
    expect(mapped.status).toBe(503);
    expect(mapped.message).toContain("Workers AI is not available");
  });

  it("maps empty model response to 502", () => {
    const mapped = mapChatErrorForTest(new Error("Empty response from model"));
    expect(mapped.status).toBe(502);
    expect(mapped.message).toContain("empty reply");
  });
});
