import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";

const state = vi.hoisted(() => ({
  users: [] as Record<string, unknown>[],
  subscription: undefined as Record<string, unknown> | undefined,
  // billingOf asks for the entitled, the open, then the latest subscription, in that order.
  subQueue: [] as (Record<string, unknown> | undefined)[],
  connected: 0,
  saved: [] as Record<string, unknown>[],
}));

vi.mock("#/database", () => ({
  db: {
    query: {
      user: { findFirst: async () => state.users.shift() },
      subscriptions: {
        findFirst: async () =>
          state.subQueue.length ? state.subQueue.shift() : state.subscription,
      },
    },
    select: () => ({ from: () => ({ where: async () => [{ connected: state.connected }] }) }),
    update: () => ({ set: () => ({ where: async () => {} }) }),
    insert: () => ({
      values: (row: Record<string, unknown>) => ({
        onConflictDoUpdate: async () => {
          state.saved.push(row);
        },
      }),
    }),
  },
}));
vi.mock("#/modules/secrets/secrets.service", () => ({ secret: async () => "key" }));

import { ServiceError } from "#/modules/api/errors";
import {
  checkoutFor,
  checkoutProducts,
  planProblem,
  recordSubscription,
  requirePlan,
} from "./billing.service";

beforeEach(() => {
  // The stub's env takes any binding; the generated Env type pins this var to its default.
  Object.assign(env, {
    DODO_CATALOG: JSON.stringify({
      creator_monthly: "pdt_cm",
      creator_yearly: "pdt_cy",
      studio_monthly: "pdt_sm",
      studio_yearly: "pdt_sy",
      extra_account_monthly: "adn_m",
      extra_account_yearly: "adn_y",
    }),
  });
  state.users = [];
  state.subscription = undefined;
  state.subQueue = [];
  state.connected = 0;
  state.saved = [];
});

describe("catalog", () => {
  it("maps every plan and period to a checkout slug", () => {
    expect(checkoutProducts()).toEqual([
      { slug: "creator-monthly", productId: "pdt_cm" },
      { slug: "creator-yearly", productId: "pdt_cy" },
      { slug: "studio-monthly", productId: "pdt_sm" },
      { slug: "studio-yearly", productId: "pdt_sy" },
    ]);
  });
});

describe("subscription webhooks", () => {
  it("records Studio's extra accounts from the add-on of the same period", async () => {
    state.users = [{ id: "u1" }];
    await recordSubscription({
      type: "subscription.active",
      data: {
        subscription_id: "sub_1",
        product_id: "pdt_sy",
        status: "active",
        addons: [{ addon_id: "adn_y", quantity: 25 }],
        next_billing_date: "2027-10-05T00:00:00Z",
        metadata: { referenceId: "u1" },
      },
    });
    expect(state.saved).toEqual([
      expect.objectContaining({
        id: "sub_1",
        userId: "u1",
        plan: "studio",
        period: "yearly",
        status: "active",
        accounts: 125,
        cancelAtPeriodEnd: false,
      }),
    ]);
  });

  it("ignores products that are not plans", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await recordSubscription({
      type: "subscription.active",
      data: { subscription_id: "sub_2", product_id: "pdt_other", status: "active" },
    });
    expect(state.saved).toEqual([]);
  });
});

describe("publishing needs a plan", () => {
  const creator = { plan: "creator", period: "monthly", accounts: 15, status: "active" };

  it("lets an exempt account publish without one", async () => {
    state.users = [{ billingExempt: true }];
    await expect(requirePlan("u1")).resolves.toBeUndefined();
  });

  it("refuses without a plan", async () => {
    state.users = [{ billingExempt: false }];
    await expect(requirePlan("u1")).rejects.toMatchObject({
      status: 402,
      code: "plan_required",
    });
  });

  it("refuses when more channels are connected than the plan covers", async () => {
    state.users = [{ billingExempt: false }];
    state.subscription = creator;
    state.connected = 16;
    const error = await requirePlan("u1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceError);
    expect(error).toMatchObject({ code: "plan_limit_reached" });
  });

  it("allows a plan that covers every channel", async () => {
    state.users = [{ billingExempt: false }];
    state.subscription = creator;
    state.connected = 15;
    await expect(requirePlan("u1")).resolves.toBeUndefined();
  });
});

describe("the publish workflow's check", () => {
  it("says why a post may not go out, and nothing when it may", async () => {
    state.users = [{ billingExempt: false }];
    expect(await planProblem("u1")).toMatch(/needs a plan/);
    state.users = [{ billingExempt: true }];
    expect(await planProblem("u1")).toBeNull();
  });
});

describe("checkout, whatever the browser sends", () => {
  const studioYearly = (addons: unknown[]) => ({
    product_cart: [{ product_id: "pdt_sy", quantity: 1, addons }],
  });

  it("gives a first-time customer the trial and their own reference", async () => {
    state.users = [{ billingExempt: false }];
    const body = await checkoutFor("u1", { slug: "creator-monthly" });
    expect(body).toEqual({
      product_cart: [{ product_id: "pdt_cm", quantity: 1 }],
      referenceId: "u1",
      metadata: { userId: "u1" },
      subscription_data: { trial_period_days: 7 },
    });
  });

  it("charges straight away someone who had a subscription before", async () => {
    state.users = [{ billingExempt: false }];
    state.subQueue = [undefined, undefined, { status: "cancelled" }];
    const body = await checkoutFor("u1", { slug: "studio-yearly" });
    expect(body.subscription_data).toEqual({ trial_period_days: 0 });
  });

  it("refuses a second subscription while one is not over", async () => {
    state.users = [{ billingExempt: false }];
    state.subQueue = [undefined, { status: "on_hold" }, { status: "on_hold" }];
    await expect(checkoutFor("u1", { slug: "creator-monthly" })).rejects.toMatchObject({
      status: 409,
    });
  });

  it("keeps Studio's extra accounts, with the add-on of the same period", async () => {
    state.users = [{ billingExempt: false }];
    const body = await checkoutFor("u1", studioYearly([{ addon_id: "adn_y", quantity: 40 }]));
    expect(body.product_cart).toEqual([
      { product_id: "pdt_sy", quantity: 1, addons: [{ addon_id: "adn_y", quantity: 40 }] },
    ]);
  });

  it.each([
    ["a product that is not a plan", { product_cart: [{ product_id: "pdt_other" }] }],
    ["two plans at once", { product_cart: [{ product_id: "pdt_cm" }, { product_id: "pdt_sm" }] }],
    ["more than one of a plan", { product_cart: [{ product_id: "pdt_cm", quantity: 2 }] }],
    ["the monthly add-on on a yearly plan", studioYearly([{ addon_id: "adn_m", quantity: 1 }])],
    ["a negative add-on", studioYearly([{ addon_id: "adn_y", quantity: -5 }])],
    [
      "extra accounts on Creator",
      { product_cart: [{ product_id: "pdt_cm", addons: [{ addon_id: "adn_m", quantity: 3 }] }] },
    ],
    ["an unknown slug", { slug: "free-forever" }],
  ])("refuses %s", async (_name, body) => {
    state.users = [{ billingExempt: false }];
    await expect(checkoutFor("u1", body)).rejects.toMatchObject({ status: 400 });
  });
});
