import { describe, expect, it } from "vitest";
import { checkLead, publishTiming } from "./timing";

const at = (iso: string) => new Date(iso).getTime();
const T = at("2026-09-25T10:00:00Z");

describe("publishTiming", () => {
  it("uploads lead minutes early and lets the platform publish on time", () => {
    expect(
      publishTiming({
        scheduledAt: T,
        leadMinutes: 30,
        native: true,
        privacy: "public",
        now: at("2026-09-24T00:00:00Z"),
      }),
    ).toEqual({ uploadAt: at("2026-09-25T09:30:00Z"), publishAt: "2026-09-25T10:00:00.000Z" });
  });

  it("treats post-now as going live after the lead, uploading at once", () => {
    const now = at("2026-09-25T09:30:00Z");
    expect(
      publishTiming({ scheduledAt: now + 30 * 60_000, leadMinutes: 30, native: true, now }),
    ).toEqual({
      uploadAt: now,
      publishAt: "2026-09-25T10:00:00.000Z",
    });
  });

  it("keeps the go-live time when a run wakes late but before it", () => {
    expect(
      publishTiming({
        scheduledAt: T,
        leadMinutes: 30,
        native: true,
        now: at("2026-09-25T09:50:00Z"),
      }),
    ).toEqual({ uploadAt: at("2026-09-25T09:30:00Z"), publishAt: "2026-09-25T10:00:00.000Z" });
  });

  it("publishes straight away when the go-live time has passed", () => {
    expect(
      publishTiming({
        scheduledAt: T,
        leadMinutes: 30,
        native: true,
        now: at("2026-09-25T10:05:00Z"),
      }),
    ).toEqual({ uploadAt: at("2026-09-25T09:30:00Z") });
  });

  it("uploads unlisted and private posts, and zero-lead posts, at their time", () => {
    const now = at("2026-09-24T00:00:00Z");
    expect(
      publishTiming({ scheduledAt: T, leadMinutes: 30, native: true, privacy: "unlisted", now }),
    ).toEqual({ uploadAt: T });
    expect(publishTiming({ scheduledAt: T, leadMinutes: 0, native: true, now })).toEqual({
      uploadAt: T,
    });
    expect(publishTiming({ scheduledAt: T, leadMinutes: 30, native: false, now })).toEqual({
      uploadAt: T,
    });
  });
});

describe("checkLead", () => {
  it("falls back when unset and rejects nonsense", () => {
    expect(checkLead(undefined, 30)).toBe(30);
    expect(checkLead(15, 30)).toBe(15);
    expect(() => checkLead(-5, 30)).toThrow();
    expect(() => checkLead(1.5, 30)).toThrow();
    expect(() => checkLead(9999, 30)).toThrow();
  });
});
