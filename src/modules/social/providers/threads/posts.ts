import { publicMediaUrl } from "../media";
import {
  PermanentPublishError,
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

export async function uploadVideo(post: PostWithMedia, token: string, metadata: Metadata) {
  const meta = metadata as ThreadsVideoMeta;
  const userId = post.platformAccountId;
  if (!userId) throw new PermanentPublishError("The post has no Threads profile to go to");

  let container: string;
  try {
    const created = await threads<{ id: string }>(token, `${userId}/threads`, {
      method: "POST",
      params: { media_type: "VIDEO", video_url: publicMediaUrl(post.url), text: meta.text },
    });
    container = created.id;
  } catch (error) {
    throw refused(error);
  }
  await ready(container, token);

  if (meta.publishAt) {
    return {
      platformPostId: container,
      responseLog: `Post prepared; mixetape publishes it at ${meta.publishAt}`,
    };
  }
  return { ...(await publishContainer(container, token, userId)), responseLog: "Post published" };
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
