import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";
import { kindFromUrl } from "../formats";
import { PermanentPublishError, type PostWithMedia } from "./types";
import { instagram } from "./instagram";
import { threads } from "./threads";
import { tiktokProvider } from "./tiktok";
import { pinterestProvider } from "./pinterest";

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
const json = (call: Call) => JSON.parse(String(call.init?.body));

const post = (account: string, url = "https://media.example.com/ep.mp4", ...more: string[]) =>
  ({
    id: "p1",
    url,
    media: [url, ...more].map((item) => ({ url: item, kind: kindFromUrl(item) })),
    caption: null,
    platformAccountId: account,
  }) as unknown as PostWithMedia;

afterEach(() => vi.unstubAllGlobals());

describe("instagram", () => {
  it("prepares a Reel ahead and releases it at go-live", async () => {
    const calls = scriptFetch([
      Response.json({ id: "container-1" }),
      Response.json({ status_code: "FINISHED" }),
    ]);
    const prepared = await instagram.upload(post("ig-1"), "t", {
      caption: "Hello #reel",
      publishAt: "2026-10-02T10:00:00Z",
    });
    expect(calls[0].url.origin + calls[0].url.pathname).toBe(
      "https://graph.instagram.com/v25.0/ig-1/media",
    );
    expect(form(calls[0]).get("media_type")).toBe("REELS");
    expect(form(calls[0]).get("video_url")).toBe("https://media.example.com/ep.mp4");
    expect(prepared.platformPostId).toBe("container-1");
    expect(prepared.platformUrl).toBeUndefined();

    const releaseCalls = scriptFetch([
      Response.json({ status_code: "FINISHED" }),
      Response.json({ id: "media-9" }),
      Response.json({ permalink: "https://www.instagram.com/reel/abc/" }),
    ]);
    const live = await instagram.release!("container-1", "t", "ig-1");
    expect(releaseCalls[1].url.pathname).toBe("/v25.0/ig-1/media_publish");
    expect(form(releaseCalls[1]).get("creation_id")).toBe("container-1");
    expect(live).toEqual({
      platformPostId: "media-9",
      platformUrl: "https://www.instagram.com/reel/abc/",
    });
  });

  it("fails a container Instagram could not process", async () => {
    scriptFetch([
      Response.json({ id: "c" }),
      Response.json({ status_code: "ERROR", status: "bad codec" }),
    ]);
    await expect(instagram.upload(post("ig-1"), "t", {})).rejects.toBeInstanceOf(
      PermanentPublishError,
    );
  });

  it("connects with Instagram Login and a 60-day token", async () => {
    const calls = scriptFetch([
      Response.json({
        data: [
          {
            access_token: "short",
            user_id: "901",
            permissions:
              "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments,instagram_business_manage_insights",
          },
        ],
      }),
      Response.json({ access_token: "long", expires_in: 5_184_000 }),
      Response.json({ user_id: "17841400000000001", username: "hans", name: "Hans" }),
    ]);
    const app = { clientId: "ig-app", clientSecret: "ig-secret" };
    const { grant, accounts } = await instagram.connect.exchangeCode(app, {
      code: "c",
      redirectUri: "https://mixetape.com/api/connect/instagram/callback",
    });
    expect(calls[0].url.href).toBe("https://api.instagram.com/oauth/access_token");
    expect(form(calls[0]).get("grant_type")).toBe("authorization_code");
    expect(calls[1].url.searchParams.get("grant_type")).toBe("ig_exchange_token");
    expect(calls[2].url.origin + calls[2].url.pathname).toBe(
      "https://graph.instagram.com/v25.0/me",
    );
    expect(accounts).toEqual([
      {
        platformAccountId: "17841400000000001",
        name: "Hans",
        handle: "@hans",
        avatar: undefined,
      },
    ]);
    expect(grant).toMatchObject({ accessToken: "long", refreshToken: "long" });
    expect(grant.expiresIn).toBe(5_184_000 - 7 * 24 * 60 * 60);
  });

  it("refuses a consent that left a permission out", async () => {
    scriptFetch([
      Response.json({
        access_token: "short",
        user_id: "1",
        permissions: "instagram_business_basic",
      }),
    ]);
    await expect(
      instagram.connect.exchangeCode(
        { clientId: "a", clientSecret: "b" },
        { code: "c", redirectUri: "https://x" },
      ),
    ).rejects.toThrow("publish to Instagram");
  });

  it("limits hashtags as Instagram does", () => {
    const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ");
    expect(() => instagram.metadata.validate({ caption: tags }, null)).toThrow("30 hashtags");
  });
});

describe("threads", () => {
  it("publishes a video right away when there is no go-live time", async () => {
    const calls = scriptFetch([
      Response.json({ id: "c1" }),
      Response.json({ status: "FINISHED" }),
      Response.json({ status: "FINISHED" }),
      Response.json({ id: "post-1" }),
      Response.json({ permalink: "https://www.threads.com/@me/post/x" }),
    ]);
    const result = await threads.upload(post("th-1"), "tok", { text: "hi" });
    expect(calls[0].url.origin + calls[0].url.pathname).toBe(
      "https://graph.threads.net/v1.0/th-1/threads",
    );
    expect(form(calls[0]).get("access_token")).toBe("tok");
    expect(result).toMatchObject({
      platformPostId: "post-1",
      platformUrl: "https://www.threads.com/@me/post/x",
    });
  });

  it("keeps text within 500 characters", () => {
    expect(() => threads.metadata.validate({ text: "x".repeat(501) }, null)).toThrow("500");
  });
});

describe("tiktok", () => {
  it("uploads in chunks with the remainder in the last one", async () => {
    const size = 25 * 1024 * 1024;
    const calls = scriptFetch([
      Response.json({
        data: { privacy_level_options: ["SELF_ONLY", "PUBLIC_TO_EVERYONE"] },
        error: { code: "ok" },
      }),
      new Response(null, {
        headers: { "content-length": String(size), "content-type": "video/mp4" },
      }),
      Response.json({
        data: { publish_id: "pub-1", upload_url: "https://upload.tiktok.test/1" },
        error: { code: "ok" },
      }),
      new Response(new Uint8Array(10), { status: 206 }),
      new Response(null, { status: 206 }),
      new Response(new Uint8Array(10), { status: 206 }),
      new Response(null, { status: 201 }),
      Response.json({
        data: { status: "PUBLISH_COMPLETE", publicaly_available_post_id: [42] },
        error: { code: "ok" },
      }),
    ]);
    const result = await tiktokProvider.upload(post("open-1"), "t", { title: "clip" });

    const init = json(calls[2]);
    expect(init.post_info.privacy_level).toBe("SELF_ONLY");
    expect(init.source_info).toEqual({
      source: "FILE_UPLOAD",
      video_size: size,
      chunk_size: 10 * 1024 * 1024,
      total_chunk_count: 2,
    });
    const puts = calls.filter((call) => call.init?.method === "PUT");
    expect(puts.map((call) => new Headers(call.init?.headers).get("content-range"))).toEqual([
      `bytes 0-${10 * 1024 * 1024 - 1}/${size}`,
      `bytes ${10 * 1024 * 1024}-${size - 1}/${size}`,
    ]);
    expect(result).toMatchObject({
      platformPostId: "pub-1",
      platformUrl: "https://m.tiktok.com/v/42.html",
    });
  });

  it("refuses a privacy level the account does not allow", async () => {
    scriptFetch([
      Response.json({ data: { privacy_level_options: ["SELF_ONLY"] }, error: { code: "ok" } }),
    ]);
    await expect(
      tiktokProvider.upload(post("open-1"), "t", { privacyLevel: "PUBLIC_TO_EVERYONE" }),
    ).rejects.toThrow("cannot post as PUBLIC_TO_EVERYONE");
  });
});

describe("pinterest", () => {
  it("needs a board", () => {
    expect(() => pinterestProvider.metadata.validate({}, "caption")).toThrow("boardId");
  });

  it("pins an image by URL to the chosen board", async () => {
    const calls = scriptFetch([Response.json({ id: "pin-7" })]);
    const result = await pinterestProvider.upload(
      post("pi-1", "https://media.example.com/cover.jpg"),
      "t",
      {
        boardId: "board-1",
        title: "Cover",
      },
    );
    expect(calls[0].url.pathname).toBe("/v5/pins");
    expect(json(calls[0])).toMatchObject({
      board_id: "board-1",
      media_source: { source_type: "image_url", url: "https://media.example.com/cover.jpg" },
    });
    expect(result.platformUrl).toBe("https://www.pinterest.com/pin/pin-7/");
  });
});

describe("photos and carousels", () => {
  it("posts a JPEG to Instagram as a photo", async () => {
    const calls = scriptFetch([
      Response.json({ id: "container-1" }),
      Response.json({ status_code: "FINISHED" }),
    ]);
    await instagram.upload(post("ig-1", "https://media.example.com/a.jpg"), "t", {
      caption: "Hi",
      publishAt: "2026-10-02T10:00:00Z",
    });
    expect(form(calls[0]).get("image_url")).toBe("https://media.example.com/a.jpg");
    expect(form(calls[0]).get("media_type")).toBeNull();
    expect(form(calls[0]).get("caption")).toBe("Hi");
  });

  it("builds an Instagram carousel from item containers, caption on the carousel", async () => {
    const calls = scriptFetch([
      Response.json({ id: "child-1" }),
      Response.json({ status_code: "FINISHED" }),
      Response.json({ id: "child-2" }),
      Response.json({ status_code: "FINISHED" }),
      Response.json({ id: "carousel-1" }),
      Response.json({ status_code: "FINISHED" }),
    ]);
    const prepared = await instagram.upload(
      post("ig-1", "https://media.example.com/a.jpg", "https://media.example.com/b.mp4"),
      "t",
      { caption: "Two", publishAt: "2026-10-02T10:00:00Z" },
    );
    expect(Object.fromEntries(form(calls[0]))).toMatchObject({
      image_url: "https://media.example.com/a.jpg",
      is_carousel_item: "true",
    });
    expect(Object.fromEntries(form(calls[2]))).toMatchObject({
      media_type: "VIDEO",
      video_url: "https://media.example.com/b.mp4",
      is_carousel_item: "true",
    });
    expect(Object.fromEntries(form(calls[4]))).toMatchObject({
      media_type: "CAROUSEL",
      children: "child-1,child-2",
      caption: "Two",
    });
    expect(form(calls[0]).get("caption")).toBeNull();
    expect(prepared.platformPostId).toBe("carousel-1");
  });

  it("builds a Threads carousel the same way", async () => {
    const calls = scriptFetch([
      Response.json({ id: "c1" }),
      Response.json({ status: "FINISHED" }),
      Response.json({ id: "c2" }),
      Response.json({ status: "FINISHED" }),
      Response.json({ id: "carousel" }),
      Response.json({ status: "FINISHED" }),
    ]);
    await threads.upload(
      post("th-1", "https://media.example.com/a.png", "https://media.example.com/b.png"),
      "t",
      { text: "Pair", publishAt: "2026-10-02T10:00:00Z" },
    );
    expect(form(calls[0]).get("media_type")).toBe("IMAGE");
    expect(form(calls[0]).get("is_carousel_item")).toBe("true");
    expect(Object.fromEntries(form(calls[4]))).toMatchObject({
      media_type: "CAROUSEL",
      children: "c1,c2",
      text: "Pair",
    });
  });

  it("makes several images one carousel Pin", async () => {
    const calls = scriptFetch([Response.json({ id: "pin-8" })]);
    await pinterestProvider.upload(
      post("pi-1", "https://media.example.com/a.jpg", "https://media.example.com/b.jpg"),
      "t",
      { boardId: "board-1" },
    );
    expect(json(calls[0]).media_source).toEqual({
      source_type: "multiple_image_urls",
      items: [
        { url: "https://media.example.com/a.jpg" },
        { url: "https://media.example.com/b.jpg" },
      ],
    });
  });
});

describe("images a platform takes only as JPEG", () => {
  it("sends Instagram a stored PNG through the edge as JPEG, and a JPEG as it is", async () => {
    env.MEDIA_PUBLIC_URL = "https://media.mixetape.com";
    const calls = scriptFetch([
      Response.json({ id: "c1" }),
      Response.json({ status_code: "FINISHED" }),
      Response.json({ id: "c2" }),
      Response.json({ status_code: "FINISHED" }),
      Response.json({ id: "carousel" }),
      Response.json({ status_code: "FINISHED" }),
    ]);
    const carousel = {
      id: "p1",
      url: "r2://media/u1/a.png",
      media: [
        { url: "r2://media/u1/a.png", kind: "image", type: "image/png" },
        { url: "r2://media/u1/b.jpg", kind: "image", type: "image/jpeg" },
      ],
      caption: null,
      platformAccountId: "ig-1",
    } as unknown as PostWithMedia;
    await instagram.upload(carousel, "t", { publishAt: "2026-10-02T10:00:00Z" });
    expect(form(calls[0]).get("image_url")).toBe(
      "https://media.mixetape.com/cdn-cgi/image/format=jpeg,quality=92,fit=scale-down,width=1440/media/u1/a.png",
    );
    expect(form(calls[2]).get("image_url")).toBe("https://media.mixetape.com/media/u1/b.jpg");
  });
});
