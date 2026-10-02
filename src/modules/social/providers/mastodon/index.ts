import type { SocialProvider } from "../types";
import { mastodonConnect } from "./connect";
import { mastodonMetadata } from "./metadata";
import { mastodonComments, mastodonStatus, uploadPost } from "./posts";

/**
 * Mastodon, on whichever server the person's account lives. Posts go up at the scheduled
 * time; firstComment becomes the account's own reply, a thread.
 */
export const mastodon: SocialProvider = {
  id: "mastodon",
  name: "Mastodon",
  schedulesNatively: false,
  defaultLeadMinutes: 0,

  connect: mastodonConnect,
  metadata: mastodonMetadata,
  // A video, an image, or up to 4 images (the usual server limit, checked when publishing).
  formats: {
    video: true,
    image: true,
    carousel: { min: 2, max: 4, kinds: ["image"] },
    imageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  },
  status: mastodonStatus,
  comments: mastodonComments,

  upload: (post, token, metadata) => uploadPost(post, token, metadata),
};
