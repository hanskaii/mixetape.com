import { describe, expect, it, vi } from "vitest";

vi.mock("#/database/index", () => ({ db: {} }));

import { postFields } from "./schedule.service";

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

describe("what a library item gives each platform", () => {
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

  it("gives Facebook the description as its text", () => {
    expect(postFields(item, "facebook").metadata).toMatchObject({
      title: "Why Rome burned",
      description: "A longer story of 64 AD.",
    });
  });
});
