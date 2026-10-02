/**
 * How long a channel whose access was revoked keeps its data before it is deleted (see
 * access.service). Pure, so the workspace can show the date too.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Days from the revocation to the deletion; with the daily check, within YouTube's 7. */
export const REVOKED_DAYS = 6;

/** The platforms whose policy requires deleting a revoked channel's data. */
export const DELETE_WHEN_REVOKED = ["youtube"];

/** When a revoked channel's data goes, unless it is connected again; null if it stays. */
export function removalDate(account: { provider: string; revokedAt: Date | string | null }) {
  if (!account.revokedAt || !DELETE_WHEN_REVOKED.includes(account.provider)) return null;
  return new Date(new Date(account.revokedAt).getTime() + REVOKED_DAYS * DAY);
}
