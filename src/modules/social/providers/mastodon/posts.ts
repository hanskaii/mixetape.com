import { mediaStream } from "../media";
import {
  InvalidInputError,
  PermanentPublishError,
  type Comment,
  type CommentsCapability,
  type Metadata,
  type PostWithMedia,
  type StatusCapability,
} from "../types";
import {
  countCharacters,
  instanceLimits,
  MastodonApiError,
  mastodon,
  plainText,
  readSession,
  type MastodonSession,
} from "./api";

/**
 * Posting to Mastodon. Mastodon can hold a scheduled status, but mixetape keeps the post
 * itself and publishes on the minute, like every platform that cannot be cancelled cleanly.
 * Each file is uploaded first (POST /api/v2/media, streamed, never held in memory); a video
 * is processed by the server before the status can carry it.
 */

const POLL_MS = 5_000;
const MAX_WAIT_MS = 10 * 60_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A 4xx other than rate limiting will not change on retry. */
function refused(error: unknown): Error {
  if (
    error instanceof MastodonApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 429
  )
    return new PermanentPublishError(error.message);
  return error instanceof Error ? error : new Error(String(error));
}

type Attachment = { id: string; url: string | null };

/** One file as multipart/form-data, streamed straight from storage. */
async function uploadFile(session: MastodonSession, url: string, description?: string) {
  const { stream, size, contentType } = await mediaStream(url);
  const limits = await instanceLimits(session.server);
  const limit = contentType.startsWith("video/") ? limits.videoSizeLimit : limits.imageSizeLimit;
  if (size > limit)
    throw new PermanentPublishError(
      `${new URL(session.server).hostname} takes files up to ${Math.floor(limit / 1024 / 1024)} MB; this one is ${Math.ceil(size / 1024 / 1024)} MB`,
    );

  const boundary = `mixetape${crypto.randomUUID().replace(/-/g, "")}`;
  const encoder = new TextEncoder();
  const extension = contentType.split("/")[1]?.split(";")[0] ?? "bin";
  const head = encoder.encode(
    (description
      ? `--${boundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\n${description}\r\n`
      : "") +
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="media.${extension}"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = encoder.encode(`\r\n--${boundary}--\r\n`);
  const { readable, writable } = new FixedLengthStream(head.length + size + tail.length);
  void (async () => {
    const writer = writable.getWriter();
    await writer.write(head);
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await writer.write(value);
    }
    await writer.write(tail);
    await writer.close();
  })();

  const media = await mastodon<Attachment>(session, "/api/v2/media", {
    method: "POST",
    body: readable,
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
  });
  // Images are ready at once; a video answers 202 and is processed first.
  const until = Date.now() + MAX_WAIT_MS;
  let current = media;
  while (!current.url) {
    if (Date.now() > until) throw new Error("Mastodon is still processing the video; will retry");
    await sleep(POLL_MS);
    current = await mastodon<Attachment>(session, `/api/v1/media/${media.id}`);
  }
  return current.id;
}

export async function uploadPost(post: PostWithMedia, token: string, metadata: Metadata) {
  const session = readSession(token);
  const meta = metadata as {
    text?: string;
    visibility?: string;
    spoilerText?: string;
    sensitive?: boolean;
    language?: string;
    altTexts?: string[];
  };
  const text = meta.text ?? post.caption ?? "";
  const limits = await instanceLimits(session.server);
  if (countCharacters(text, limits.urlLength) > limits.maxCharacters)
    throw new PermanentPublishError(
      `${new URL(session.server).hostname} takes posts of up to ${limits.maxCharacters} characters`,
    );
  if (post.media.length > limits.maxMedia)
    throw new PermanentPublishError(
      `${new URL(session.server).hostname} takes up to ${limits.maxMedia} files a post`,
    );

  try {
    const mediaIds: string[] = [];
    for (const [index, item] of post.media.entries())
      mediaIds.push(await uploadFile(session, item.url, meta.altTexts?.[index]));
    const status = await mastodon<{ id: string; url?: string; uri?: string }>(
      session,
      "/api/v1/statuses",
      {
        json: {
          status: text,
          media_ids: mediaIds,
          visibility: meta.visibility ?? "public",
          ...(meta.spoilerText && { spoiler_text: meta.spoilerText }),
          ...(meta.sensitive !== undefined && { sensitive: meta.sensitive }),
          ...(meta.language && { language: meta.language }),
        },
        // A retried publish does not post twice: the server remembers the key for an hour.
        headers: { "Idempotency-Key": `mixetape-${post.id}-${post.attempts}` },
      },
    );
    return { platformPostId: status.id, platformUrl: status.url ?? status.uri };
  } catch (error) {
    throw refused(error);
  }
}

type Status = {
  id: string;
  url?: string;
  visibility?: string;
  content?: string;
  created_at?: string;
  in_reply_to_id?: string | null;
  replies_count?: number;
  reblogs_count?: number;
  favourites_count?: number;
  account?: { id: string; acct: string };
};

export const mastodonStatus: StatusCapability = {
  async fetch(statusId, token) {
    try {
      const status = await mastodon<Status>(readSession(token), `/api/v1/statuses/${statusId}`);
      return {
        visibility: status.visibility,
        url: status.url,
        counts: {
          likes: status.favourites_count,
          comments: status.replies_count,
        },
      };
    } catch (error) {
      if (error instanceof MastodonApiError && error.status === 404)
        return { problem: "The post is no longer on Mastodon" };
      throw error;
    }
  },
};

const comment = (status: Status, replies?: Comment[]): Comment => ({
  id: status.id,
  author: `@${status.account?.acct ?? "unknown"}`,
  authorAccountId: status.account?.id,
  text: plainText(status.content ?? ""),
  likes: status.favourites_count ?? 0,
  publishedAt: status.created_at ?? "",
  replyCount: status.replies_count ?? 0,
  ...(replies && { replies }),
});

/** Replies to a status, visible like the status itself; another person's gets a mention. */
async function replyTo(session: MastodonSession, statusId: string, text: string) {
  const parent = await mastodon<Status>(session, `/api/v1/statuses/${statusId}`);
  const me = await mastodon<{ id: string }>(session, "/api/v1/accounts/verify_credentials");
  const mention =
    parent.account && parent.account.id !== me.id && !text.includes(`@${parent.account.acct}`)
      ? `@${parent.account.acct} `
      : "";
  const status = await mastodon<Status>(session, "/api/v1/statuses", {
    json: {
      status: `${mention}${text}`,
      in_reply_to_id: statusId,
      visibility: parent.visibility === "public" ? "unlisted" : (parent.visibility ?? "unlisted"),
    },
  });
  return comment(status);
}

export const mastodonComments: CommentsCapability = {
  async list(statusId, token, { limit }) {
    const session = readSession(token);
    const context = await mastodon<{ descendants?: Status[] }>(
      session,
      `/api/v1/statuses/${statusId}/context`,
    );
    const replies = context.descendants ?? [];
    return replies
      .filter((status) => status.in_reply_to_id === statusId)
      .slice(0, limit)
      .map((status) =>
        comment(
          status,
          replies
            .filter((reply) => reply.in_reply_to_id === status.id)
            .map((reply) => comment(reply)),
        ),
      );
  },
  post: (statusId, text, token) => replyTo(readSession(token), statusId, text),
  reply: (commentId, text, token) => replyTo(readSession(token), commentId, text),
  async moderate() {
    throw new InvalidInputError("Mastodon does not let an account hide or remove others' replies");
  },
};
