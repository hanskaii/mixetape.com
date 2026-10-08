import { and, eq, inArray } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { db } from "#/database";
import { subscriptions, user } from "#/database/schema";
import { siteConfig } from "#/config/site";
import { ServiceError } from "#/modules/api/errors";
import { deleteWorkspaceData } from "#/modules/billing/lifecycle.service";
import { sendEmail } from "#/modules/email/email.service";
import { MEDIA_PREFIX } from "#/modules/storage/storage.service";

/** Subscription statuses Dodo may still charge for. */
const CHARGEABLE = ["active", "on_hold", "paused", "past_due", "pending"];

/** Every object under a prefix of the bucket, a page at a time. */
async function deletePrefix(prefix: string) {
  let cursor: string | undefined;
  do {
    const page = await env.BUCKET.list({ prefix, cursor });
    if (page.objects.length) await env.BUCKET.delete(page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

/**
 * Deletes a person's account for good, from Settings: everything in the workspace (channels
 * and their tokens, posts, files, groups, brands, webhooks), anything of theirs left in the
 * bucket (avatars included), then the account itself, which takes its sessions, sign-in
 * methods, API keys, MCP grants and subscription records with it. Invoices stay with Dodo
 * Payments, the merchant of record.
 *
 * Refused while a subscription would still renew, so nobody is charged for an account that
 * no longer exists: cancel in Billing first (it can run to the end of its period).
 */
export async function deleteUserAccount(userId: string, typedEmail: string) {
  const person = await db.query.user.findFirst({ where: eq(user.id, userId) });
  if (!person) throw new ServiceError("Account not found", 404);
  if (typedEmail.trim().toLowerCase() !== person.email.toLowerCase())
    throw new ServiceError("Type your account's email address to confirm", 400);

  const renewing = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      inArray(subscriptions.status, CHARGEABLE),
      eq(subscriptions.cancelAtPeriodEnd, false),
    ),
  });
  if (renewing && !person.billingExempt)
    throw new ServiceError(
      "Your plan still renews. Cancel it in Billing first, then delete the account.",
      409,
      { code: "conflict" },
    );

  await deleteWorkspaceData(userId);
  await Promise.all([
    deletePrefix(`${MEDIA_PREFIX}${userId}/`),
    deletePrefix(`avatars/${userId}/`),
  ]);
  await db.delete(user).where(eq(user.id, userId));

  await sendEmail({
    to: person.email,
    subject: `Your ${siteConfig.name} account was deleted`,
    paragraphs: [
      "Hi,",
      `Your ${siteConfig.name} account and everything in it — channels and their access, posts, files, groups, brands, webhooks and API keys — have been deleted. Posts already published stay on their platforms.`,
      "If this was not you, reply to this email right away.",
    ],
    replyTo: siteConfig.contactEmail,
  });
  return { deleted: true };
}
