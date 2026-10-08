import { describe, expect, it } from "vitest";
import {
  addDays,
  calendarTitle,
  dayKey,
  fetchRange,
  hourOf,
  shiftAnchor,
  visibleDays,
  weekday,
} from "./calendar";

describe("calendar days", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("knows the weekday, Sunday first", () => {
    expect(weekday("2026-10-04")).toBe(0);
    expect(weekday("2026-10-08")).toBe(4);
  });

  it("shows a month as whole weeks, Sunday to Saturday", () => {
    const days = visibleDays("month", "2026-10-08");
    expect(days[0]).toBe("2026-09-27");
    expect(days.at(-1)).toBe("2026-10-31");
    expect(days.length % 7).toBe(0);
    // November 2026 ends on a Monday: the grid runs to that Saturday.
    expect(visibleDays("month", "2026-11-15").at(-1)).toBe("2026-12-05");
  });

  it("shows the week around a day, and three days from it on a phone", () => {
    expect(visibleDays("week", "2026-10-08")).toEqual([
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
    ]);
    expect(visibleDays("days", "2026-10-08")).toEqual(["2026-10-08", "2026-10-09", "2026-10-10"]);
  });

  it("moves by a month, a week or three days", () => {
    expect(shiftAnchor("month", "2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftAnchor("month", "2026-01-15", -1)).toBe("2025-12-01");
    expect(shiftAnchor("week", "2026-10-08", -1)).toBe("2026-10-01");
    expect(shiftAnchor("days", "2026-10-08", 1)).toBe("2026-10-11");
  });

  it("titles a month by month and year, and the phone's days by date", () => {
    expect(calendarTitle("month", "2026-10-08")).toBe("October 2026");
    expect(calendarTitle("week", "2026-10-08")).toBe("October 2026");
    expect(calendarTitle("days", "2026-10-08")).toBe("October 8");
  });
});

describe("posts in a time zone", () => {
  // 17:30 in Jakarta is 10:30 UTC, and still the previous evening in Los Angeles.
  const at = new Date("2026-10-08T10:30:00Z");

  it("puts a post on the day and hour of the zone it is read in", () => {
    expect(dayKey(at, "Asia/Jakarta")).toBe("2026-10-08");
    expect(hourOf(at, "Asia/Jakarta")).toBe(17);
    expect(dayKey(at, "America/Los_Angeles")).toBe("2026-10-08");
    expect(hourOf(at, "America/Los_Angeles")).toBe(3);
    expect(dayKey(new Date("2026-10-08T02:00:00Z"), "America/Los_Angeles")).toBe("2026-10-07");
    expect(hourOf(new Date("2026-10-08T17:00:00Z"), "UTC")).toBe(17);
  });

  it("asks for a day either side, so no zone misses a post", () => {
    expect(fetchRange(["2026-10-04", "2026-10-10"])).toEqual({
      from: "2026-10-03T00:00:00Z",
      to: "2026-10-12T00:00:00Z",
    });
  });
});
