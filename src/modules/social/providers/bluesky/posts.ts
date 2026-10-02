import { jpegUrl, mediaSize, mediaStream } from "../media";
import {
  InvalidInputError,
  PermanentPublishError,
  ReconnectRequiredError,
  type Comment,
  type CommentsCapability,
  type MediaItem,
  type Metadata,
  type PostWithMedia,
  type StatusCapability,
} from "../types";
import { graphemes, MAX_GRAPHEMES } from "./metadata";
import { APPVIEW } from "./oauth";
import { readSession, xrpc, XrpcError, type Session } from "./session";

/**
 * Posting to Bluesky: a record of type app.bsky.feed.post in the account's repository,
 * with the text's links, hashtags and mentions as facets, and images (uploaded as blobs)
 * or one video (processed by Bluesky's video service) embedded. Bluesky cannot hold a post
 * until a time, so mixetape creates the record at the scheduled moment. The record key is
 * derived from the post and its attempt, so a retried publish finds the record it already
 * made instead of posting twice.
 */

const IMAGE_LIMIT = 1_000_000; // bytes, Bluesky's per-image limit
const VIDEO_SERVICE = "https://video.bsky.app";
const POLL_MS = 4_000;
const MAX_WAIT_MS = 10 * 60_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Blob = { $type: "blob"; ref: { $link: string }; mimeType: string; size: number };
type StrongRef = { uri: string; cid: string };

function refused(error: unknown): Error {
  if (
    error instanceof XrpcError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 429
  )
    return new PermanentPublishError(error.message);
  return error instanceof Error ? error : new Error(String(error));
}

// ── rich text ────────────────────────────────────────────────────────────────

type Facet = {
  index: { byteStart: number; byteEnd: number };
  features: Record<string, string>[];
};

const encoder = new TextEncoder();
const byteIndex = (text: string, charIndex: number) =>
  encoder.encode(text.slice(0, charIndex)).length;

/** Links, #hashtags and @mentions in the text, as the byte ranges Bluesky wants. */
export async function facetsOf(
  text: string,
  resolve: (handle: string) => Promise<string | null>,
): Promise<Facet[]> {
  const facets: Facet[] = [];
  const range = (start: number, end: number) => ({
    byteStart: byteIndex(text, start),
    byteEnd: byteIndex(text, end),
  });

  for (const match of text.matchAll(/https?:\/\/[^\s)\]]+[^\s.,;:!?)\]'"]/g)) {
    const start = match.index ?? 0;
    facets.push({
      index: range(start, start + match[0].length),
      features: [{ $type: "app.bsky.richtext.facet#link", uri: match[0] }],
    });
  }
  for (const match of text.matchAll(
    /(^|\s)#([^\s#.,;:!?)\]]*[^\d\s#.,;:!?)\]][^\s#.,;:!?)\]]*)/gu,
  )) {
    const start = (match.index ?? 0) + match[1].length;
    facets.push({
      index: range(start, start + 1 + match[2].length),
      features: [{ $type: "app.bsky.richtext.facet#tag", tag: match[2] }],
    });
  }
  for (const match of text.matchAll(/(^|\s)@([a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+)/g)) {
    const did = await resolve(match[2]);
    if (!did) continue;
    const start = (match.index ?? 0) + match[1].length;
    facets.push({
      index: range(start, start + 1 + match[2].length),
      features: [{ $type: "app.bsky.richtext.facet#mention", did }],
    });
  }
  return facets.sort((a, b) => a.index.byteStart - b.index.byteStart);
}

async function resolveMention(handle: string) {
  const res = await fetch(
    `${APPVIEW}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
  ).catch(() => null);
  if (!res?.ok) return null;
  return ((await res.json()) as { did?: string }).did ?? null;
}

// ── record keys ──────────────────────────────────────────────────────────────

const TID_CHARS = "234567abcdefghijklmnopqrstuvwxyz";

/**
 * A record key (TID: microseconds and a clock id, base32-sortable) fixed by the post and
 * its attempt: the same publish always writes the same record.
 */
export async function recordKey(postId: string, at: Date, attempt: number) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(`${postId}:${attempt}`)),
  );
  const clockId = ((digest[0] << 8) | digest[1]) & 0x3ff;
  const micros = BigInt(at.getTime()) * 1000n + BigInt(attempt % 1000);
  let value = (micros << 10n) | BigInt(clockId);
  let key = "";
  for (let i = 0; i < 13; i++) {
    key = TID_CHARS[Number(value & 31n)] + key;
    value >>= 5n;
  }
  return key;
}

// ── media ────────────────────────────────────────────────────────────────────

/** An image's bytes within Bluesky's 1 MB, made smaller at the edge when it is not. */
async function imageBytes(item: MediaItem) {
  const { size, contentType } = await mediaSize(item.url);
  if (size <= IMAGE_LIMIT) {
    const { stream } = await mediaStream(item.url);
    return { bytes: await new Response(stream).arrayBuffer(), type: contentType };
  }
  for (const [width, quality] of [
    [2000, 85],
    [1600, 75],
    [1200, 70],
  ]) {
    const smaller = jpegUrl(item.url, width, quality);
    if (smaller === item.url) break; // not in storage: cannot be resized here
    const res = await fetch(smaller);
    const bytes = await res.arrayBuffer();
    if (res.ok && bytes.byteLength <= IMAGE_LIMIT) return { bytes, type: "image/jpeg" };
  }
  throw new PermanentPublishError(
    "Bluesky takes images up to 1 MB, and this one could not be made that small",
  );
}

async function uploadImages(session: Session, media: MediaItem[], alts: string[]) {
  const images = [];
  for (const [index, item] of media.entries()) {
    const { bytes, type } = await imageBytes(item);
    const { blob } = await xrpc<{ blob: Blob }>(session, "com.atproto.repo.uploadBlob", {
      body: bytes,
      contentType: type,
    });
    images.push({ image: blob, alt: alts[index] ?? "" });
  }
  return { $type: "app.bsky.embed.images", images };
}

type JobStatus = { jobId?: string; state?: string; blob?: Blob; error?: string; message?: string };

/** A video through Bluesky's video service, which processes it before it can be posted. */
async function uploadVideo(session: Session, item: MediaItem, alt?: string) {
  const { stream, size, contentType } = await mediaStream(item.url);
  if (size > 100 * 1024 * 1024)
    throw new PermanentPublishError("Bluesky takes videos up to 100 MB");
  // The video service acts for the account with a short-lived token from its PDS.
  const pdsHost = new URL(session.pds).hostname;
  const { token } = await xrpc<{ token: string }>(session, "com.atproto.server.getServiceAuth", {
    query: {
      aud: `did:web:${pdsHost}`,
      lxm: "com.atproto.repo.uploadBlob",
      exp: Math.floor(Date.now() / 1000) + 30 * 60,
    },
  });
  const { readable, writable } = new FixedLengthStream(size);
  void stream.pipeTo(writable);
  const url = new URL(`${VIDEO_SERVICE}/xrpc/app.bsky.video.uploadVideo`);
  url.searchParams.set("did", session.did);
  url.searchParams.set("name", `${crypto.randomUUID()}.mp4`);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
    body: readable,
  });
  let job = (await res.json().catch(() => ({}))) as JobStatus;
  // The same video uploaded before answers 409 with its job.
  if (!res.ok && !(res.status === 409 && job.jobId))
    throw new PermanentPublishError(
      `Bluesky's video service refused the video: ${job.message ?? job.error ?? res.status}`,
    );

  const until = Date.now() + MAX_WAIT_MS;
  while (!job.blob) {
    if (job.state === "JOB_STATE_FAILED")
      throw new PermanentPublishError(
        `Bluesky could not process the video: ${job.error ?? job.message ?? "failed"}`,
      );
    if (Date.now() > until) throw new Error("Bluesky is still processing the video; will retry");
    await sleep(POLL_MS);
    const status = await fetch(
      `${VIDEO_SERVICE}/xrpc/app.bsky.video.getJobStatus?jobId=${encodeURIComponent(job.jobId ?? "")}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    job = ((await status.json().catch(() => ({}))) as { jobStatus?: JobStatus }).jobStatus ?? job;
  }
  return { $type: "app.bsky.embed.video", video: job.blob, ...(alt && { alt }) };
}

// ── posts ────────────────────────────────────────────────────────────────────

const postUrl = (uri: string) => {
  const [, did, , rkey] = uri.replace("at://", "/").split("/");
  return `https://bsky.app/profile/${did}/post/${rkey}`;
};

async function createPost(
  session: Session,
  record: Record<string, unknown>,
  rkey?: string,
): Promise<StrongRef> {
  try {
    return await xrpc<StrongRef>(session, "com.atproto.repo.createRecord", {
      json: {
        repo: session.did,
        collection: "app.bsky.feed.post",
        ...(rkey && { rkey }),
        record: { $type: "app.bsky.feed.post", createdAt: new Date().toISOString(), ...record },
      },
    });
  } catch (error) {
    // Already made by an earlier attempt that lost its answer: that record is the post.
    if (rkey && error instanceof XrpcError && error.status === 400) {
      const existing = await xrpc<StrongRef>(session, "com.atproto.repo.getRecord", {
        query: { repo: session.did, collection: "app.bsky.feed.post", rkey },
      }).catch(() => null);
      if (existing) return existing;
    }
    throw error;
  }
}

export async function uploadPost(post: PostWithMedia, token: string, metadata: Metadata) {
  const session = readSession(token);
  const meta = metadata as {
    text?: string;
    langs?: string[];
    altTexts?: string[];
    contentWarning?: string;
  };
  const text = meta.text ?? post.caption ?? "";
  if (graphemes(text) > MAX_GRAPHEMES)
    throw new PermanentPublishError(`Bluesky posts are limited to ${MAX_GRAPHEMES} characters`);
  try {
    const embed = !post.media.length
      ? undefined
      : post.media[0].kind === "video"
        ? await uploadVideo(session, post.media[0], meta.altTexts?.[0])
        : await uploadImages(session, post.media, meta.altTexts ?? []);
    const facets = await facetsOf(text, resolveMention);
    const created = await createPost(
      session,
      {
        text,
        ...(facets.length && { facets }),
        ...(embed && { embed }),
        ...(meta.langs?.length && { langs: meta.langs }),
        ...(meta.contentWarning && {
          labels: {
            $type: "com.atproto.label.defs#selfLabels",
            values: [{ val: meta.contentWarning }],
          },
        }),
      },
      await recordKey(post.id, post.scheduledAt, post.attempts),
    );
    return { platformPostId: created.uri, platformUrl: postUrl(created.uri) };
  } catch (error) {
    if (error instanceof ReconnectRequiredError) throw error;
    throw refused(error);
  }
}

// ── reading posts back (public AppView) ──────────────────────────────────────

type PostView = {
  uri: string;
  cid: string;
  author: { did: string; handle: string };
  record: { text?: string; createdAt?: string; reply?: { root: StrongRef; parent: StrongRef } };
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
  quoteCount?: number;
};

async function postView(uri: string): Promise<PostView | null> {
  const res = await fetch(`${APPVIEW}/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`);
  if (!res.ok) throw new Error(`Bluesky answered ${res.status}`);
  return ((await res.json()) as { posts?: PostView[] }).posts?.[0] ?? null;
}

export const blueskyStatus: StatusCapability = {
  async fetch(uri) {
    const post = await postView(uri);
    if (!post) return { problem: "The post is no longer on Bluesky" };
    return {
      visibility: "public",
      url: postUrl(uri),
      counts: { likes: post.likeCount, comments: post.replyCount },
    };
  },
};

type ThreadView = { post?: PostView; replies?: ThreadView[] };

const comment = (view: PostView, replies?: Comment[]): Comment => ({
  id: view.uri,
  author: `@${view.author.handle}`,
  authorAccountId: view.author.did,
  text: view.record.text ?? "",
  likes: view.likeCount ?? 0,
  publishedAt: view.record.createdAt ?? "",
  replyCount: view.replyCount ?? 0,
  ...(replies && { replies }),
});

/** Replies to a post as the account, in its thread. */
async function replyTo(session: Session, uri: string, text: string) {
  const parent = await postView(uri);
  if (!parent) throw new InvalidInputError("That post is no longer on Bluesky");
  const ref = { uri: parent.uri, cid: parent.cid };
  const facets = await facetsOf(text, resolveMention);
  const created = await createPost(session, {
    text,
    ...(facets.length && { facets }),
    reply: { root: parent.record.reply?.root ?? ref, parent: ref },
  });
  return {
    id: created.uri,
    author: session.did,
    text,
    likes: 0,
    publishedAt: new Date().toISOString(),
  } satisfies Comment;
}

export const blueskyComments: CommentsCapability = {
  async list(uri, _token, { limit }) {
    const res = await fetch(
      `${APPVIEW}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=2`,
    );
    if (!res.ok) throw new Error(`Bluesky answered ${res.status}`);
    const { thread } = (await res.json()) as { thread?: ThreadView };
    return (thread?.replies ?? [])
      .filter((reply) => reply.post)
      .slice(0, limit)
      .map((reply) =>
        comment(
          reply.post!,
          (reply.replies ?? []).filter((inner) => inner.post).map((inner) => comment(inner.post!)),
        ),
      );
  },
  post: (uri, text, token) => replyTo(readSession(token), uri, text),
  reply: (uri, text, token) => replyTo(readSession(token), uri, text),
  async moderate() {
    throw new InvalidInputError("Hiding replies on Bluesky is not supported yet");
  },
};
