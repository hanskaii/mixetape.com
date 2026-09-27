import { publicMediaUrl } from "../media";
import {
  InvalidInputError,
  PermanentPublishError,
  type EditingCapability,
  type Metadata,
  type PostWithMedia,
  type StatusCapability,
  type ThumbnailCapability,
} from "../types";
import { GraphApiError, download, graph } from "../meta/graph";
import { EDITABLE_FIELDS, checkChanges, type FacebookVideoMeta } from "./metadata";

/**
 * A Page video or Reel: publishing it, where it stands, its thumbnail and edits.
 *
 * Facebook pulls the file itself from a public URL (file_url), so a video in mixetape's
 * bucket is handed over by its media.mixetape.com address. Scheduling is native: a video
 * waits unpublished with scheduled_publish_time (10 minutes to 6 months ahead), a Reel with
 * video_state SCHEDULED (10 minutes to 29 days ahead).
 */

export const videoUrl = (id: string, format: "video" | "reel") =>
  format === "reel"
    ? `https://www.facebook.com/reel/${id}`
    : `https://www.facebook.com/watch/?v=${id}`;

const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

/** A refused request that a retry cannot fix fails the post at once. */
function publishError(error: unknown): Error {
  if (
    error instanceof GraphApiError &&
    !error.rateLimited &&
    error.status >= 400 &&
    error.status < 500
  )
    return new PermanentPublishError(error.message);
  return error instanceof Error ? error : new Error(String(error));
}

export async function uploadVideo(post: PostWithMedia, token: string, metadata: Metadata) {
  const meta = metadata as FacebookVideoMeta;
  const pageId = post.platformAccountId;
  if (!pageId) throw new PermanentPublishError("The post has no Facebook Page to go to");
  const fileUrl = publicMediaUrl(post.url);
  const format = meta.format ?? "video";
  const when = meta.publishAt ? unix(meta.publishAt) : undefined;

  try {
    if (format === "reel") {
      const started = await graph<{ video_id: string; upload_url: string }>(
        token,
        `${pageId}/video_reels`,
        {
          method: "POST",
          params: { upload_phase: "start" },
        },
      );
      // The file goes to Facebook's upload host, which fetches it from file_url.
      const upload = await fetch(started.upload_url, {
        method: "POST",
        headers: { Authorization: `OAuth ${token}`, file_url: fileUrl },
      });
      if (!upload.ok)
        throw new Error(`Facebook Reel upload failed: ${upload.status} ${await upload.text()}`);
      await graph(token, `${pageId}/video_reels`, {
        method: "POST",
        params: {
          upload_phase: "finish",
          video_id: started.video_id,
          video_state: when ? "SCHEDULED" : "PUBLISHED",
          scheduled_publish_time: when,
          description: meta.description,
        },
      });
      return { id: started.video_id, format };
    }

    const created = await graph<{ id: string }>(token, `${pageId}/videos`, {
      method: "POST",
      params: {
        file_url: fileUrl,
        title: meta.title,
        description: meta.description,
        published: !when,
        scheduled_publish_time: when,
        unpublished_content_type: when ? "SCHEDULED" : undefined,
      },
    });
    return { id: created.id, format };
  } catch (error) {
    throw publishError(error);
  }
}

type VideoNode = {
  published?: boolean;
  scheduled_publish_time?: number;
  permalink_url?: string;
  status?: {
    video_status?: string;
    processing_phase?: { status?: string; errors?: { message?: string }[] };
    publishing_phase?: { status?: string; publish_status?: string };
  };
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
};

/** Where a video stands: published or scheduled, processing, any error, and its counts. */
export const facebookStatus: StatusCapability = {
  async fetch(videoId, token) {
    let video: VideoNode;
    try {
      video = await graph<VideoNode>(token, videoId, {
        params: {
          fields:
            "published,scheduled_publish_time,permalink_url,status,likes.summary(true).limit(0),comments.summary(true).limit(0)",
        },
      });
    } catch (error) {
      if (error instanceof GraphApiError && error.notFound)
        return { uploadStatus: "deleted", problem: "The video is no longer on Facebook" };
      throw error;
    }
    const failed = video.status?.video_status === "error";
    return {
      visibility: video.published
        ? "public"
        : video.scheduled_publish_time
          ? "scheduled"
          : "unpublished",
      uploadStatus: video.status?.video_status,
      publishAt: video.scheduled_publish_time
        ? new Date(video.scheduled_publish_time * 1000).toISOString()
        : null,
      problem: failed
        ? `Processing failed: ${video.status?.processing_phase?.errors?.[0]?.message ?? "Facebook could not process the video"}`
        : null,
      url: video.permalink_url
        ? new URL(video.permalink_url, "https://www.facebook.com").toString()
        : `https://www.facebook.com/${videoId}`,
      counts: {
        likes: video.likes?.summary?.total_count,
        comments: video.comments?.summary?.total_count,
      },
    };
  },
};

/** A custom thumbnail, uploaded as the preferred one. */
export const facebookThumbnails: ThumbnailCapability = {
  async set(videoId, imageUrl, token) {
    const image = await download(imageUrl, "thumbnail image");
    const type = image.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!/^image\/(jpeg|png)$/.test(type))
      throw new InvalidInputError(`The thumbnail must be JPEG or PNG, not ${type}`);
    const body = new FormData();
    body.set(
      "source",
      new Blob([await image.arrayBuffer()], { type }),
      type === "image/png" ? "thumb.png" : "thumb.jpg",
    );
    await graph(token, `${videoId}/thumbnails`, {
      method: "POST",
      params: { is_preferred: true },
      body,
    });
  },
};

/** Title and description of a video already on Facebook. */
export const facebookEditing: EditingCapability = {
  fields: EDITABLE_FIELDS,
  async update(videoId, changes, token) {
    const edit = checkChanges(changes) as Partial<FacebookVideoMeta>;
    if (!Object.keys(edit).length) throw new InvalidInputError("Nothing to change");
    await graph(token, videoId, {
      method: "POST",
      params: { name: edit.title, description: edit.description },
    });
  },
};
