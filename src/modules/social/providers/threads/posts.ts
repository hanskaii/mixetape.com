import { publicMediaUrl } from "../media";
import {
  PermanentPublishError,
  type MediaItem,
  type Metadata,
  type PostWithMedia,
  type StatusCapability,
} from "../types";
import { GraphApiError } from "../meta/graph";
import { threads } from "./api";
import type { ThreadsVideoMeta } from "./metadata";

/**
 * Threads posts. Like Instagram, Threads cannot schedule through the API: a post with a
 * go-live time is prepared as a processed container and published by mixetape on the
 * minute. A text-only container (a reply) needs no processing wait.
 */

const POLL_MS = 10_000;
const MAX_WAIT_MS = 20 * 60_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function refused(error: unknown): Error {
  if (
    error instanceof GraphApiError &&
    !error.rateLimited &&
    error.status >= 400 &&
    error.status < 500
  )
    return new PermanentPublishError(error.message);
  return error instanceof Error ? error : new Error(String(error));
}

async function ready(container: string, token: string) {
  const until = Date.now() + MAX_WAIT_MS;
  while (true) {
    const state = await threads<{ status?: string; error_message?: string }>(token, container, {
      params: { fields: "status,error_message" },
    });
    if (state.status === "FINISHED" || state.status === "PUBLISHED") return;
    if (state.status === "ERROR" || state.status === "EXPIRED") {
      throw new PermanentPublishError(
        `Threads could not process the post (${state.error_message ?? state.status})`,
      );
    }
    if (Date.now() > until) throw new Error("Threads is still processing the post; will retry");
    await sleep(POLL_MS);
  }
}

/** Publishes a processed container; returns the live post and its link. */
export async function publishContainer(container: string, token: string, userId: string) {
  await ready(container, token);
  try {
    const post = await threads<{ id: string }>(token, `${userId}/threads_publish`, {
      method: "POST",
      params: { creation_id: container },
    });
    const link = await threads<{ permalink?: string }>(token, post.id, {
      params: { fields: "permalink" },
    }).catch(() => ({ permalink: undefined }));
    return { platformPostId: post.id, platformUrl: link.permalink };
  } catch (error) {
    throw refused(error);
  }
}

/** Creates and publishes a text post, optionally as a reply. */
export async function publishText(token: string, userId: string, text: string, replyTo?: string) {
  const container = await threads<{ id: string }>(token, `${userId}/threads`, {
    method: "POST",
    params: { media_type: "TEXT", text, reply_to_id: replyTo },
  });
  return publishContainer(container.id, token, userId);
}

async function container(
  token: string,
  userId: string,
  params: Record<string, string | number | boolean | undefined>,
) {
  try {
    const created = await threads<{ id: string }>(token, `${userId}/threads`, {
      method: "POST",
      params,
    });
    return created.id;
  } catch (error) {
    throw refused(error);
  }
}

const source = (item: MediaItem) =>
  item.kind === "image"
    ? { media_type: "IMAGE", image_url: publicMediaUrl(item.url) }
    : { media_type: "VIDEO", video_url: publicMediaUrl(item.url) };

/**
 * A video, an image, or a carousel of both: each file of a carousel is its own item
 * container, and one CAROUSEL container carries them and the text.
 */
export async function uploadMedia(post: PostWithMedia, token: string, metadata: Metadata) {
  const meta = metadata as ThreadsVideoMeta;
  const userId = post.platformAccountId;
  if (!userId) throw new PermanentPublishError("The post has no Threads profile to go to");

  let prepared: string;
  if (post.media.length > 1) {
    const children: string[] = [];
    for (const item of post.media) {
      const child = await container(token, userId, { ...source(item), is_carousel_item: true });
      await ready(child, token);
      children.push(child);
    }
    prepared = await container(token, userId, {
      media_type: "CAROUSEL",
      children: children.join(","),
      text: meta.text,
    });
  } else prepared = await container(token, userId, { ...source(post.media[0]), text: meta.text });
  await ready(prepared, token);

  if (meta.publishAt) {
    return {
      platformPostId: prepared,
      responseLog: `Post prepared; mixetape publishes it at ${meta.publishAt}`,
    };
  }
  return { ...(await publishContainer(prepared, token, userId)), responseLog: "Post published" };
}

/** A published post's link, or where a prepared container stands. */
export const threadsStatus: StatusCapability = {
  async fetch(id, token) {
    try {
      const post = await threads<{ permalink?: string }>(token, id, {
        params: { fields: "permalink" },
      });
      if (post.permalink)
        return { visibility: "public", uploadStatus: "published", url: post.permalink };
    } catch (error) {
      if (!(error instanceof GraphApiError)) throw error;
      if (error.notFound)
        return { uploadStatus: "deleted", problem: "The post is no longer on Threads" };
    }
    const container = await threads<{ status?: string; error_message?: string }>(token, id, {
      params: { fields: "status,error_message" },
    });
    return {
      visibility: "scheduled",
      uploadStatus: container.status?.toLowerCase(),
      problem:
        container.status === "ERROR" || container.status === "EXPIRED"
          ? `Threads could not process the post (${container.error_message ?? container.status})`
          : null,
    };
  },
};
