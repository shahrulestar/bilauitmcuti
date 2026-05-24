import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { buildForwardedSearch } from "@/lib/calendar-proxy-forward";

describe("calendar-proxy-forward", () => {
  it("whitelists meta query keys and ignores unknown params", () => {
    const request = new NextRequest("http://localhost/api/v1/meta?group=A&_rsc=1");
    expect(buildForwardedSearch("v1/meta", request)).toBe("?group=A");
  });

  it("rejects invalid meta group", () => {
    const request = new NextRequest("http://localhost/api/v1/meta?group=Z");
    expect(buildForwardedSearch("v1/meta", request)).toBe("__invalid__");
  });

  it("whitelists calendar query keys", () => {
    const request = new NextRequest(
      "http://localhost/api/v1/calendar?session=B-20263&program=Diploma&foo=bar"
    );
    expect(buildForwardedSearch("v1/calendar", request)).toBe("?session=B-20263&program=Diploma");
  });

  it("normalizes boolean allSessions query", () => {
    const request = new NextRequest("http://localhost/api/v1/calendar?allSessions=yes");
    expect(buildForwardedSearch("v1/calendar", request)).toBe("?allSessions=true");
  });
});
