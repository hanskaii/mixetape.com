import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ env: {} }));
vi.mock("./media", async (original) => ({
  ...(await original<typeof import("./media")>()),
  mediaStream: vi.fn(async () => ({
    stream: new ReadableStream({ start: (c) => (c.enqueue(new Uint8Array(4)), c.close()) }),
    size: 4,
    contentType: "video/mp4",
  })),
}));
vi.mock("./bluesky/session", async (original) => ({
  ...(await original<typeof import("./bluesky/session")>()),
  xrpc: vi.fn(async () => ({ token: "service-token" })),
}));

import { uploadVideo } from "./bluesky/posts";
import type { Session } from "./bluesky/session";

// Workers' FixedLengthStream, as a plain pass-through in Node.
(globalThis as { FixedLengthStream?: unknown }).FixedLengthStream = class extends TransformStream {
  constructor(_length: number) {
    super();
  }
};

const session = { did: "did:plc:hans", pds: "https://pds.example.com" } as Session;
const video = { url: "r2://media/u/clip.mp4", kind: "video" } as const;

function scriptFetch(responses: Response[]) {
  const calls: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      calls.push(new URL(String(input)));
      const next = responses.shift();
      if (!next) throw new Error(`Unexpected fetch: ${String(input)}`);
      return next;
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Bluesky video", () => {
  it("follows the job the video service answers inside jobStatus until its blob is ready", async () => {
    vi.useFakeTimers();
    const blob = { $type: "blob", ref: { $link: "bafy" }, mimeType: "video/mp4", size: 4 };
    const calls = scriptFetch([
      Response.json({ jobStatus: { jobId: "job-1", state: "JOB_STATE_CREATED" } }),
      Response.json({ jobStatus: { jobId: "job-1", state: "JOB_STATE_COMPLETED", blob } }),
    ]);
    const pending = uploadVideo(session, video, "A clip");
    await vi.runAllTimersAsync();
    expect(await pending).toEqual({ $type: "app.bsky.embed.video", video: blob, alt: "A clip" });
    expect(calls[0].pathname).toBe("/xrpc/app.bsky.video.uploadVideo");
    expect(calls[1].searchParams.get("jobId")).toBe("job-1");
  });

  it("says what to do when the account's email is not confirmed", async () => {
    scriptFetch([
      Response.json(
        { jobStatus: { did: "", error: "unconfirmed_email", jobId: "", state: "" } },
        { status: 401 },
      ),
    ]);
    await expect(uploadVideo(session, video)).rejects.toThrow(/confirmed email/);
  });

  it("passes on any other refusal with its status and reason", async () => {
    scriptFetch([Response.json({ error: "InvalidRequest", message: "too long" }, { status: 400 })]);
    await expect(uploadVideo(session, video)).rejects.toThrow("(400): too long");
  });
});
