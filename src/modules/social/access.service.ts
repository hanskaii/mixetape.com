import { env } from "cloudflare:workers";
import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "#/database/index";
import { getProvider } from "./providers";
import { socialAccounts } from "#/database/schema";
import { ServiceError } from "#/modules/api/errors";
import { DELETE_WHEN_REVOKED, REVOKED_DAYS } from "./revocation";
import { verifySignedRequest } from "./providers/meta/signed-request";
import { accessTokenFor, deleteAccount, forgetAccess, platformApp } from "./social.service";

/**
 * What happens when someone revokes mixetape's access on the platform's side. YouTube API
 * Services require deleting the API data of a user who revokes access within 7 days
 * (Developer Policies III.E). mixetape learns of a revocation when a token refresh is
 * refused — on use, or in the daily check below — and forgets the tokens at once
 * (forgetAccess). A YouTube channel not connected again within REVOKED_DAYS of that is
 * deleted with its posts; daily checks plus REVOKED_DAYS stay inside the 7 days.
 */

const DAY = 24 * 60 * 60 * 1000;

/**
 * Daily: asks YouTube for a fresh token for every channel still connected — a refusal means
 * the access was revoked — and refreshes the channel's stored name, handle and avatar.
 */
export async function checkRevokedAccess() {
  const accounts = await db.query.socialAccounts.findMany({
    where: and(
      eq(socialAccounts.provider, "youtube"),
      isNotNull(socialAccounts.refreshToken),
      isNull(socialAccounts.revokedAt),
    ),
  });
  let revoked = 0;
  for (const account of accounts) {
    try {
      const token = await accessTokenFor(account, { fresh: true });
      // The channel's name, handle and avatar come from YouTube: keep them current.
      const current = (await getProvider(account.provider).connect.accounts?.(token))?.find(
        (candidate) => candidate.platformAccountId === account.platformAccountId,
      );
      if (current)
        await db
          .update(socialAccounts)
          .set({
            name: current.name,
            handle: current.handle ?? null,
            avatar: current.avatar ?? null,
            updatedAt: new Date(),
          })
          .where(eq(socialAccounts.id, account.id));
    } catch (error) {
      if (error instanceof ServiceError && error.code === "account_needs_reconnect") revoked++;
      else console.error(`[access] could not check ${account.id}:`, error);
    }
  }
  return { checked: accounts.length, revoked };
}

/** Hourly: deletes the channels revoked over REVOKED_DAYS ago, with their posts. */
export async function deleteRevokedAccounts() {
  const before = new Date(Date.now() - REVOKED_DAYS * DAY);
  const due = (
    await db.query.socialAccounts.findMany({
      columns: { id: true, userId: true, provider: true },
      where: and(isNotNull(socialAccounts.revokedAt), lt(socialAccounts.revokedAt, before)),
    })
  ).filter((account) => DELETE_WHEN_REVOKED.includes(account.provider));
  for (const account of due) await deleteAccount(account.userId, account.id);
  return { deleted: due.length };
}

// ── the platform's own callbacks (Meta: Facebook, Instagram, Threads) ─────────────────────

/** The platforms whose apps Meta calls back about a person. */
export const META_CALLBACKS = ["facebook", "instagram", "threads"];

/**
 * The person a Meta callback is about: the `signed_request` form field, checked against
 * that platform's app secret. Null when the platform is not Meta's or the signature is wrong.
 */
export async function metaCallbackUser(provider: string, request: Request) {
  if (!META_CALLBACKS.includes(provider)) return null;
  const app = await platformApp(provider);
  const form = await request.formData().catch(() => null);
  const signed = form?.get("signed_request");
  if (!app || typeof signed !== "string") return null;
  return (await verifySignedRequest(signed, app.clientSecret))?.user_id ?? null;
}

/** The accounts a person on a platform connected: their own, or Pages they gave access to. */
const accountsOf = (provider: string, platformUserId: string) =>
  db.query.socialAccounts.findMany({
    where: and(
      eq(socialAccounts.provider, provider),
      or(
        eq(socialAccounts.platformAccountId, platformUserId),
        eq(socialAccounts.grantedBy, platformUserId),
      ),
    ),
  });

/** The person removed mixetape on the platform: forget the tokens, as on any revocation. */
export async function deauthorizedOnPlatform(provider: string, platformUserId: string) {
  const accounts = await accountsOf(provider, platformUserId);
  for (const account of accounts) await forgetAccess(account);
  return { forgotten: accounts.length };
}

const DELETION_TTL = 90 * 24 * 60 * 60; // seconds the confirmation can be looked up

export type DeletionRecord = { provider: string; deleted: number; at: string };

/**
 * The person asked the platform to have their data deleted: their accounts go, with their
 * posts, at once. The confirmation code lets them check it at /data-deletion.
 */
export async function deletionRequestedOnPlatform(provider: string, platformUserId: string) {
  const accounts = await accountsOf(provider, platformUserId);
  for (const account of accounts) await deleteAccount(account.userId, account.id);
  // Twelve hex digits: easy to read out and type, unguessable enough for a status page.
  const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  )
    .join("")
    .toUpperCase();
  const record: DeletionRecord = {
    provider,
    deleted: accounts.length,
    at: new Date().toISOString(),
  };
  await env.KIT_CACHE.put(`deletion:${code}`, JSON.stringify(record), {
    expirationTtl: DELETION_TTL,
  });
  return { code, ...record };
}

/** A deletion request by its confirmation code, while it can still be looked up. */
export async function deletionStatus(code: string): Promise<DeletionRecord | null> {
  if (!/^[0-9A-Fa-f]{12}$/.test(code)) return null;
  const stored = await env.KIT_CACHE.get(`deletion:${code.toUpperCase()}`);
  return stored ? (JSON.parse(stored) as DeletionRecord) : null;
}
