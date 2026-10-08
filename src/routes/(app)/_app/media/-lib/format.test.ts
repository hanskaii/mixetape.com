import { describe, expect, it } from "vitest";
import { formatDuration, selectionSummary } from "./format";

describe("durations", () => {
  it("writes durations as a clock", () => {
    expect(formatDuration(42_000)).toBe("0:42");
    expect(formatDuration(61_400)).toBe("1:01");
    expect(formatDuration(3_725_000)).toBe("1:02:05");
  });
});

describe("what a selection is", () => {
  const image = { kind: "image", width: 1080, height: 1350, durationMs: null };
  it("names a single video by its shape and length", () => {
    expect(
      selectionSummary([{ kind: "video", width: 1080, height: 1920, durationMs: 42_000 }]),
    ).toBe("Vertical video · 0:42");
    expect(
      selectionSummary([{ kind: "video", width: 1920, height: 1080, durationMs: 723_000 }]),
    ).toBe("Landscape video · 12:03");
  });

  it("calls several files a carousel", () => {
    expect(selectionSummary([image, image, image])).toBe("Carousel · 3 images");
    expect(
      selectionSummary([image, { kind: "video", width: 1, height: 2, durationMs: 1000 }]),
    ).toBe("Carousel · 1 image + 1 video");
  });
});
