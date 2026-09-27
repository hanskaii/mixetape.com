import { afterEach, describe, expect, it, vi } from "vitest";
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

const post = (account: string, url = "https://media.example.com/ep.mp4") =>
  ({ id: "p1", url, caption: null, platformAccountId: account }) as unknown as PostWithMedia;

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
    expect(calls[0].url.pathname).toBe("/v25.0/ig-1/media");
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
