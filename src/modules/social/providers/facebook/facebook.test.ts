import { afterEach, describe, expect, it, vi } from "vitest";
import { InvalidInputError, PermanentPublishError, type PostWithMedia } from "../types";
import { facebookLocale } from "./captions";
import { facebook } from ".";

type Call = { url: URL; init?: RequestInit };

function scriptFetch(responses: Response[]) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: new URL(String(input)), init });
      const next = responses.shift();
      if (!next) throw new Error(`Unexpected fetch: ${String(input)}`);
      return next;
    }),
  );
  return calls;
}

const form = (call: Call) => new URLSearchParams(String(call.init?.body));

const post = {
  id: "post-1",
  url: "https://media.example.com/episode.mp4",
  media: [{ url: "https://media.example.com/episode.mp4", kind: "video" }],
  caption: null,
  platformAccountId: "page-1",
} as unknown as PostWithMedia;

afterEach(() => vi.unstubAllGlobals());

describe("facebook.metadata", () => {
  const validate = facebook.metadata.validate;

  it("uses the caption as description and drops a caller's publishAt", () => {
    expect(validate({ publishAt: "2026-10-01T00:00:00Z" }, "Hello")).toEqual({
      description: "Hello",
    });
  });

  it("refuses what Facebook would refuse", () => {
    expect(() => validate({ format: "story" }, null)).toThrow('"video" or "reel"');
    expect(() => validate({ format: "reel", title: "t" }, null)).toThrow("Reels have no title");
    expect(() => validate({ colour: "red" }, null)).toThrow('Unknown Facebook field "colour"');
    expect(() =>
      validate({ captions: [{ language: "en", url: "https://x/y.vtt" }] }, null),
    ).toThrow(InvalidInputError);
  });
});

describe("facebook.upload", () => {
  it("schedules a Page video natively with file_url", async () => {
    const calls = scriptFetch([Response.json({ id: "vid-1" })]);
    const result = await facebook.upload(post, "page-token", {
      title: "Episode 12",
      description: "About it",
      publishAt: "2026-10-02T10:30:00.000Z",
    });

    expect(calls[0].url.pathname).toBe("/v25.0/page-1/videos");
    const body = form(calls[0]);
    expect(body.get("file_url")).toBe("https://media.example.com/episode.mp4");
    expect(body.get("published")).toBe("false");
    expect(body.get("scheduled_publish_time")).toBe(
      String(Date.parse("2026-10-02T10:30:00Z") / 1000),
    );
    expect(body.get("unpublished_content_type")).toBe("SCHEDULED");
    expect(new Headers(calls[0].init?.headers).get("authorization")).toBe("Bearer page-token");
    expect(result).toMatchObject({
      platformPostId: "vid-1",
      platformUrl: "https://www.facebook.com/watch/?v=vid-1",
    });
  });

  it("publishes a Reel in three phases", async () => {
    const calls = scriptFetch([
      Response.json({
        video_id: "reel-1",
        upload_url: "https://rupload.facebook.com/video-upload/v25.0/reel-1",
      }),
      Response.json({ success: true }),
      Response.json({ success: true }),
    ]);
    const result = await facebook.upload(post, "page-token", {
      format: "reel",
      description: "Short",
    });

    expect(form(calls[0]).get("upload_phase")).toBe("start");
    expect(new Headers(calls[1].init?.headers).get("file_url")).toBe(post.url);
    expect(new Headers(calls[1].init?.headers).get("authorization")).toBe("OAuth page-token");
    const finish = form(calls[2]);
    expect(finish.get("upload_phase")).toBe("finish");
    expect(finish.get("video_state")).toBe("PUBLISHED");
    expect(finish.get("video_id")).toBe("reel-1");
    expect(result.platformUrl).toBe("https://www.facebook.com/reel/reel-1");
  });

  it("marks a refused request as permanent", async () => {
    scriptFetch([
      Response.json({ error: { message: "Invalid parameter", code: 100 } }, { status: 400 }),
    ]);
    await expect(facebook.upload(post, "t", { title: "x" })).rejects.toBeInstanceOf(
      PermanentPublishError,
    );
  });
});

describe("facebook.status", () => {
  it("reports a scheduled video and its counts", async () => {
    scriptFetch([
      Response.json({
        published: false,
        scheduled_publish_time: 1790000000,
        permalink_url: "/page/videos/vid-1/",
        status: { video_status: "ready" },
        likes: { summary: { total_count: 3 } },
        comments: { summary: { total_count: 1 } },
      }),
    ]);
    const status = await facebook.status!.fetch("vid-1", "t");
    expect(status).toMatchObject({
      visibility: "scheduled",
      uploadStatus: "ready",
      publishAt: new Date(1790000000 * 1000).toISOString(),
      url: "https://www.facebook.com/page/videos/vid-1/",
      counts: { likes: 3, comments: 1 },
    });
  });

  it("treats a missing video as deleted", async () => {
    scriptFetch([
      Response.json(
        { error: { message: "Unsupported get request", code: 100, error_subcode: 33 } },
        { status: 400 },
      ),
    ]);
    expect(await facebook.status!.fetch("gone", "t")).toMatchObject({ uploadStatus: "deleted" });
  });
});

describe("facebook comments and captions", () => {
  it("hides a comment to reject it and refuses a review queue", async () => {
    const calls = scriptFetch([Response.json({ success: true })]);
    await facebook.comments!.moderate("c1", "rejected", "t", { banAuthor: false });
    expect(form(calls[0]).get("is_hidden")).toBe("true");
    await expect(
      facebook.comments!.moderate("c1", "heldForReview", "t", { banAuthor: false }),
    ).rejects.toThrow("no review queue");
  });

  it("maps languages to Facebook locales", () => {
    expect(facebookLocale("en")).toBe("en_US");
    expect(facebookLocale("id")).toBe("id_ID");
    expect(facebookLocale("en-GB")).toBe("en_GB");
    expect(() => facebookLocale("xx")).toThrow("Facebook locale");
  });
});

describe("facebook.connect", () => {
  it("asks for the Page permissions on Facebook's own dialog", () => {
    const url = new URL(
      facebook.connect.authorizeUrl!({ clientId: "app", redirectUri: "https://m/cb", state: "s" }),
    );
    expect(url.origin + url.pathname).toBe("https://www.facebook.com/v25.0/dialog/oauth");
    expect(url.searchParams.get("scope")?.split(",")).toContain("pages_manage_posts");
  });
});

describe("facebook photos", () => {
  const photos = (...urls: string[]) =>
    ({
      ...post,
      url: urls[0],
      media: urls.map((url) => ({ url, kind: "image" })),
    }) as unknown as PostWithMedia;

  it("schedules one photo natively on the Page", async () => {
    const calls = scriptFetch([Response.json({ id: "photo-1", post_id: "page-1_post-1" })]);
    const result = await facebook.upload(photos("https://media.example.com/a.jpg"), "t", {
      description: "Hello",
      publishAt: "2026-10-02T10:00:00Z",
    });
    expect(calls[0].url.pathname).toBe("/v25.0/page-1/photos");
    expect(Object.fromEntries(form(calls[0]))).toMatchObject({
      url: "https://media.example.com/a.jpg",
      message: "Hello",
      published: "false",
      unpublished_content_type: "SCHEDULED",
      scheduled_publish_time: String(Date.parse("2026-10-02T10:00:00Z") / 1000),
    });
    expect(result.platformPostId).toBe("page-1_post-1");
    expect(result.platformUrl).toBe("https://www.facebook.com/page-1_post-1");
  });

  it("posts an album: photos held back, then one feed post attaching them", async () => {
    const calls = scriptFetch([
      Response.json({ id: "ph-1" }),
      Response.json({ id: "ph-2" }),
      Response.json({ id: "page-1_post-2" }),
    ]);
    const result = await facebook.upload(
      photos("https://media.example.com/a.jpg", "https://media.example.com/b.jpg"),
      "t",
      { description: "Two" },
    );
    expect(form(calls[0]).get("published")).toBe("false");
    expect(form(calls[0]).get("temporary")).toBeNull();
    expect(calls[2].url.pathname).toBe("/v25.0/page-1/feed");
    expect(Object.fromEntries(form(calls[2]))).toEqual({
      message: "Two",
      "attached_media[0]": '{"media_fbid":"ph-1"}',
      "attached_media[1]": '{"media_fbid":"ph-2"}',
      published: "true",
    });
    expect(result.platformPostId).toBe("page-1_post-2");
  });

  it("reads a photo post's status from the post, not a video", async () => {
    const calls = scriptFetch([
      Response.json({ is_published: false, scheduled_publish_time: 1790000000 }),
    ]);
    const status = await facebook.status!.fetch("page-1_post-1", "t");
    expect(calls[0].url.searchParams.get("fields")).toContain("is_published");
    expect(status).toMatchObject({ visibility: "scheduled", uploadStatus: "scheduled" });
  });
});
