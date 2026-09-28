import { describe, expect, it } from "vitest";
import { formatBytes, formatDuration } from "./format";

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
