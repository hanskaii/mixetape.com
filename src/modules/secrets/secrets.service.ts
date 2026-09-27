import { env } from "cloudflare:workers";

/**
 * The app's credentials. In production they live in the Cloudflare Secrets Store and are
 * bound as SS_* (wrangler.jsonc); running locally, the store is empty and the same names
 * come from .dev.vars. Each value is read once per isolate.
 */
export type SecretName =
  | "BETTER_AUTH_SECRET"
  | "CREDENTIALS_KEY"
  | "GITHUB_CLIENT_ID"
  | "GITHUB_CLIENT_SECRET"
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET";

function sources(name: SecretName): {
  store: SecretsStoreSecret | undefined;
  local: string | undefined;
} {
  switch (name) {
    case "BETTER_AUTH_SECRET":
      return { store: env.SS_BETTER_AUTH_SECRET, local: env.BETTER_AUTH_SECRET };
    case "CREDENTIALS_KEY":
      return { store: env.SS_CREDENTIALS_KEY, local: env.CREDENTIALS_KEY };
    case "GITHUB_CLIENT_ID":
      return { store: env.SS_GITHUB_CLIENT_ID, local: env.GITHUB_CLIENT_ID };
    case "GITHUB_CLIENT_SECRET":
      return { store: env.SS_GITHUB_CLIENT_SECRET, local: env.GITHUB_CLIENT_SECRET };
    case "GOOGLE_CLIENT_ID":
      return { store: env.SS_GOOGLE_CLIENT_ID, local: env.GOOGLE_CLIENT_ID };
    case "GOOGLE_CLIENT_SECRET":
      return { store: env.SS_GOOGLE_CLIENT_SECRET, local: env.GOOGLE_CLIENT_SECRET };
  }
}

const cache = new Map<SecretName, Promise<string | undefined>>();

/** The secret's value, or undefined when it is set in neither place. */
export function secret(name: SecretName): Promise<string | undefined> {
  let value = cache.get(name);
  if (!value) {
    value = (async () => {
      const { store, local } = sources(name);
      // A binding whose secret was never created (always the case locally) throws.
      const stored = await store?.get().catch(() => undefined);
      return stored || local || undefined;
    })();
    cache.set(name, value);
  }
  return value;
}

/** Like secret(), for values the app cannot run without. */
export async function requiredSecret(name: SecretName): Promise<string> {
  const value = await secret(name);
  if (!value) throw new Error(`${name} is not configured (Secrets Store, or .dev.vars locally)`);
  return value;
}
