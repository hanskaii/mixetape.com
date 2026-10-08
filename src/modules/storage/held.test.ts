import { describe, expect, it, vi } from "vitest";

vi.mock("#/database", () => ({ db: {} }));

import { heldBy } from "./files.service";

describe("files a post still holds", () => {
  const video = "r2://media/u1/1-cut.mp4";
  const thumbnail = "r2://media/u1/2-thumb.jpg";
  const loose = "r2://media/u1/3-loose.mp4";

  it("counts the post's media and the thumbnail in its metadata, nothing else", () => {
    const posts = [
      { mediaUrl: video, media: [{ url: video, kind: "video" }], metadata: { thumbnail } },
    ];
    expect(heldBy(posts, [video, thumbnail, loose])).toEqual([video, thumbnail]);
  });

  it("holds nothing without posts", () => {
    expect(heldBy([], [video])).toEqual([]);
  });
});
