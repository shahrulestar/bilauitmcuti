import { describe, expect, it } from "vitest";
import {
  buildCalendarAbsoluteUrl,
  buildCalendarUrlPath,
  buildSessionQueryString,
  parseSessionIdsFromSearchParams,
  resolveCleanCalendarPath,
  resolveProgramForSessionQuery,
} from "./session-query";

describe("session query URL helpers", () => {
  it("builds bare session query keys", () => {
    expect(buildSessionQueryString(["B-20263", "A-20251"])).toBe("B-20263&A-20251");
    expect(buildSessionQueryString([])).toBe("");
  });

  it("builds calendar paths with session query", () => {
    expect(buildCalendarUrlPath("/diploma", ["B-20263"])).toBe("/diploma?B-20263");
    expect(buildCalendarUrlPath("/list", ["B-20263"])).toBe("/list?B-20263");
    expect(buildCalendarUrlPath("/", ["B-20263"])).toBe("/?B-20263");
    expect(buildCalendarUrlPath("/diploma", [])).toBe("/diploma");
  });

  it("builds absolute og/share URLs", () => {
    expect(buildCalendarAbsoluteUrl("/diploma", ["B-20263"])).toBe(
      "https://bilauitmcuti.com/diploma?B-20263"
    );
    expect(buildCalendarAbsoluteUrl("/diploma/list", ["B-20263"])).toBe(
      "https://bilauitmcuti.com/diploma/list?B-20263"
    );
    expect(buildCalendarAbsoluteUrl("/", [])).toBe("https://bilauitmcuti.com");
    expect(buildCalendarAbsoluteUrl("/", ["B-20263"])).toBe(
      "https://bilauitmcuti.com/?B-20263"
    );
  });

  it("round-trips session ids from search params", () => {
    const params = new URLSearchParams("B-20263&A-20251");
    expect(parseSessionIdsFromSearchParams(params)).toEqual(["B-20263", "A-20251"]);
  });

  it("homepage session query ignores cookie Foundation and uses All for Group B", () => {
    expect(
      resolveProgramForSessionQuery("/", ["B-20263"], "Foundation/Professional")
    ).toBe("All");
    expect(resolveProgramForSessionQuery("/list", ["B-20263"], "Foundation/Professional")).toBe(
      "All"
    );
  });

  it("homepage session query uses Foundation for Group A only sessions", () => {
    expect(resolveProgramForSessionQuery("/", ["A-20251"], "All")).toBe(
      "Foundation/Professional"
    );
  });

  it("program route wins over cookie for session query", () => {
    expect(
      resolveProgramForSessionQuery("/diploma", ["B-20263"], "Foundation/Professional")
    ).toBe("Diploma");
  });

  it("redirects homepage to program route when Group A sessions consumed", () => {
    expect(
      resolveCleanCalendarPath("/", "Foundation/Professional", "grid")
    ).toBe("/foundation-professional");
    expect(resolveCleanCalendarPath("/list", "Foundation/Professional", "list")).toBe(
      "/foundation-professional/list"
    );
    expect(resolveCleanCalendarPath("/", "All", "grid")).toBe("/");
  });
});
