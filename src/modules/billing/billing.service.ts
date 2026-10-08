import { and, count, desc, eq, inArray } from "drizzle-orm";
import { env } from "cloudflare:workers";
import DodoPayments from "dodopayments";
import { db } from "#/database";
import { socialAccounts, subscriptions, user } from "#/database/schema";
import { ServiceError } from "#/modules/api/errors";
import { secret } from "#/modules/secrets/secrets.service";
import { siteConfig } from "#/config/site";
import { PLANS, TRIAL_DAYS, slugOf, type Period, type PlanId } from "./plans";

/**
 * Billing through Dodo Payments. Checkout, the customer portal and webhook verification are
 * the Better Auth Dodo plugin's (auth.server); this module knows the catalog, records each
 * subscription its webhooks describe, and decides whether someone may publish.
 */

/**
 * The Dodo products for each plan and period, and the add-on that sells Studio accounts
 * past the hundred. Ids come from scripts/dodo-catalog.mjs, set as the DODO_CATALOG var.
 */
type Catalog = Partial<Record<`${PlanId}_${Period}` | `extra_account_${Period}`, string>>;

export function catalog(): Catalog {
  try {
    return JSON.parse(env.DODO_CATALOG || "{}") as Catalog;
  } catch {
    return {};
  }
}

const PERIODS: Period[] = ["monthly", "yearly"];
const PLAN_IDS = Object.keys(PLANS) as PlanId[];

/** The checkout slugs the plugin resolves to products: creator-monthly, … */
export function checkoutProducts() {
  const ids = catalog();
  return PLAN_IDS.flatMap((plan) =>
    PERIODS.flatMap((period) => {
      const productId = ids[`${plan}_${period}`];
      return productId ? [{ slug: slugOf(plan, period), productId }] : [];
    }),
  );
}

/** The ids the checkout page needs to put Studio's extra accounts in the cart. */
export function studioCheckout(period: Period) {
  const ids = catalog();
  const productId = ids[`studio_${period}`];
  const addonId = ids[`extra_account_${period}`];
  return productId && addonId ? { productId, addonId } : null;
}

/** The Dodo client, once its API key is set; billing stays off until then. */
export async function dodoClient(): Promise<DodoPayments | null> {
  const bearerToken = await secret("DODO_PAYMENTS_API_KEY");
  if (!bearerToken) return null;
  return new DodoPayments({
    bearerToken,
    // DODO_MODE is a plain var: test_mode, or live_mode once checkout goes live.
    environment: (env.DODO_MODE as string) === "live_mode" ? "live_mode" : "test_mode",
  });
}

// ── webhooks ─────────────────────────────────────────────────────────────────

type SubscriptionData = {
  subscription_id: string;
  product_id: string;
  status: string;
  quantity?: number;
  addons?: { addon_id: string; quantity: number }[];
  cancel_at_next_billing_date?: boolean;
  next_billing_date?: string;
  customer?: { customer_id?: string; email?: string };
  metadata?: Record<string, string>;
};

function asSubscription(data: unknown): SubscriptionData | null {
  if (!data || typeof data !== "object") return null;
  const value = data as Partial<SubscriptionData>;
  return typeof value.subscription_id === "string" &&
    typeof value.product_id === "string" &&
    typeof value.status === "string"
    ? (value as SubscriptionData)
    : null;
}

/** Which plan and period a Dodo product is, or null for a product that is not a plan. */
function planOfProduct(productId: string): { plan: PlanId; period: Period } | null {
  const ids = catalog();
  for (const plan of PLAN_IDS)
    for (const period of PERIODS)
      if (ids[`${plan}_${period}`] === productId) return { plan, period };
  return null;
}

/** Whose subscription it is: the user checkout named, else the Dodo customer or its email. */
async function ownerOf(data: SubscriptionData): Promise<string | null> {
  const referenced = data.metadata?.referenceId;
  if (referenced) {
    const found = await db.query.user.findFirst({ where: eq(user.id, referenced) });
    if (found) return found.id;
  }
  const customerId = data.customer?.customer_id;
  if (customerId) {
    const found = await db.query.user.findFirst({ where: eq(user.dodoCustomerId, customerId) });
    if (found) return found.id;
  }
  const email = data.customer?.email;
  if (email) {
    const found = await db.query.user.findFirst({ where: eq(user.email, email.toLowerCase()) });
    if (found) return found.id;
  }
  return null;
}

/** Stores a subscription as a Dodo subscription.* webhook describes it. */
export async function recordSubscription(payload: { type: string; data: unknown }) {
  const data = asSubscription(payload.data);
  if (!data) return;
  const product = planOfProduct(data.product_id);
  if (!product) {
    console.warn(`[billing] ${payload.type}: product ${data.product_id} is not in DODO_CATALOG`);
    return;
  }
  const userId = await ownerOf(data);
  if (!userId) {
    console.warn(`[billing] ${payload.type}: no user for ${data.subscription_id}`);
    return;
  }
  const extraAddon = catalog()[`extra_account_${product.period}`];
  const extra =
    data.addons
      ?.filter((addon) => addon.addon_id === extraAddon)
      .reduce((n, a) => n + a.quantity, 0) ?? 0;
  const values = {
    userId,
    productId: data.product_id,
    plan: product.plan,
    period: product.period,
    status: data.status,
    accounts: PLANS[product.plan].accounts + (product.plan === "studio" ? extra : 0),
    cancelAtPeriodEnd: Boolean(data.cancel_at_next_billing_date),
    nextBillingAt: data.next_billing_date ? new Date(data.next_billing_date) : null,
    updatedAt: new Date(),
  };
  await db
    .insert(subscriptions)
    .values({ id: data.subscription_id, ...values })
    .onConflictDoUpdate({ target: subscriptions.id, set: values });
}

// ── entitlement ──────────────────────────────────────────────────────────────

/** Dodo statuses that still allow publishing; a trial is `active`. */
const ENTITLED = ["active"];

export type Billing = {
  exempt: boolean;
  plan: { id: PlanId; name: string; period: Period; accounts: number } | null;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  nextBillingAt: Date | null;
  connected: number;
  /** Whether checkout and the portal are set up at all (API key and catalog). */
  available: boolean;
};

/** The user's plan, as the workspace shows it and publishing checks it. */
export async function billingOf(userId: string): Promise<Billing> {
  const [person, latest, [{ connected }]] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, userId), columns: { billingExempt: true } }),
    db.query.subscriptions.findFirst({
      where: and(eq(subscriptions.userId, userId), inArray(subscriptions.status, ENTITLED)),
      orderBy: desc(subscriptions.updatedAt),
    }),
    db.select({ connected: count() }).from(socialAccounts).where(eq(socialAccounts.userId, userId)),
  ]);
  const last =
    latest ??
    (await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
      orderBy: desc(subscriptions.updatedAt),
    }));
  const planId = latest?.plan as PlanId | undefined;
  return {
    exempt: Boolean(person?.billingExempt),
    plan:
      latest && planId && planId in PLANS
        ? {
            id: planId,
            name: PLANS[planId].name,
            period: latest.period as Period,
            accounts: latest.accounts,
          }
        : null,
    status: last?.status ?? null,
    cancelAtPeriodEnd: Boolean(latest?.cancelAtPeriodEnd),
    nextBillingAt: latest?.nextBillingAt ?? null,
    connected,
    available: Boolean(await secret("DODO_PAYMENTS_API_KEY")) && checkoutProducts().length > 0,
  };
}

/**
 * Throws unless the user may schedule posts: a plan whose accounts cover every connected
 * channel, or an exempt account. Posts already scheduled keep going out regardless.
 */
export async function requirePlan(userId: string) {
  const billing = await billingOf(userId);
  if (billing.exempt) return;
  if (!billing.plan)
    throw new ServiceError(
      `Scheduling posts needs a plan. Start the ${TRIAL_DAYS}-day free trial at ${siteConfig.url}/pricing.`,
      402,
      { code: "plan_required" },
    );
  if (billing.connected > billing.plan.accounts)
    throw new ServiceError(
      `Your ${billing.plan.name} plan covers ${billing.plan.accounts} social accounts and ${billing.connected} are connected. Disconnect some or change plans at ${siteConfig.url}/settings/billing.`,
      402,
      { code: "plan_limit_reached" },
    );
}
