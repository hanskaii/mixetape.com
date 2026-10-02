import type { SocialProvider } from "../types";
import { blueskyConnect } from "./connect";
import { blueskyMetadata } from "./metadata";
import { blueskyComments, blueskyStatus, uploadPost } from "./posts";

/**
 * Bluesky (AT Protocol). Posts go up at the scheduled time; firstComment becomes the
 * account's own reply, a thread.
 */
export const bluesky: SocialProvider = {
  id: "bluesky",
  name: "Bluesky",
  schedulesNatively: false,
  defaultLeadMinutes: 0,

  connect: blueskyConnect,
  metadata: blueskyMetadata,
  // One video (≤ 3 min, ≤ 100 MB), an image, or up to 4 images (each made ≤ 1 MB on the way).
  formats: {
    video: true,
    image: true,
    carousel: { min: 2, max: 4, kinds: ["image"] },
    imageTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    maxVideoMs: 3 * 60_000,
  },
  status: blueskyStatus,
  comments: blueskyComments,

  upload: (post, token, metadata) => uploadPost(post, token, metadata),
};
