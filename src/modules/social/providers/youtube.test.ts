import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { YoutubeProvider } from "./youtube";
import { PermanentPublishError, type PostWithMedia } from "./types";

const MB = 1024 * 1024;
const MEDIA = "https://media.example.com/video.mp4";
const SESSION = "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=abc";

type Call = { url: string; init?: RequestInit };

/** A fetch that answers each call with the next scripted response, and records the calls. */
function scriptFetch(responses: Array<(call: Call) => Response>) {
  const calls: Call[] = [];
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init };
    calls.push(call);
    const next = responses.shift();
    if (!next) throw new Error(`Unexpected fetch: ${call.url}`);
    return next(call);
  });
  vi.stubGlobal("fetch", mock);
  return calls;
}

const header = (call: Call, name: string) => new Headers(call.init?.headers).get(name);
const bytes = (length: number) => () => new Response(new Uint8Array(length), { status: 206 });

const post = { id: "post-1", url: MEDIA, caption: null } as unknown as PostWithMedia;

describe("YoutubeProvider.upload", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout"] }));
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uploads in chunks and resumes from the offset YouTube reports", async () => {
    const size = 25 * MB;
    const calls = scriptFetch([
      () =>
        new Response(null, {
          headers: { "content-length": String(size), "content-type": "video/mp4" },
        }),
      () => new Response(null, { status: 200, headers: { location: SESSION } }),
      bytes(10 * MB),
      // YouTube kept the whole first chunk…
      () => new Response(null, { status: 308, headers: { range: `bytes=0-${10 * MB - 1}` } }),
      bytes(10 * MB),
      // …but only half of the second: the next request must start at 15 MB, not 20.
      () => new Response(null, { status: 308, headers: { range: `bytes=0-${15 * MB - 1}` } }),
      bytes(10 * MB),
      () => Response.json({ id: "vid123", kind: "youtube#video" }),
    ]);

    const result = await new YoutubeProvider().upload(post, "token", "client", "secret", {
      title: "A title",
      category: "27",
      publishAt: "2026-10-01T10:00:00.000Z",
    });

    expect(result.platformPostId).toBe("vid123");
    expect(result.platformUrl).toBe("https://www.youtube.com/watch?v=vid123");

    // A scheduled video goes up private, with YouTube publishing it at publishAt.
    const metadata = JSON.parse(String(calls[1].init?.body));
    expect(metadata.status).toEqual({
      privacyStatus: "private",
      publishAt: "2026-10-01T10:00:00.000Z",
      selfDeclaredMadeForKids: false,
    });
    expect(metadata.snippet.categoryId).toBe("27");

    const puts = calls.filter((call) => call.init?.method === "PUT");
    expect(puts.map((call) => header(call, "content-range"))).toEqual([
      `bytes 0-${10 * MB - 1}/${size}`,
      `bytes ${10 * MB}-${20 * MB - 1}/${size}`,
      `bytes ${15 * MB}-${size - 1}/${size}`,
    ]);
    const ranges = calls
      .filter((call) => header(call, "range"))
      .map((call) => header(call, "range"));
    expect(ranges.at(-1)).toBe(`bytes=${15 * MB}-${size - 1}`);
  });

  it("names a quota error so the scheduler does not retry it", async () => {
    scriptFetch([
      () => new Response(null, { headers: { "content-length": String(MB) } }),
      () =>
        Response.json(
          { error: { code: 403, errors: [{ reason: "quotaExceeded" }] } },
          { status: 403 },
        ),
    ]);

    await expect(
      new YoutubeProvider().upload(post, "token", "client", "secret", { title: "t" }),
    ).rejects.toThrow("YOUTUBE_QUOTA_EXCEEDED");
  });

  it("marks a rejected request as permanent", async () => {
    scriptFetch([
      () => new Response(null, { headers: { "content-length": String(MB) } }),
      () =>
        Response.json(
          { error: { code: 400, errors: [{ reason: "invalidTitle" }] } },
          { status: 400 },
        ),
    ]);

    await expect(
      new YoutubeProvider().upload(post, "token", "client", "secret", { title: "t" }),
    ).rejects.toBeInstanceOf(PermanentPublishError);
  });
});
