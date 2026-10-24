import { describe, expect, it } from "vitest";
import { ageOn, formatDate, formatPhone, parseDayFirstDate } from "./format";

describe("format helpers", () => {
  it("formats dates day-first", () => {
    expect(formatDate("1998-03-14")).toBe("14/03/1998");
  });

  it("reads day-first dates in any common separator, and ISO dates", () => {
    expect(parseDayFirstDate("14/03/1998")).toBe("1998-03-14");
    expect(parseDayFirstDate(" 4-3-1998 ")).toBe("1998-03-04");
    expect(parseDayFirstDate("14.03.1998")).toBe("1998-03-14");
    expect(parseDayFirstDate("14031998")).toBe("1998-03-14");
    expect(parseDayFirstDate("1998-03-14")).toBe("1998-03-14");
    expect(parseDayFirstDate("14/03/98")).toBeNull();
    expect(parseDayFirstDate("")).toBeNull();
  });

  it("computes age around the birthday", () => {
    expect(ageOn("1998-03-14", new Date(Date.UTC(2026, 2, 13)))).toBe(27);
    expect(ageOn("1998-03-14", new Date(Date.UTC(2026, 2, 14)))).toBe(28);
  });

  it("groups Vietnamese mobile numbers", () => {
    expect(formatPhone("+84912345678")).toBe("+84 912 345 678");
    expect(formatPhone("other")).toBe("other");
  });
});
