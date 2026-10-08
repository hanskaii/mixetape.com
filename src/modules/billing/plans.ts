/**
 * The plans as sold: what each costs and how many social accounts it covers. Shared by the
 * pricing page and the server (billing.service), which maps them to Dodo Payments products.
 */

export type PlanId = "creator" | "studio";
export type Period = "monthly" | "yearly";

/** A year costs ten months: two are free. */
export const MONTHS_PAID_YEARLY = 10;

/** Every plan starts with this many free days; Dodo charges when they end. */
export const TRIAL_DAYS = 7;

/** Days the workspace's data is kept once there is no plan. */
export const DATA_KEPT_DAYS = 30;
/** The deletion warning goes this many days before. */
export const WARNING_DAYS = 7;
/** The trial reminder goes this many days before the first charge. */
export const TRIAL_REMINDER_DAYS = 2;

/**
 * Most posts one channel may have on one day (UTC): more reads as spam to the platforms and
 * can get the account limited there. Exempt accounts are not counted.
 */
export const POSTS_PER_CHANNEL_DAY = 10;

export const PLANS = {
  creator: { name: "Creator", accounts: 15, monthly: 39 },
  // Studio covers `accounts` and sells more one at a time, `extraMonthly` each.
  studio: { name: "Studio", accounts: 100, monthly: 100, extraMonthly: 1 },
} as const;

/** What a plan costs per billing period, in whole dollars. */
export function priceOf(monthly: number, period: Period) {
  return period === "monthly" ? monthly : monthly * MONTHS_PAID_YEARLY;
}

/** The checkout slug the Better Auth Dodo plugin maps to a product (billing.service). */
export const slugOf = (plan: PlanId, period: Period) => `${plan}-${period}`;
