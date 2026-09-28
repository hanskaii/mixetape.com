import { describe, expect, it } from "vitest";
import { formatBytes, formatDuration, selectionSummary } from "./format";

describe("file sizes and durations", () => {
  it("reads sizes the way people say them", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(12.4 * 1024 * 1024)).toBe("12 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.0 GB");
  });

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
