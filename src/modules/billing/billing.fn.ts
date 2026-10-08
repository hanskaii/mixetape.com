import { createServerFn } from "@tanstack/react-start";
import { currentUserId } from "#/modules/auth/auth.server";
import { PLANS, TRIAL_DAYS, slugOf, type Period, type PlanId } from "./plans";
import { billingOf, checkoutProducts, studioCheckout } from "./billing.service";

/** The signed-in person's plan, for the billing page. */
export const getBilling = createServerFn({ method: "GET" }).handler(async () => {
  const billing = await billingOf(await currentUserId());
  return { ...billing, nextBillingAt: billing.nextBillingAt?.toISOString() ?? null };
});

type CheckoutChoice = { plan: PlanId; period: Period; accounts: number };

/**
 * What to hand the Dodo plugin's checkoutSession for a plan: its slug, or for Studio past
 * a hundred accounts a cart with the extra-account add-on. The trial is offered once; someone
 * who already has a plan is sent to the customer portal instead of a second subscription.
 */
export const checkoutRequest = createServerFn({ method: "POST" })
  .validator((data: unknown): CheckoutChoice => {
    const { plan, period, accounts } = (data ?? {}) as Partial<CheckoutChoice>;
    if (plan !== "creator" && plan !== "studio") throw new Error("Unknown plan");
    if (period !== "monthly" && period !== "yearly") throw new Error("Unknown billing period");
    const count = Math.round(Number(accounts));
    return { plan, period, accounts: Number.isFinite(count) ? count : PLANS[plan].accounts };
  })
  .handler(async ({ data }) => {
    const userId = await currentUserId();
    const billing = await billingOf(userId);
    if (billing.plan) return { manage: true as const };
    if (!billing.available || !checkoutProducts().length)
      throw new Error("Checkout is not open yet. Write to us and we will set you up.");

    const common = {
      referenceId: userId,
      // Someone who has had a subscription before starts paying straight away.
      subscription_data: { trial_period_days: billing.status ? 0 : TRIAL_DAYS },
    };
    const extra = data.plan === "studio" ? Math.max(0, data.accounts - PLANS.studio.accounts) : 0;
    if (!extra)
      return {
        manage: false as const,
        request: { ...common, slug: slugOf(data.plan, data.period) },
      };

    const ids = studioCheckout(data.period);
    if (!ids) throw new Error("Checkout is not open yet. Write to us and we will set you up.");
    return {
      manage: false as const,
      request: {
        ...common,
        product_cart: [
          {
            product_id: ids.productId,
            quantity: 1,
            addons: [{ addon_id: ids.addonId, quantity: extra }],
          },
        ],
      },
    };
  });
