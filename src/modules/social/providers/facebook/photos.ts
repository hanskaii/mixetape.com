import { publicMediaUrl } from "../media";
import { PermanentPublishError, type Metadata, type PostWithMedia } from "../types";
import { GraphApiError, graph } from "../meta/graph";
import type { FacebookVideoMeta } from "./metadata";

/**
 * A Page photo, or an album post of several. Facebook fetches each image from its public
 * URL. Scheduling is native, like videos: the post waits unpublished with a
 * scheduled_publish_time. An album is its photos uploaded unpublished first, then one feed
 * post that attaches them.
 */

const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

export const postUrl = (id: string) => `https://www.facebook.com/${id}`;

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

/** Publishes or schedules the photo(s); returns the feed post's id. */
export async function uploadPhotos(post: PostWithMedia, token: string, metadata: Metadata) {
  const meta = metadata as FacebookVideoMeta;
  const pageId = post.platformAccountId;
  if (!pageId) throw new PermanentPublishError("The post has no Facebook Page to go to");
  const when = meta.publishAt ? unix(meta.publishAt) : undefined;
  const timing = {
    published: !when,
    scheduled_publish_time: when,
    unpublished_content_type: when ? "SCHEDULED" : undefined,
  };

  try {
    if (post.media.length === 1) {
      const photo = await graph<{ id: string; post_id?: string }>(token, `${pageId}/photos`, {
        method: "POST",
        params: { url: publicMediaUrl(post.url), message: meta.description, ...timing },
      });
      return photo.post_id ?? photo.id;
    }

    const attached: Record<string, string> = {};
    for (const [index, item] of post.media.entries()) {
      // Held back until the album post publishes them; `temporary` lets a scheduled post
      // attach photos that are not published yet.
      const photo = await graph<{ id: string }>(token, `${pageId}/photos`, {
        method: "POST",
        params: {
          url: publicMediaUrl(item.url),
          published: false,
          temporary: when ? true : undefined,
        },
      });
      attached[`attached_media[${index}]`] = JSON.stringify({ media_fbid: photo.id });
    }
    const feed = await graph<{ id: string }>(token, `${pageId}/feed`, {
      method: "POST",
      params: { message: meta.description, ...attached, ...timing },
    });
    return feed.id;
  } catch (error) {
    throw refused(error);
  }
}
