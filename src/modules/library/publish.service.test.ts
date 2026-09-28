import { describe, expect, it, vi } from "vitest";

vi.mock("#/database/index", () => ({ db: {} }));

import { postFields, postLabel } from "./publish.service";
import type { FileView } from "#/modules/storage/files.service";

const item = {
  title: "Why Rome burned",
  caption: "The night Rome burned.",
  description: "A longer story of 64 AD.",
  metadata: {
    tags: ["history"],
    firstComment: "Sources in the description",
    platforms: {
      youtube: { title: "Why Rome Burned in 64 AD", privacyStatus: "public" },
      instagram: { caption: "Rome, 64 AD" },
      threads: { caption: "Rome burned." },
    },
  },
};

describe("what a draft gives each platform", () => {
  it("gives YouTube the title and description, its known shared fields, then its overrides", () => {
    expect(postFields(item, "youtube")).toEqual({
      caption: "The night Rome burned.",
      metadata: {
        tags: ["history"],
        firstComment: "Sources in the description",
        title: "Why Rome Burned in 64 AD",
        description: "A longer story of 64 AD.",
        privacyStatus: "public",
      },
    });
  });

  it("leaves out shared fields a platform does not know", () => {
    const { metadata } = postFields(item, "instagram");
    expect(metadata).not.toHaveProperty("tags");
    expect(metadata).not.toHaveProperty("title");
    expect(metadata.firstComment).toBe("Sources in the description");
  });

  it("keeps Instagram's caption override as its own caption field", () => {
    expect(postFields(item, "instagram")).toMatchObject({
      caption: "The night Rome burned.",
      metadata: { caption: "Rome, 64 AD" },
    });
  });

  it("turns a caption override the platform has no field for into the post caption", () => {
    const { caption, metadata } = postFields(item, "threads");
    expect(caption).toBe("Rome burned.");
    expect(metadata).not.toHaveProperty("caption");
  });

  it("gives Facebook the title but keeps the caption as its text", () => {
    const { caption, metadata } = postFields(item, "facebook");
    expect(caption).toBe("The night Rome burned.");
    expect(metadata).toMatchObject({ title: "Why Rome burned" });
    expect(metadata).not.toHaveProperty("description");
  });

  it("uses the caption as YouTube's description when there is none", () => {
    expect(
      postFields({ title: "T", caption: "Short text", metadata: {} }, "youtube").metadata,
    ).toMatchObject({ title: "T", description: "Short text" });
  });
});

const video = (width: number, height: number, durationMs: number) =>
  ({ kind: "video", width, height, durationMs }) as FileView;
const image = { kind: "image", width: 1080, height: 1350 } as FileView;

describe("what the files make of a post", () => {
  it("names each platform's format", () => {
    expect(postLabel("youtube", [video(1080, 1920, 45_000)], {})).toBe("Short");
    expect(postLabel("youtube", [video(1920, 1080, 600_000)], {})).toBe("Video");
    expect(postLabel("instagram", [video(1080, 1920, 45_000)], {})).toBe("Reel");
    expect(postLabel("instagram", [image, image], {})).toBe("Carousel");
    expect(postLabel("facebook", [image, image], {})).toBe("Album");
    expect(postLabel("pinterest", [image], {})).toBe("Pin");
  });

  it("sends a short upright video to Facebook as a Reel, unless the draft says otherwise", () => {
    const short = [video(1080, 1920, 30_000)];
    expect(postFields({}, "facebook", short).metadata.format).toBe("reel");
    expect(
      postFields({ metadata: { platforms: { facebook: { format: "video" } } } }, "facebook", short)
        .metadata.format,
    ).toBe("video");
    expect(postFields({}, "facebook", [video(1920, 1080, 30_000)]).metadata.format).toBeUndefined();
  });
});
