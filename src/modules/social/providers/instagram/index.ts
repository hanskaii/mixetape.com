import type { SocialProvider } from "../types";
import { instagramAnalytics } from "./analytics";
import { instagramComments } from "./comments";
import { instagramConnect } from "./connect";
import { publishContainer, instagramStatus, uploadMedia } from "./media";
import { instagramMetadata } from "./metadata";

export type { InstagramReelMeta } from "./metadata";

/**
 * Instagram professional accounts, connected with Instagram Login: videos post as Reels,
 * JPEG images as photos, several files as a carousel — prepared ahead and published by
 * mixetape at go-live (the API cannot schedule), with comments and insights. The cover
 * is set at creation; captions cannot be edited through the API afterwards.
 */
export const instagram: SocialProvider = {
  id: "instagram",
  name: "Instagram",
  // mixetape holds the time itself: the Reel is prepared `leadMinutes` early and released.
  schedulesNatively: true,
  defaultLeadMinutes: 15,

  connect: instagramConnect,
  metadata: instagramMetadata,
  // Reels (3 s–15 min), JPEG photos, and carousels of 2–10 photos and videos.
  formats: {
    video: true,
    image: true,
    carousel: { min: 2, max: 10, kinds: ["image", "video"] },
    imageTypes: ["image/jpeg"],
    minVideoMs: 3_000,
    maxVideoMs: 15 * 60_000,
    vertical: true,
  },
  status: instagramStatus,
  comments: instagramComments,
  analytics: instagramAnalytics,

  async upload(post, token, metadata) {
    const result = await uploadMedia(post, token, metadata);
    return {
      platformPostId: result.platformPostId,
      platformUrl: "platformUrl" in result ? result.platformUrl : undefined,
      responseLog: result.responseLog,
    };
  },

  release: (container, token, igUserId) => publishContainer(container, token, igUserId),
};
