import { and, count, eq, gt, inArray, lte } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { db } from "#/database";
import {
  brands,
  mediaFiles,
  mediaGroups,
  socialAccounts,
  socialPosts,
  subscriptions,
  user,
  webhooks,
} from "#/database/schema";
import { siteConfig } from "#/config/site";
import { sendEmail } from "#/modules/email/email.service";
import { cancelPost, deleteAccount } from "#/modules/social/social.service";
import { deleteBrand } from "#/modules/social/brands.service";
import { deleteFile } from "#/modules/storage/files.service";
import { deleteGroup } from "#/modules/library/groups.service";
import { deleteWebhook } from "#/modules/webhooks/webhooks.service";
import { ENDED } from "./billing.service";
import { MONTHS_PAID_YEARLY, PLANS, type Period, type PlanId } from "./plans";

/**
 * What happens around a plan's end, in the order a person meets it: a reminder before the
 * trial turns into a charge, a notice when the plan ends (scheduled posts pause from then
 * on), a warning a week before the workspace's data is deleted, and the deletion itself,
 * 30 days after the plan ended (or after sign-up, for someone who never had one).
 */

const DAY = 86_400_000;
/** Days the workspace's data is kept once there is no plan. */
export const DATA_KEPT_DAYS = 30;
/** The deletion warning goes this many days before. */
export const WARNING_DAYS = 7;
/** The trial reminder goes this many days before the first charge. */
export const TRIAL_REMINDER_DAYS = 2;

/** Statuses of a subscription that is not over: its data stays. */
const OPEN = ["active", "on_hold", "paused", "past_due", "pending"];

const day = (date: Date) =>
  `${date.toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })}`;

/** True the first time for a key, then false until it expires: each notice goes once. */
async function firstTime(key: string, days: number) {
  if (await env.KIT_CACHE.get(key)) return false;
  await env.KIT_CACHE.put(key, "1", { expirationTtl: days * 86_400 });
  return true;
}

/** What the subscription costs each period, in dollars. */
function chargeOf(plan: PlanId, period: Period, accounts: number) {
  const monthly =
    plan === "studio"
      ? PLANS.studio.monthly +
        Math.max(0, accounts - PLANS.studio.accounts) * PLANS.studio.extraMonthly
      : PLANS[plan].monthly;
  const amount = period === "monthly" ? monthly : monthly * MONTHS_PAID_YEARLY;
  return `$${amount.toLocaleString("en-US")} ${period === "monthly" ? "a month" : "a year"}`;
}

// ── trial reminder ───────────────────────────────────────────────────────────

/** Hourly: subscriptions whose trial turns into a charge within the next two days. */
export async function remindTrialsEnding() {
  const now = Date.now();
  const rows = await db
    .select({ sub: subscriptions, email: user.email, exempt: user.billingExempt })
    .from(subscriptions)
    .innerJoin(user, eq(user.id, subscriptions.userId))
    .where(
      and(
        eq(subscriptions.status, "active"),
        eq(subscriptions.cancelAtPeriodEnd, false),
        gt(subscriptions.trialEndsAt, new Date(now)),
        lte(subscriptions.trialEndsAt, new Date(now + TRIAL_REMINDER_DAYS * DAY)),
      ),
    );
  let sent = 0;
  for (const { sub, email } of rows) {
    if (!sub.trialEndsAt || !(await firstTime(`lifecycle:trial:${sub.id}`, 14))) continue;
    const plan = sub.plan as PlanId;
    await sendEmail({
      to: email,
      subject: `Your ${siteConfig.name} trial ends on ${day(sub.trialEndsAt)}`,
      paragraphs: [
        "Hi,",
        `Your free trial of the ${PLANS[plan]?.name ?? sub.plan} plan ends on ${day(sub.trialEndsAt)}. From then on it is ${chargeOf(plan, sub.period as Period, sub.accounts)}, charged to the card you added.`,
        "Nothing to do if you want to keep it. To stop before the first charge, cancel in Billing; the plan stays active until the trial ends.",
      ],
      link: { label: "Open Billing", url: `${siteConfig.url}/settings/billing` },
    });
    sent += 1;
  }
  return { sent };
}

// ── plan ended ───────────────────────────────────────────────────────────────

/** Sent when a subscription webhook says the plan is over (cancelled, expired, failed). */
export async function notifyPlanEnded(userId: string, subscriptionId: string) {
  const person = await db.query.user.findFirst({ where: eq(user.id, userId) });
  if (!person || person.billingExempt) return;
  // Another subscription may have taken over (a plan change, a new checkout).
  const open = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.userId, userId), inArray(subscriptions.status, OPEN)),
  });
  if (open || !(await firstTime(`lifecycle:ended:${subscriptionId}`, 60))) return;
  const [{ waiting }] = await db
    .select({ waiting: count() })
    .from(socialPosts)
    .where(and(eq(socialPosts.userId, userId), eq(socialPosts.status, "scheduled")));
  const deletion = new Date(Date.now() + DATA_KEPT_DAYS * DAY);
  await sendEmail({
    to: person.email,
    subject: `Your ${siteConfig.name} plan has ended`,
    paragraphs: [
      "Hi,",
      waiting
        ? `Your plan has ended, so the ${waiting} post${waiting === 1 ? "" : "s"} you have scheduled will pause instead of going out when ${waiting === 1 ? "it falls" : "they fall"} due.`
        : "Your plan has ended, so nothing new can be scheduled for now.",
      `Your channels, posts and files are kept until ${day(deletion)}. Subscribe again before then and paused posts can be sent with one click; after that date they are deleted.`,
    ],
    link: { label: "Choose a plan", url: `${siteConfig.url}/subscribe` },
  });
}

// ── deletion after 30 days without a plan ────────────────────────────────────

/**
 * Hourly: workspaces without a plan for WARNING_DAYS short of DATA_KEPT_DAYS get a warning,
 * and those past DATA_KEPT_DAYS lose their data. Exempt accounts, and accounts whose
 * subscription is still open (on hold, paused: Dodo is still trying to charge), are left
 * alone. The sign-in account and billing history stay; channels, posts, files, groups,
 * brands and webhooks go.
 */
export async function expireLapsedWorkspaces() {
  const people = await db.query.user.findMany({
    where: eq(user.billingExempt, false),
    columns: { id: true, email: true, createdAt: true },
  });
  const subs = await db.query.subscriptions.findMany({
    columns: { userId: true, status: true, updatedAt: true },
  });
  const now = Date.now();
  let warned = 0;
  let deleted = 0;
  for (const person of people) {
    const own = subs.filter((sub) => sub.userId === person.id);
    if (own.some((sub) => OPEN.includes(sub.status))) continue;
    const endedAt = own.length
      ? Math.max(
          ...own.filter((sub) => ENDED.includes(sub.status)).map((sub) => sub.updatedAt.getTime()),
          person.createdAt.getTime(),
        )
      : person.createdAt.getTime();
    const idle = now - endedAt;
    if (idle < (DATA_KEPT_DAYS - WARNING_DAYS) * DAY || !(await hasData(person.id))) continue;
    const deletion = new Date(endedAt + DATA_KEPT_DAYS * DAY);
    if (idle >= DATA_KEPT_DAYS * DAY) {
      await deleteWorkspaceData(person.id);
      console.log(`[lifecycle] deleted the workspace data of ${person.id}`);
      deleted += 1;
    } else if (await firstTime(`lifecycle:warned:${person.id}:${endedAt}`, DATA_KEPT_DAYS + 1)) {
      await sendEmail({
        to: person.email,
        subject: `Your ${siteConfig.name} data will be deleted on ${day(deletion)}`,
        paragraphs: [
          "Hi,",
          `Your workspace has had no plan since ${day(new Date(endedAt))}. On ${day(deletion)} its connected channels, posts and files will be deleted; this cannot be undone.`,
          "To keep them, choose a plan before then.",
        ],
        link: { label: "Choose a plan", url: `${siteConfig.url}/subscribe` },
      });
      warned += 1;
    }
  }
  return { warned, deleted };
}

async function hasData(userId: string) {
  const [[{ channels }], [{ files }]] = await Promise.all([
    db.select({ channels: count() }).from(socialAccounts).where(eq(socialAccounts.userId, userId)),
    db.select({ files: count() }).from(mediaFiles).where(eq(mediaFiles.userId, userId)),
  ]);
  return channels + files > 0;
}

/** Everything in the workspace, through the same paths the user would use to remove it. */
export async function deleteWorkspaceData(userId: string) {
  const waiting = await db.query.socialPosts.findMany({
    where: and(
      eq(socialPosts.userId, userId),
      inArray(socialPosts.status, ["scheduled", "paused"]),
    ),
    columns: { id: true },
  });
  // Stops their workflows and lets go of their files.
  for (const post of waiting) await cancelPost(userId, post.id).catch(() => undefined);
  const accounts = await db.query.socialAccounts.findMany({
    where: eq(socialAccounts.userId, userId),
    columns: { id: true },
  });
  // A channel takes its posts with it.
  for (const account of accounts) await deleteAccount(userId, account.id);
  const files = await db.query.mediaFiles.findMany({
    where: eq(mediaFiles.userId, userId),
    columns: { id: true },
  });
  for (const file of files)
    await deleteFile(userId, file.id).catch((error) =>
      console.error(`[lifecycle] could not delete file ${file.id}:`, error),
    );
  const groups = await db.query.mediaGroups.findMany({
    where: eq(mediaGroups.userId, userId),
    columns: { id: true },
  });
  for (const group of groups) await deleteGroup(userId, group.id).catch(() => undefined);
  const owned = await db.query.brands.findMany({
    where: eq(brands.userId, userId),
    columns: { id: true },
  });
  for (const brand of owned) await deleteBrand(userId, brand.id);
  const hooks = await db.query.webhooks.findMany({
    where: eq(webhooks.userId, userId),
    columns: { id: true },
  });
  for (const hook of hooks) await deleteWebhook(userId, hook.id);
}
