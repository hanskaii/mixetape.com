import {
  InvalidInputError,
  type EditingCapability,
  type StatusCapability,
  type ThumbnailCapability,
} from "../types";
import { DATA_API, UPLOAD_API, download, videoUrl, youtubeFetch } from "./api";
import { EDITABLE_FIELDS, checkChanges, type YouTubeVideoMeta } from "./metadata";

/** A video already on YouTube: where it stands, its thumbnail, and edits to its details. */

type Video = {
  id: string;
  snippet?: {
    title: string;
    description?: string;
    categoryId: string;
    tags?: string[];
    defaultLanguage?: string;
  };
  status?: {
    uploadStatus?: string;
    privacyStatus?: string;
    publishAt?: string;
    failureReason?: string;
    rejectionReason?: string;
    selfDeclaredMadeForKids?: boolean;
    madeForKids?: boolean;
    embeddable?: boolean;
    license?: string;
    publicStatsViewable?: boolean;
  };
  localizations?: Record<string, { title: string; description?: string }>;
  processingDetails?: { processingStatus?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
};

async function getVideo(videoId: string, token: string, part: string): Promise<Video | null> {
  const data = await youtubeFetch<{ items?: Video[] }>(token, `${DATA_API}/videos`, {
    query: { part, id: videoId },
  });
  return data.items?.[0] ?? null;
}

const count = (value?: string) => (value === undefined ? undefined : Number(value));

/**
 * Visibility, processing, a scheduled publishAt, any rejection, and the public counters.
 * YouTube has no field for "locked private" (uploads from an unverified OAuth app); such a
 * video simply stays private after its publishAt has passed.
 */
export const youtubeStatus: StatusCapability = {
  async fetch(videoId, token) {
    const video = await getVideo(videoId, token, "status,processingDetails,statistics");
    if (!video) return { uploadStatus: "deleted", problem: "The video is no longer on YouTube" };
    const status = video.status ?? {};
    return {
      visibility: status.privacyStatus,
      uploadStatus: status.uploadStatus ?? video.processingDetails?.processingStatus,
      publishAt: status.publishAt ?? null,
      problem: status.rejectionReason
        ? `Rejected by YouTube: ${status.rejectionReason}`
        : status.failureReason
          ? `Processing failed: ${status.failureReason}`
          : null,
      url: videoUrl(videoId),
      counts: {
        views: count(video.statistics?.viewCount),
        likes: count(video.statistics?.likeCount),
        comments: count(video.statistics?.commentCount),
      },
    };
  },
};

/** thumbnails.set (50 units). The channel must be verified for custom thumbnails. */
export const youtubeThumbnails: ThumbnailCapability = {
  async set(videoId, imageUrl, token) {
    const image = await download(imageUrl, "thumbnail image");
    const bytes = await image.arrayBuffer();
    if (bytes.byteLength > 2 * 1024 * 1024)
      throw new InvalidInputError("The thumbnail is larger than YouTube's 2 MB limit");
    const type = image.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!/^image\/(jpeg|png)$/.test(type))
      throw new InvalidInputError(`The thumbnail must be JPEG or PNG, not ${type}`);
    await youtubeFetch(token, `${UPLOAD_API}/thumbnails/set`, {
      method: "POST",
      query: { videoId, uploadType: "media" },
      headers: { "Content-Type": type },
      body: bytes,
    });
  },
};

const SNIPPET_FIELDS = ["title", "description", "category", "tags", "defaultLanguage"];
const STATUS_FIELDS = ["privacyStatus", "madeForKids"];

/**
 * videos.update (50 units). YouTube replaces a whole part on update, so the current video
 * is read first and only the changed fields are laid over it.
 */
export const youtubeEditing: EditingCapability = {
  fields: EDITABLE_FIELDS,

  async update(videoId, changes, token) {
    const edit = checkChanges(changes) as Partial<YouTubeVideoMeta>;
    const keys = Object.keys(edit);
    if (!keys.length) throw new InvalidInputError("Nothing to change");

    const video = await getVideo(videoId, token, "snippet,status,localizations");
    if (!video?.snippet || !video.status)
      throw new InvalidInputError("The video is no longer on YouTube");

    const parts: string[] = [];
    const body: Record<string, unknown> = { id: videoId };
    const touches = (fields: string[]) => keys.some((key) => fields.includes(key));

    const defaultLanguage = edit.defaultLanguage ?? video.snippet.defaultLanguage;
    if (touches(SNIPPET_FIELDS)) {
      parts.push("snippet");
      body.snippet = {
        title: edit.title ?? video.snippet.title,
        description: edit.description ?? video.snippet.description ?? "",
        categoryId: edit.category ?? video.snippet.categoryId,
        tags: edit.tags ?? video.snippet.tags ?? [],
        ...(defaultLanguage && { defaultLanguage }),
      };
    }

    if (touches(STATUS_FIELDS)) {
      const privacyStatus = edit.privacyStatus ?? video.status.privacyStatus;
      // A scheduled video keeps its publish time unless it is being made visible now.
      const publishAt =
        privacyStatus === "private" && video.status.publishAt ? video.status.publishAt : undefined;
      parts.push("status");
      body.status = {
        privacyStatus,
        ...(publishAt && { publishAt }),
        selfDeclaredMadeForKids:
          edit.madeForKids ?? video.status.selfDeclaredMadeForKids ?? video.status.madeForKids,
        embeddable: video.status.embeddable,
        license: video.status.license,
        publicStatsViewable: video.status.publicStatsViewable,
      };
    }

    if (edit.localizations) {
      if (!defaultLanguage)
        throw new InvalidInputError(
          "Set defaultLanguage (the language of title and description) to add localizations",
        );
      parts.push("localizations");
      body.localizations = { ...video.localizations, ...edit.localizations };
    }

    await youtubeFetch(token, `${DATA_API}/videos`, {
      method: "PUT",
      query: { part: parts.join(",") },
      body: JSON.stringify(body),
    });
  },
};
