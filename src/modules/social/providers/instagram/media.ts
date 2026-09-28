import { imageUrlFor, publicMediaUrl } from "../media";
import {
  PermanentPublishError,
  type Metadata,
  type PostWithMedia,
  type StatusCapability,
} from "../types";
import { GraphApiError } from "../meta/graph";
import { ig } from "./api";
import type { InstagramReelMeta } from "./metadata";

/**
 * Reels, photos and carousels on a professional account. Instagram cannot schedule through
 * the API, so a post with a go-live time is prepared ahead as a media container — uploaded
 * and processed by Instagram, which is the slow part — and published by mixetape on the
 * minute (release). A container expires after 24 hours; the upload lead is far shorter.
 *
 * A carousel is a container of containers: each file becomes a carousel item, and those
 * go into one CAROUSEL container that carries the caption.
 */

/** Instagram takes JPEG only; anything else goes through the edge as JPEG. */
export const IMAGE_TYPES = ["image/jpeg"];

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

/** Waits until Instagram has processed the container; fails on ERROR or EXPIRED. */
async function ready(container: string, token: string) {
  const until = Date.now() + MAX_WAIT_MS;
  while (true) {
    const state = await ig<{ status_code?: string; status?: string }>(token, container, {
      params: { fields: "status_code,status" },
    });
    if (state.status_code === "FINISHED" || state.status_code === "PUBLISHED") return;
    if (state.status_code === "ERROR" || state.status_code === "EXPIRED") {
      throw new PermanentPublishError(
        `Instagram could not process the media (${state.status_code}${state.status ? `: ${state.status}` : ""})`,
      );
    }
    if (Date.now() > until) throw new Error("Instagram is still processing the media; will retry");
    await sleep(POLL_MS);
  }
}

/** Publishes a processed container; returns the live media and its link. */
export async function publishContainer(container: string, token: string, igUserId: string) {
  await ready(container, token);
  try {
    const media = await ig<{ id: string }>(token, `${igUserId}/media_publish`, {
      method: "POST",
      params: { creation_id: container },
    });
    const link = await ig<{ permalink?: string }>(token, media.id, {
      params: { fields: "permalink" },
    }).catch(() => ({ permalink: undefined }));
    return { platformPostId: media.id, platformUrl: link.permalink };
  } catch (error) {
    throw refused(error);
  }
}

async function container(
  token: string,
  igUserId: string,
  params: Record<string, string | number | boolean | undefined>,
) {
  try {
    const created = await ig<{ id: string }>(token, `${igUserId}/media`, {
      method: "POST",
      params,
    });
    return created.id;
  } catch (error) {
    throw refused(error);
  }
}

/** The container for the post: a Reel, a photo, or a carousel of both. */
async function prepare(
  post: PostWithMedia,
  token: string,
  meta: InstagramReelMeta,
  igUserId: string,
) {
  if (post.media.length > 1) {
    const children: string[] = [];
    for (const item of post.media) {
      const child = await container(
        token,
        igUserId,
        item.kind === "image"
          ? { image_url: imageUrlFor(item, IMAGE_TYPES), is_carousel_item: true }
          : { media_type: "VIDEO", video_url: publicMediaUrl(item.url), is_carousel_item: true },
      );
      await ready(child, token);
      children.push(child);
    }
    return container(token, igUserId, {
      media_type: "CAROUSEL",
      children: children.join(","),
      caption: meta.caption,
    });
  }
  const [item] = post.media;
  if (item.kind === "image")
    return container(token, igUserId, {
      image_url: imageUrlFor(item, IMAGE_TYPES),
      caption: meta.caption,
    });
  return container(token, igUserId, {
    media_type: "REELS",
    video_url: publicMediaUrl(item.url),
    caption: meta.caption,
    cover_url: meta.thumbnailUrl,
    thumb_offset: meta.coverFrameMs,
    share_to_feed: meta.shareToFeed ?? true,
  });
}

export async function uploadMedia(post: PostWithMedia, token: string, metadata: Metadata) {
  const meta = metadata as InstagramReelMeta;
  const igUserId = post.platformAccountId;
  if (!igUserId) throw new PermanentPublishError("The post has no Instagram account to go to");
  const what =
    post.media.length > 1 ? "Carousel" : post.media[0].kind === "image" ? "Photo" : "Reel";

  const prepared = await prepare(post, token, meta, igUserId);
  await ready(prepared, token);

  if (meta.publishAt) {
    return {
      platformPostId: prepared,
      responseLog: `${what} prepared; mixetape publishes it at ${meta.publishAt}`,
    };
  }
  const live = await publishContainer(prepared, token, igUserId);
  return { ...live, responseLog: `${what} published` };
}

type MediaNode = { permalink?: string; like_count?: number; comments_count?: number };

/** A published post's link and counts, or where a prepared container stands. */
export const instagramStatus: StatusCapability = {
  async fetch(id, token) {
    try {
      const media = await ig<MediaNode>(token, id, {
        params: { fields: "permalink,like_count,comments_count" },
      });
      return {
        visibility: "public",
        uploadStatus: "published",
        url: media.permalink,
        counts: { likes: media.like_count, comments: media.comments_count },
      };
    } catch (error) {
      if (!(error instanceof GraphApiError)) throw error;
      if (error.notFound)
        return { uploadStatus: "deleted", problem: "The post is no longer on Instagram" };
    }
    // Not a published media: a container still waiting for its go-live time.
    const container = await ig<{ status_code?: string; status?: string }>(token, id, {
      params: { fields: "status_code,status" },
    });
    return {
      visibility: "scheduled",
      uploadStatus: container.status_code?.toLowerCase(),
      problem:
        container.status_code === "ERROR" || container.status_code === "EXPIRED"
          ? `Instagram could not process the media (${container.status ?? container.status_code})`
          : null,
    };
  },
};
