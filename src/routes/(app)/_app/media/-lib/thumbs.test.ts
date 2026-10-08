import { describe, expect, it } from "vitest";
import { imageThumb, videoFrame } from "./thumbs";

const url = "https://media.mixetape.com/media/u1/1790-rome%20one.jpg";

describe("thumbnails at the edge", () => {
  it("resizes an image through Image Transformations, path kept encoded", () => {
    expect(imageThumb(url, 480)).toBe(
      "https://media.mixetape.com/cdn-cgi/image/width=480,fit=scale-down,format=auto,quality=80/media/u1/1790-rome%20one.jpg",
    );
  });

  it("takes a video's frame through Media Transformations", () => {
    expect(videoFrame("https://media.mixetape.com/media/u1/ep.mp4", 160)).toBe(
      "https://media.mixetape.com/cdn-cgi/media/mode=frame,time=1s,width=160/media/u1/ep.mp4",
    );
  });
});
