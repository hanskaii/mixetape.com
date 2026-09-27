import type { SocialProvider } from "../types";
import { instagramAnalytics } from "./analytics";
import { instagramComments } from "./comments";
import { instagramConnect } from "./connect";
import { publishContainer, instagramStatus, uploadReel } from "./media";
import { instagramMetadata } from "./metadata";

export type { InstagramReelMeta } from "./metadata";

/**
 * Instagram professional accounts: videos post as Reels, prepared ahead and published by
 * mixetape at go-live (the API cannot schedule), with comments and Reel insights. The cover
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
  status: instagramStatus,
  comments: instagramComments,
  analytics: instagramAnalytics,

  async upload(post, token, metadata) {
    const result = await uploadReel(post, token, metadata);
    return {
      platformPostId: result.platformPostId,
      platformUrl: "platformUrl" in result ? result.platformUrl : undefined,
      responseLog: result.responseLog,
    };
  },

  release: (container, token, igUserId) => publishContainer(container, token, igUserId),
};
