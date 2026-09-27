import type { SocialProvider } from "../types";
import { facebookAnalytics } from "./analytics";
import { facebookCaptions } from "./captions";
import { facebookComments } from "./comments";
import { facebookConnect } from "./connect";
import { facebookMetadata, type FacebookVideoMeta } from "./metadata";
import {
  facebookEditing,
  facebookStatus,
  facebookThumbnails,
  uploadVideo,
  videoUrl,
} from "./videos";

export type { FacebookVideoMeta } from "./metadata";

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Facebook Pages: Page videos and Reels, scheduled natively, with thumbnails, captions,
 * comments and video insights. Personal profiles cannot be posted to through the API.
 */
export const facebook: SocialProvider = {
  id: "facebook",
  name: "Facebook",
  schedulesNatively: true,
  defaultLeadMinutes: 30,
  // Facebook refuses a scheduled time under 10 minutes away; 15 leaves room for the upload.
  minLeadMinutes: 15,

  connect: facebookConnect,
  metadata: facebookMetadata,
  status: facebookStatus,
  thumbnails: facebookThumbnails,
  editing: facebookEditing,
  captions: facebookCaptions,
  comments: facebookComments,
  analytics: facebookAnalytics,

  /**
   * Publishes the video or Reel, then sets what can only be set on a video that exists —
   * the thumbnail and captions. The post is up either way, so a follow-up that fails is
   * reported as a warning instead of failing the post.
   */
  async upload(post, token, metadata) {
    const meta = metadata as FacebookVideoMeta;
    const { id, format } = await uploadVideo(post, token, metadata);

    const warnings: string[] = [];
    const thumbnailUrl = meta.thumbnailUrl;
    if (thumbnailUrl) {
      await facebookThumbnails
        .set(id, thumbnailUrl, token)
        .catch((error) => warnings.push(`Thumbnail not set: ${describe(error)}`));
    }
    for (const caption of meta.captions ?? []) {
      await facebookCaptions
        .put(id, caption, token)
        .catch((error) =>
          warnings.push(`Captions (${caption.language}) not set: ${describe(error)}`),
        );
    }
    if (warnings.length) console.warn("[Facebook]", warnings);

    return {
      platformPostId: id,
      platformUrl: videoUrl(id, format),
      responseLog: meta.publishAt
        ? `${format === "reel" ? "Reel" : "Video"} uploaded; Facebook publishes it at ${meta.publishAt}`
        : `${format === "reel" ? "Reel" : "Video"} published`,
      warning: warnings.join(" · ") || undefined,
    };
  },
};
