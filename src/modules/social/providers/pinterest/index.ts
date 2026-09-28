import type { SocialProvider } from "../types";
import { pinterestConnect } from "./connect";
import { pinterestMetadata } from "./metadata";
import { createPin, pinterestAnalytics, pinterestBoards, pinterestStatus } from "./pins";

export type { PinterestPinMeta } from "./metadata";

/**
 * Pinterest business accounts: video and image Pins on a chosen board, boards as
 * collections, and Pin and account analytics. Pinterest cannot hold a Pin until a time,
 * so mixetape creates it at the scheduled moment.
 */
export const pinterestProvider: SocialProvider = {
  id: "pinterest",
  name: "Pinterest",
  schedulesNatively: false,
  defaultLeadMinutes: 0,

  connect: pinterestConnect,
  metadata: pinterestMetadata,
  // Video Pins (4 s–15 min), image Pins, and carousel Pins of 2–5 images.
  formats: {
    video: true,
    image: true,
    carousel: { min: 2, max: 5, kinds: ["image"] },
    minVideoMs: 4_000,
    maxVideoMs: 15 * 60_000,
  },
  textFields: { title: "title", description: "description" },
  status: pinterestStatus,
  collections: pinterestBoards,
  analytics: pinterestAnalytics,

  async upload(post, token, metadata) {
    const pin = await createPin(post, token, metadata);
    return { ...pin, responseLog: "Pin created" };
  },
};
