import { CAPABILITIES, type Capability, type SocialProvider } from "./types";
import { bluesky } from "./bluesky";
import { facebook } from "./facebook";
import { instagram } from "./instagram";
import { mastodon } from "./mastodon";
import { threads } from "./threads";
import { pinterestProvider } from "./pinterest";
import { tiktokProvider } from "./tiktok";
import { youtube } from "./youtube";

/**
 * Every platform mixetape can post to. Adding one is a folder implementing SocialProvider
 * (see youtube/) and an entry here; the service, REST API and MCP tools pick it up.
 */
const PROVIDERS: Record<string, SocialProvider> = {
  youtube,
  facebook,
  instagram,
  threads,
  tiktok: tiktokProvider,
  pinterest: pinterestProvider,
  bluesky,
  mastodon,
};

export function getProvider(id: string): SocialProvider {
  const provider = PROVIDERS[id];
  if (!provider) throw new Error(`Unknown provider: ${id}`);
  return provider;
}

export function isProvider(id: string): boolean {
  return id in PROVIDERS;
}

/** The optional capabilities a provider has, e.g. ["status", "comments", "analytics"]. */
export function capabilitiesOf(provider: SocialProvider): Capability[] {
  return CAPABILITIES.filter((capability) => provider[capability] !== undefined);
}

/**
 * What an action needs from a platform: one of its capabilities, or account-level analytics
 * (which not every platform with post analytics reports).
 */
export type Need = Capability | "accountAnalytics";

const meets = (provider: SocialProvider, need: Need) =>
  need === "accountAnalytics"
    ? provider.analytics?.account !== undefined
    : provider[need] !== undefined;

/** The platforms an action works on: all of them when it needs nothing in particular. */
export const platformsWith = (need?: Need) =>
  Object.values(PROVIDERS)
    .filter((provider) => !need || meets(provider, need))
    .map((provider) => provider.id);

export const PROVIDER_LIST = Object.values(PROVIDERS).map((provider) => ({
  id: provider.id,
  name: provider.name,
  capabilities: capabilitiesOf(provider),
  /** What connecting asks first (a Mastodon account, a Bluesky handle), or null. */
  asks: provider.connect.asks ?? null,
}));

export type * from "./types";
export {
  CAPABILITIES,
  InvalidInputError,
  PermanentPublishError,
  ReconnectRequiredError,
} from "./types";
