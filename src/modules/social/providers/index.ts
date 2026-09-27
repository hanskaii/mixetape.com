import { CAPABILITIES, type Capability, type SocialProvider } from "./types";
import { facebook } from "./facebook";
import { instagram } from "./instagram";
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

export const PROVIDER_LIST = Object.values(PROVIDERS).map((provider) => ({
  id: provider.id,
  name: provider.name,
  capabilities: capabilitiesOf(provider),
}));

export type * from "./types";
export {
  CAPABILITIES,
  InvalidInputError,
  PermanentPublishError,
  ReconnectRequiredError,
} from "./types";
