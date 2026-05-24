import { describe, expect, it } from "vitest";
import { encodeSseEvent, parseSseBuffer } from "@/lib/chat/sse";

describe("sse helpers", () => {
  it("encodes event lines", () => {
    const line = encodeSseEvent("token", { token: "Hi" });
    expect(line).toContain("event: token");
    expect(line).toContain('"token":"Hi"');
  });

  it("parses buffered events", () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const remainder = parseSseBuffer(
      'event: done\ndata: {"reply":"ok","correlationId":"c1"}\n\n',
      (event, data) => events.push({ event, data })
    );
    expect(remainder).toBe("");
    expect(events).toHaveLength(1);
    expect(events[0]?.event).toBe("done");
  });
});
