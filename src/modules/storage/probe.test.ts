import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { probe } from "./probe";

// Tiny real files made with ffmpeg (see fixtures/): what platforms will actually receive.
const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, "fixtures", name)));

/** Probes a file the way storage does: through ranged reads, counting the bytes read. */
async function probed(name: string, contentType: string) {
  const bytes = fixture(name);
  let read = 0;
  const result = await probe(contentType, bytes.length, async (offset, length) => {
    const part = bytes.subarray(offset, offset + length);
    read += part.length;
    return part;
  });
  return { result, read, size: bytes.length };
}

describe("probe", () => {
  it("reads a vertical video with its moov first", async () => {
    const { result } = await probed("vertical-faststart.mp4", "video/mp4");
    expect(result).toEqual({ kind: "video", width: 360, height: 640, durationMs: 2000 });
  });

  it("finds the moov after the media data", async () => {
    const { result } = await probed("landscape-moov-at-end.mp4", "video/mp4");
    expect(result).toEqual({ kind: "video", width: 640, height: 360, durationMs: 3000 });
  });

  it("turns a phone video's rotation into its upright size", async () => {
    const { result } = await probed("phone-rotated.mov", "video/quicktime");
    expect(result).toMatchObject({ kind: "video", width: 360, height: 640, durationMs: 3000 });
  });

  it.each([
    ["portrait.jpg", "image/jpeg", 1080, 1350],
    ["wide.png", "image/png", 1200, 628],
    ["square.webp", "image/webp", 1080, 1080],
    ["small.gif", "image/gif", 320, 240],
  ])("reads the size of %s", async (name, type, width, height) => {
    const { result } = await probed(name, type);
    expect(result).toEqual({ kind: "image", width, height });
  });

  it("goes by the file, not the name it was given", async () => {
    const { result } = await probed("vertical-faststart.mp4", "application/octet-stream");
    expect(result.kind).toBe("video");
  });

  it("keeps an unknown file's kind from its type", async () => {
    const bytes = new TextEncoder().encode("not a media file at all");
    const read = async (offset: number, length: number) => bytes.subarray(offset, offset + length);
    expect(await probe("text/plain", bytes.length, read)).toEqual({ kind: "other" });
    expect(await probe("video/webm", bytes.length, read)).toEqual({ kind: "video" });
  });
});
