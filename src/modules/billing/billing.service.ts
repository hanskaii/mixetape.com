import { and, asc, count, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
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
  trial_period_days?: number;
  created_at?: string;
};

/** Subscription statuses after which the plan is over (on hold and paused are not). */
export const ENDED = ["cancelled", "expired", "failed"];

/** When the free trial ends, while the subscription is still in it; null otherwise. */
function trialEnd(data: SubscriptionData): Date | null {
  const days = data.trial_period_days ?? 0;
  const started = data.created_at ? Date.parse(data.created_at) : NaN;
  if (!days || Number.isNaN(started)) return null;
  const ends = started + days * 86_400_000;
  return ends > Date.now() ? new Date(ends) : null;
}

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

/**
 * Stores a subscription as a Dodo subscription.* webhook describes it. Webhooks can arrive
 * out of order or twice: an event older than the one already stored changes nothing.
 */
export async function recordSubscription(payload: {
  type: string;
  timestamp?: string | Date;
  data: unknown;
}) {
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
  const sent = payload.timestamp ? new Date(payload.timestamp) : new Date();
  const eventAt = Number.isNaN(sent.getTime()) ? new Date() : sent;
  const values = {
    userId,
    productId: data.product_id,
    plan: product.plan,
    period: product.period,
    status: data.status,
    accounts: PLANS[product.plan].accounts + (product.plan === "studio" ? extra : 0),
    cancelAtPeriodEnd: Boolean(data.cancel_at_next_billing_date),
    nextBillingAt: data.next_billing_date ? new Date(data.next_billing_date) : null,
    trialEndsAt: trialEnd(data),
    eventAt,
    updatedAt: new Date(),
  };
  await db
    .insert(subscriptions)
    .values({ id: data.subscription_id, ...values })
    .onConflictDoUpdate({
      target: subscriptions.id,
      set: values,
      setWhere: or(isNull(subscriptions.eventAt), lte(subscriptions.eventAt, eventAt)),
    });
  // The portal looks the customer up by this id rather than by email.
  const customerId = data.customer?.customer_id;
  if (customerId)
    await db
      .update(user)
      .set({ dodoCustomerId: customerId })
      .where(and(eq(user.id, userId), isNull(user.dodoCustomerId)));
  await syncChannelLocks(userId);
  return { userId, subscriptionId: data.subscription_id, ended: ENDED.includes(data.status) };
}

// ── entitlement ──────────────────────────────────────────────────────────────

/**
 * Dodo statuses that still allow publishing: `active` (a trial is active), and `past_due`,
 * the grace period after a failed renewal, which Dodo says must not cut access off. Access
 * ends at `on_hold` or `cancelled`.
 */
const ENTITLED = ["active", "past_due"];

/**
 * Statuses of a subscription that is not over yet: someone with one manages it in the portal
 * (pay the failed invoice, resume, change plan) instead of buying a second one.
 */
const OPEN = ["active", "on_hold", "paused", "past_due", "pending"];

export type Billing = {
  exempt: boolean;
  plan: { id: PlanId; name: string; period: Period; accounts: number } | null;
  status: string | null;
  /** A subscription that is not over yet, entitled or not (on hold, paused). */
  open: boolean;
  cancelAtPeriodEnd: boolean;
  nextBillingAt: Date | null;
  connected: number;
  /** Whether checkout and the portal are set up at all (API key and catalog). */
  available: boolean;
};

/** The user's plan, as the workspace shows it and publishing checks it. */
export async function billingOf(userId: string): Promise<Billing> {
  const [person, latest, open, last, [{ connected }]] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, userId), columns: { billingExempt: true } }),
    db.query.subscriptions.findFirst({
      where: and(eq(subscriptions.userId, userId), inArray(subscriptions.status, ENTITLED)),
      orderBy: desc(subscriptions.updatedAt),
    }),
    db.query.subscriptions.findFirst({
      where: and(eq(subscriptions.userId, userId), inArray(subscriptions.status, OPEN)),
    }),
    db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
      orderBy: desc(subscriptions.updatedAt),
    }),
    db.select({ connected: count() }).from(socialAccounts).where(eq(socialAccounts.userId, userId)),
  ]);
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
    status: (latest ?? last)?.status ?? null,
    open: Boolean(open),
    cancelAtPeriodEnd: Boolean(latest?.cancelAtPeriodEnd),
    nextBillingAt: latest?.nextBillingAt ?? null,
    connected,
    available: Boolean(await secret("DODO_PAYMENTS_API_KEY")) && checkoutProducts().length > 0,
  };
}

/**
 * Throws unless the user may use mixetape: an active plan (a trial counts) or an exempt
 * account. The workspace, REST, MCP and every write ask; the publish workflow asks again
 * when a post goes out.
 */
export async function requirePlan(userId: string): Promise<Billing> {
  const billing = await billingOf(userId);
  if (billing.exempt) return billing;
  if (!billing.plan && billing.open)
    throw new ServiceError(
      `Your plan is ${billing.status === "paused" ? "paused" : "on hold"}, so the workspace is paused. Pay the open invoice or resume it at ${siteConfig.url}/settings/billing.`,
      402,
      { code: "plan_required" },
    );
  if (!billing.plan)
    throw new ServiceError(
      `mixetape needs a plan. Choose one at ${siteConfig.url}/subscribe.`,
      402,
      { code: "plan_required" },
    );
  return billing;
}

// ── locked channels ──────────────────────────────────────────────────────────

/**
 * Locks the channels beyond what the plan covers, and unlocks them when there is room again.
 * The channels kept active are the ones already active, oldest first, so a downgrade locks
 * the most recently connected and a choice the user made (setChannelLock) stays. Without a
 * plan nothing is locked: nothing can be posted anyway.
 */
export async function syncChannelLocks(userId: string) {
  const billing = await billingOf(userId);
  const allowed = billing.exempt || !billing.plan ? Infinity : billing.plan.accounts;
  const rows = await db.query.socialAccounts.findMany({
    where: eq(socialAccounts.userId, userId),
    columns: { id: true, locked: true },
    orderBy: [asc(socialAccounts.locked), asc(socialAccounts.createdAt)],
  });
  const lock = rows
    .slice(allowed)
    .filter((row) => !row.locked)
    .map((row) => row.id);
  const unlock = rows
    .slice(0, allowed)
    .filter((row) => row.locked)
    .map((row) => row.id);
  if (lock.length)
    await db.update(socialAccounts).set({ locked: true }).where(inArray(socialAccounts.id, lock));
  if (unlock.length)
    await db
      .update(socialAccounts)
      .set({ locked: false })
      .where(inArray(socialAccounts.id, unlock));
}

/**
 * The user picks which channels stay active: lock one to make room, then unlock another.
 * Unlocking needs room in the plan.
 */
export async function setChannelLock(userId: string, accountId: string, locked: boolean) {
  const account = await db.query.socialAccounts.findFirst({
    where: and(eq(socialAccounts.id, accountId), eq(socialAccounts.userId, userId)),
  });
  if (!account) throw new ServiceError("Channel not found", 404);
  if (!locked && account.locked) {
    const billing = await billingOf(userId);
    const allowed = billing.exempt || !billing.plan ? Infinity : billing.plan.accounts;
    const [{ active }] = await db
      .select({ active: count() })
      .from(socialAccounts)
      .where(and(eq(socialAccounts.userId, userId), eq(socialAccounts.locked, false)));
    if (active >= allowed)
      throw new ServiceError(
        `Your plan covers ${allowed} active channels. Lock another channel first, or change plans at ${siteConfig.url}/settings/billing.`,
        402,
        { code: "channel_limit_reached" },
      );
  }
  await db.update(socialAccounts).set({ locked }).where(eq(socialAccounts.id, accountId));
}

/** Why a post on this channel may not go out now; null when it may (publish workflow). */
export async function lockedChannelProblem(accountId: string): Promise<string | null> {
  const account = await db.query.socialAccounts.findFirst({
    where: eq(socialAccounts.id, accountId),
    columns: { locked: true, name: true },
  });
  return account?.locked
    ? `${account.name} is locked: the plan covers fewer channels than are connected. Unlock it in Channels or change plans.`
    : null;
}

/**
 * How many more channels the user may connect: the plan's accounts less those connected;
 * reconnecting one of them never counts. Throws without a plan, or when `adding` would go
 * past it.
 */
export async function requireChannelRoom(userId: string, adding: number) {
  const billing = await requirePlan(userId);
  if (adding <= 0 || billing.exempt || !billing.plan) return;
  const allowed = billing.plan.accounts;
  const room = Math.max(0, allowed - billing.connected);
  if (adding <= room) return;
  const left = room ? `You can add ${room} more.` : "No more can be added.";
  throw new ServiceError(
    `Your ${billing.plan.name} plan covers ${allowed} channels and ${billing.connected} are connected. ${left} Change plans at ${siteConfig.url}/settings/billing to connect more.`,
    402,
    { code: "channel_limit_reached" },
  );
}

/** Why the user may not publish now, or null when they may (for the publish workflow). */
export async function planProblem(userId: string, accountId?: string): Promise<string | null> {
  try {
    const billing = await requirePlan(userId);
    if (accountId && !billing.exempt) return lockedChannelProblem(accountId);
    return null;
  } catch (error) {
    if (error instanceof ServiceError && error.status === 402) return error.message;
    throw error;
  }
}

// ── checkout ─────────────────────────────────────────────────────────────────

const MAX_EXTRA_ACCOUNTS = 10_000;

/**
 * What the pricing page sends. Better Auth merges a hook's body into the request's rather
 * than replacing it, so anything else (a discount code, prices, a return URL) would reach
 * Dodo untouched: it is refused instead. Discount codes are entered on Dodo's own page.
 */
const CHECKOUT_FIELDS = new Set(["slug", "product_cart"]);

type CheckoutBody = Record<string, unknown> & {
  slug?: unknown;
  product_cart?: unknown;
};

/**
 * The checkout session the Dodo plugin may open for this user, whatever the browser sent:
 * one plan product, Studio's extra-account add-on only with Studio of the same period, the
 * trial only for someone who never had a subscription, and the user's own id as reference.
 * Any other field in the request is refused (CHECKOUT_FIELDS).
 */
export async function checkoutFor(userId: string, body: CheckoutBody) {
  const extraField = Object.keys(body).find((key) => !CHECKOUT_FIELDS.has(key));
  if (extraField)
    throw new ServiceError(`Checkout does not take ${extraField}.`, 400, {
      code: "unknown_field",
      field: extraField,
    });
  const billing = await billingOf(userId);
  if (billing.open)
    throw new ServiceError("You already have a plan. Change or resume it from Billing.", 409, {
      code: "conflict",
    });
  if (!billing.available) throw new ServiceError("Checkout is not open yet.", 503);

  const ids = catalog();
  let productId: string | undefined;
  let extra = 0;
  if (typeof body.slug === "string") {
    productId = checkoutProducts().find((product) => product.slug === body.slug)?.productId;
  } else if (Array.isArray(body.product_cart) && body.product_cart.length === 1) {
    const item = body.product_cart[0] as {
      product_id?: unknown;
      quantity?: unknown;
      addons?: unknown;
    };
    const plan = typeof item.product_id === "string" ? planOfProduct(item.product_id) : null;
    if (plan && (item.quantity === undefined || item.quantity === 1)) {
      productId = item.product_id as string;
      const addons = Array.isArray(item.addons) ? item.addons : [];
      const allowed = plan.plan === "studio" ? ids[`extra_account_${plan.period}`] : undefined;
      for (const addon of addons as { addon_id?: unknown; quantity?: unknown }[]) {
        const quantity = Number(addon.quantity);
        if (
          addon.addon_id !== allowed ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > MAX_EXTRA_ACCOUNTS
        )
          throw new ServiceError("That add-on is not for sale with this plan.", 400, {
            code: "invalid_field",
            field: "product_cart",
          });
        extra += quantity;
      }
    }
  }
  if (!productId)
    throw new ServiceError("Pick one of the plans on the pricing page.", 400, {
      code: "invalid_field",
      field: "product_cart",
    });

  const plan = planOfProduct(productId)!;
  return {
    product_cart: [
      {
        product_id: productId,
        quantity: 1,
        ...(extra && {
          addons: [{ addon_id: ids[`extra_account_${plan.period}`]!, quantity: extra }],
        }),
      },
    ],
    referenceId: userId,
    metadata: { userId },
    // Someone who has had a subscription before starts paying straight away.
    subscription_data: { trial_period_days: billing.status ? 0 : TRIAL_DAYS },
  };
}
