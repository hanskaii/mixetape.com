import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ env: {} }));

import { facetsOf, recordKey } from "./bluesky/posts";
import { blueskyMetadata } from "./bluesky/metadata";
import { clientFor } from "./bluesky/oauth";
import { countCharacters, serverOf } from "./mastodon/api";
import { mastodonMetadata } from "./mastodon/metadata";

const bytes = (text: string, start: number, end: number) =>
  new TextDecoder().decode(new TextEncoder().encode(text).slice(start, end));

describe("Bluesky", () => {
  it("marks links, hashtags and mentions by byte, past multi-byte characters", async () => {
    const text = "Héllo 🌍 #mixetape see https://mixetape.com/docs and @hans.bsky.social!";
    const facets = await facetsOf(text, async (handle) =>
      handle === "hans.bsky.social" ? "did:plc:hans" : null,
    );
    expect(facets.map((facet) => bytes(text, facet.index.byteStart, facet.index.byteEnd))).toEqual([
      "#mixetape",
      "https://mixetape.com/docs",
      "@hans.bsky.social",
    ]);
    expect(facets[0].features[0]).toEqual({
      $type: "app.bsky.richtext.facet#tag",
      tag: "mixetape",
    });
    expect(facets[2].features[0]).toEqual({
      $type: "app.bsky.richtext.facet#mention",
      did: "did:plc:hans",
    });
  });

  it("leaves out mentions it cannot resolve, and numbers that are not hashtags", async () => {
    const facets = await facetsOf("@nobody.example #2024", async () => null);
    expect(facets).toEqual([]);
  });

  it("makes the same record key for the same post and attempt, a valid TID", async () => {
    const at = new Date("2026-10-03T10:00:00Z");
    const key = await recordKey("post-1", at, 1);
    expect(key).toMatch(/^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/);
    expect(await recordKey("post-1", at, 1)).toBe(key);
    expect(await recordKey("post-1", at, 2)).not.toBe(key);
    expect(await recordKey("post-2", at, 1)).not.toBe(key);
  });

  it("counts characters as people see them (300)", () => {
    expect(() => blueskyMetadata.validate({ text: "👩‍👩‍👧".repeat(300) }, null)).not.toThrow();
    expect(() => blueskyMetadata.validate({ text: "a".repeat(301) }, null)).toThrow(/300/);
    expect(blueskyMetadata.validate({}, "From the caption")).toEqual({ text: "From the caption" });
  });

  it("is a development client locally, and a confidential one with its key elsewhere", () => {
    const local = clientFor("", "http://localhost:3001/api/connect/bluesky/callback");
    expect(local.key).toBeUndefined();
    expect(local.redirectUri).toBe("http://127.0.0.1:3001/api/connect/bluesky/callback");
    expect(local.clientId.startsWith("http://localhost?")).toBe(true);

    const key = JSON.stringify({ kty: "EC", crv: "P-256", x: "x", y: "y", d: "d", kid: "k1" });
    const live = clientFor(key, "https://mixetape.com/api/connect/bluesky/callback");
    expect(live.clientId).toBe("https://mixetape.com/api/connect/bluesky/client-metadata.json");
    expect(live.key?.kid).toBe("k1");
  });
});

describe("Mastodon", () => {
  it("finds the server from whatever the person typed", () => {
    for (const input of [
      "mastodon.social",
      "https://mastodon.social/",
      "@hans@mastodon.social",
      "hans@mastodon.social",
    ])
      expect(serverOf(input)).toBe("https://mastodon.social");
    expect(() => serverOf("not a server")).toThrow();
    expect(() => serverOf("127.0.0.1")).toThrow();
  });

  it("counts every link as the server's fixed length", () => {
    expect(countCharacters("see https://example.com/a/very/long/path ok", 23)).toBe(4 + 23 + 3);
  });

  it("checks its fields", () => {
    expect(mastodonMetadata.validate({ visibility: "unlisted", language: "id" }, "Halo")).toEqual({
      visibility: "unlisted",
      language: "id",
      text: "Halo",
    });
    expect(() => mastodonMetadata.validate({ visibility: "direct" }, null)).toThrow(/visibility/);
    expect(() => mastodonMetadata.validate({ title: "x" }, null)).toThrow(/Unknown/);
  });
});
