/**
 * The plans as sold: what each costs and how many social accounts it covers. Shared by the
 * pricing page and the server (billing.service), which maps them to Dodo Payments products.
 */

export type PlanId = "marketer" | "operator";
export type Period = "monthly" | "yearly";

/** A year costs ten months: two are free. */
export const MONTHS_PAID_YEARLY = 10;

/** Every plan starts with this many free days; Dodo charges when they end. */
export const TRIAL_DAYS = 7;

export const PLANS = {
  marketer: { name: "Marketer", accounts: 15, monthly: 39 },
  // Operator covers `accounts` and sells more one at a time, `extraMonthly` each.
  operator: { name: "Operator", accounts: 100, monthly: 100, extraMonthly: 1 },
} as const;

/** What a plan costs per billing period, in whole dollars. */
export function priceOf(monthly: number, period: Period) {
  return period === "monthly" ? monthly : monthly * MONTHS_PAID_YEARLY;
}

/** The checkout slug the Better Auth Dodo plugin maps to a product (billing.service). */
export const slugOf = (plan: PlanId, period: Period) => `${plan}-${period}`;
