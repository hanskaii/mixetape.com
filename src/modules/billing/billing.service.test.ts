import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";

const state = vi.hoisted(() => ({
  users: [] as Record<string, unknown>[],
  subscription: undefined as Record<string, unknown> | undefined,
  connected: 0,
  saved: [] as Record<string, unknown>[],
}));

vi.mock("#/database", () => ({
  db: {
    query: {
      user: { findFirst: async () => state.users.shift() },
      subscriptions: { findFirst: async () => state.subscription },
    },
    select: () => ({ from: () => ({ where: async () => [{ connected: state.connected }] }) }),
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
import { checkoutProducts, recordSubscription, requirePlan } from "./billing.service";

beforeEach(() => {
  // The stub's env takes any binding; the generated Env type pins this var to its default.
  Object.assign(env, {
    DODO_CATALOG: JSON.stringify({
      creator_monthly: "pdt_mm",
      creator_yearly: "pdt_my",
      studio_monthly: "pdt_om",
      studio_yearly: "pdt_oy",
      extra_account_monthly: "adn_m",
      extra_account_yearly: "adn_y",
    }),
  });
  state.users = [];
  state.subscription = undefined;
  state.connected = 0;
  state.saved = [];
});

describe("catalog", () => {
  it("maps every plan and period to a checkout slug", () => {
    expect(checkoutProducts()).toEqual([
      { slug: "creator-monthly", productId: "pdt_mm" },
      { slug: "creator-yearly", productId: "pdt_my" },
      { slug: "studio-monthly", productId: "pdt_om" },
      { slug: "studio-yearly", productId: "pdt_oy" },
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
        product_id: "pdt_oy",
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
