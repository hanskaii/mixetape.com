import type { SocialProvider } from "./types";
import { YoutubeProvider } from "./youtube";

/**
 * Every platform mixetape can post to. Adding one is a new file implementing
 * SocialProvider, an entry here, and its OAuth flow in modules/social/oauth.
 */
const PROVIDERS: Record<string, SocialProvider> = {
  youtube: new YoutubeProvider(),
};

export type ProviderId = keyof typeof PROVIDERS;

export function getProvider(id: string): SocialProvider {
  const provider = PROVIDERS[id];
  if (!provider) throw new Error(`Unknown provider: ${id}`);
  return provider;
}

export function isProvider(id: string): boolean {
  return id in PROVIDERS;
}

export const PROVIDER_LIST = Object.values(PROVIDERS).map((provider) => ({
  id: provider.id,
  name: provider.name,
}));

export type * from "./types";
export { PermanentPublishError } from "./types";
