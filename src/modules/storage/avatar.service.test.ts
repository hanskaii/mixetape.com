import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";

vi.mock("./upload.service", () => ({
  publicUrl: (key: string) => `https://media.example.com/${key}`,
}));

import { keepChannelAvatar } from "./avatar.service";

const stored = new Map<string, { type?: string }>();

beforeEach(() => {
  stored.clear();
  Object.assign(env, {
    BUCKET: {
      put: async (key: string, _body: ArrayBuffer, options: R2PutOptions) => {
        stored.set(key, { type: (options.httpMetadata as R2HTTPMetadata).contentType });
      },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

const picture = (type = "image/jpeg", status = 200, body = "pixels") =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status, headers: { "content-type": type } })),
  );

describe("a channel's picture in our own storage", () => {
  it("copies it under the user's avatars folder and returns our link", async () => {
    picture();
    const url = await keepChannelAvatar(
      "u1",
      "facebook",
      "page-1",
      "https://scontent.example/p.jpg",
    );
    expect(url).toMatch(
      /^https:\/\/media\.example\.com\/avatars\/u1\/facebook-[0-9a-f]{12}-[0-9a-f]{10}\.jpg$/,
    );
    expect(stored.size).toBe(1);
    expect([...stored.values()][0].type).toBe("image/jpeg");
  });

  it("saves the same picture to the same place, and a new one to a new link", async () => {
    picture();
    const a = await keepChannelAvatar("u1", "facebook", "page-1", "https://x.example/a.jpg");
    const b = await keepChannelAvatar("u1", "facebook", "page-1", "https://x.example/a.jpg");
    picture("image/jpeg", 200, "other pixels");
    const c = await keepChannelAvatar("u1", "facebook", "page-1", "https://x.example/a.jpg");
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });

  it("keeps the platform's link when it cannot copy: not a picture, an error, or a failed fetch", async () => {
    const source = "https://x.example/a";
    picture("text/html");
    expect(await keepChannelAvatar("u1", "threads", "t1", source)).toBe(source);
    picture("image/jpeg", 403);
    expect(await keepChannelAvatar("u1", "threads", "t1", source)).toBe(source);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline"))),
    );
    expect(await keepChannelAvatar("u1", "threads", "t1", source)).toBe(source);
    expect(stored.size).toBe(0);
  });

  it("leaves no link, our own link, or an http link as they are", async () => {
    expect(await keepChannelAvatar("u1", "youtube", "c1", null)).toBeNull();
    const own = "https://media.example.com/avatars/u1/youtube-abc-def.jpg";
    expect(await keepChannelAvatar("u1", "youtube", "c1", own)).toBe(own);
    expect(await keepChannelAvatar("u1", "youtube", "c1", "http://x.example/a.jpg")).toBe(
      "http://x.example/a.jpg",
    );
  });
});
