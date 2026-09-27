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
  status: pinterestStatus,
  collections: pinterestBoards,
  analytics: pinterestAnalytics,

  async upload(post, token, metadata) {
    const pin = await createPin(post, token, metadata);
    return { ...pin, responseLog: "Pin created" };
  },
};
