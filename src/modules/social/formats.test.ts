import { describe, expect, it } from "vitest";
import { checkFormat, kindFromUrl } from "./formats";
import type { MediaFormats } from "./providers/types";

const instagram: MediaFormats = {
  video: true,
  image: true,
  carousel: { min: 2, max: 10, kinds: ["image", "video"] },
  imageTypes: ["image/jpeg"],
  minVideoMs: 3_000,
  maxVideoMs: 15 * 60_000,
  vertical: true,
};
const youtube: MediaFormats = { video: true, image: false };
const facebook: MediaFormats = {
  video: true,
  image: true,
  carousel: { min: 2, max: 10, kinds: ["image"] },
};

const video = (durationMs = 30_000, width = 1080, height = 1920) => ({
  kind: "video",
  contentType: "video/mp4",
  durationMs,
  width,
  height,
});
const jpeg = { kind: "image", contentType: "image/jpeg", width: 1080, height: 1350 };
const png = { kind: "image", contentType: "image/png", width: 1200, height: 628 };

describe("whether files fit a platform", () => {
  it("takes an upright video as a Reel", () => {
    expect(checkFormat("Instagram", instagram, [video()])).toEqual({
      format: "video",
      problems: [],
      warnings: [],
    });
  });

  it("allows a horizontal video where upright is expected, with a warning", () => {
    const check = checkFormat("Instagram", instagram, [video(30_000, 1920, 1080)]);
    expect(check.problems).toEqual([]);
    expect(check.warnings[0]).toMatch(/horizontal/);
  });

  it("refuses images where the platform takes only videos", () => {
    expect(checkFormat("YouTube", youtube, [jpeg]).problems).toEqual([
      "YouTube does not take images",
    ]);
  });

  it("refuses several files where the platform takes one", () => {
    expect(checkFormat("YouTube", youtube, [video(), video()]).problems[0]).toMatch(
      "one file per post",
    );
  });

  it("checks a carousel's size and kinds", () => {
    expect(checkFormat("Instagram", instagram, [jpeg, video()])).toMatchObject({
      format: "carousel",
      problems: [],
    });
    const eleven = Array.from({ length: 11 }, () => jpeg);
    expect(checkFormat("Instagram", instagram, eleven).problems[0]).toMatch("2–10 files, not 11");
    expect(checkFormat("Facebook", facebook, [jpeg, video()]).problems[0]).toMatch(
      "takes only images",
    );
  });

  it("names the image type a platform takes", () => {
    expect(checkFormat("Instagram", instagram, [png]).problems[0]).toMatch(
      "takes JPEG images, not PNG",
    );
  });

  it("checks video length", () => {
    expect(checkFormat("Instagram", instagram, [video(1_000)]).problems[0]).toMatch(
      "shorter than the 3 s",
    );
    expect(checkFormat("Instagram", instagram, [video(20 * 60_000)]).problems[0]).toMatch(
      "longer than the 15 min",
    );
  });

  it("does not hold unknown facts against a file", () => {
    expect(checkFormat("Instagram", instagram, [{ kind: "image" }]).problems).toEqual([]);
  });

  it("refuses files that are neither video nor image", () => {
    expect(checkFormat("Instagram", instagram, [{ kind: "other" }]).problems[0]).toMatch(
      "neither a video nor an image",
    );
  });

  it("tells images from videos by URL when mixetape never read the file", () => {
    expect(kindFromUrl("https://cdn.example.com/cover.JPG?x=1")).toBe("image");
    expect(kindFromUrl("r2://media/u/1-episode.mp4")).toBe("video");
  });
});
