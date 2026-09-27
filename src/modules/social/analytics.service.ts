import { and, eq, inArray } from "drizzle-orm";
import { db } from "#/database/index";
import { socialPosts } from "#/database/schema";
import type { DateRange } from "./providers";
import { onAccount, onPlatform, platformCall } from "./platform.service";
import { ServiceError } from "#/modules/api/errors";

/**
 * How posts and accounts perform, from the platform's own analytics. An agent reads this to
 * learn which topics, titles and lengths work before it plans the next post.
 */

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_ACCOUNT_DAYS = 28;

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

function checkDate(value: string | undefined, name: string): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))
    throw new ServiceError(`${name} must be a date as YYYY-MM-DD`);
  return value;
}

function range(input: { from?: string; to?: string }, defaultFrom: Date): DateRange {
  const to = checkDate(input.to, "to") ?? isoDate(new Date());
  const from = checkDate(input.from, "from") ?? isoDate(defaultFrom);
  if (from > to) throw new ServiceError("from must not be after to");
  return { from, to };
}

/** One post's totals, audience retention and traffic sources; by default since it went up. */
export async function postAnalytics(
  userId: string,
  postId: string,
  input: { from?: string; to?: string } = {},
) {
  const { post, platformPostId, use, token } = await onPlatform(userId, postId, "analytics");
  const dates = range(input, post.publishedAt ?? post.scheduledAt);
  const report = await platformCall(() => use.post(platformPostId, token, dates));
  return {
    post: { id: post.id, platformPostId, platformUrl: post.platformUrl },
    dataDelayDays: use.delayDays,
    ...report,
  };
}

/**
 * An account's totals, day by day, its top posts and traffic sources; by default over the
 * last 28 days. Top posts published through mixetape carry their mixetape post id.
 */
export async function accountAnalytics(
  userId: string,
  accountId: string,
  input: { from?: string; to?: string } = {},
) {
  const { account, use, token } = await onAccount(userId, accountId, "analytics");
  const dates = range(input, new Date(Date.now() - DEFAULT_ACCOUNT_DAYS * DAY));
  const reportAccount = use.account;
  if (!reportAccount) {
    throw new ServiceError(
      "This platform has no account-level analytics; use get_post_analytics per post",
      409,
    );
  }
  const report = await platformCall(() => reportAccount(account.platformAccountId, token, dates));

  const ids = report.topPosts.map((top) => top.platformPostId);
  const known = ids.length
    ? await db.query.socialPosts.findMany({
        columns: { id: true, platformPostId: true },
        where: and(eq(socialPosts.userId, userId), inArray(socialPosts.platformPostId, ids)),
      })
    : [];
  const postIds = new Map(known.map((post) => [post.platformPostId, post.id]));

  return {
    account: { id: account.id, name: account.name.trim(), provider: account.provider },
    dataDelayDays: use.delayDays,
    ...report,
    topPosts: report.topPosts.map((top) => ({
      ...top,
      postId: postIds.get(top.platformPostId) ?? null,
    })),
  };
}
