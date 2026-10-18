import { describe, expect, it } from "vitest";
import { addDays, dayKey, fetchRange, monthDays, monthTitle, shiftMonth } from "./calendar";

describe("calendar days", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("lists a month's days, the 1st to the last", () => {
    const october = monthDays("2026-10-18");
    expect(october[0]).toBe("2026-10-01");
    expect(october.at(-1)).toBe("2026-10-31");
    expect(october).toHaveLength(31);
    expect(monthDays("2028-02-10")).toHaveLength(29);
  });

  it("moves by a month, to its first day", () => {
    expect(shiftMonth("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftMonth("2026-01-15", -1)).toBe("2025-12-01");
  });

  it("titles a month by month and year", () => {
    expect(monthTitle("2026-10-08")).toBe("October 2026");
  });
});

describe("posts in a time zone", () => {
  // 10:30 UTC is 17:30 in Jakarta; 02:00 UTC is still the previous evening in Los Angeles.
  it("puts a post on the day of the zone it is read in", () => {
    expect(dayKey(new Date("2026-10-08T10:30:00Z"), "Asia/Jakarta")).toBe("2026-10-08");
    expect(dayKey(new Date("2026-10-08T02:00:00Z"), "America/Los_Angeles")).toBe("2026-10-07");
  });

  it("asks for a day either side, so no zone misses a post", () => {
    expect(fetchRange(["2026-10-01", "2026-10-31"])).toEqual({
      from: "2026-09-30T00:00:00Z",
      to: "2026-11-02T00:00:00Z",
    });
  });
});
