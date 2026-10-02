import { and, eq, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "#/database/index";
import { getProvider } from "./providers";
import { socialAccounts } from "#/database/schema";
import { ServiceError } from "#/modules/api/errors";
import { DELETE_WHEN_REVOKED, REVOKED_DAYS } from "./revocation";
import { accessTokenFor, deleteAccount } from "./social.service";

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
