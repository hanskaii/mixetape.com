import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  hooks: [] as Record<string, unknown>[],
  created: [] as { id: string; params: unknown }[],
}));

vi.mock("cloudflare:workers", () => ({
  env: {
    WEBHOOK_WORKFLOW: {
      create: async (options: { id: string; params: unknown }) => {
        if (state.created.some((item) => item.id === options.id))
          throw new Error(`instance ${options.id} already exists`);
        state.created.push(options);
      },
    },
  },
}));
vi.mock("#/database/index", () => ({
  db: { query: { webhooks: { findMany: async () => state.hooks } } },
}));

import { emitEvent, sign } from "./webhooks.service";

beforeEach(() => {
  state.hooks = [];
  state.created = [];
});

describe("webhooks", () => {
  it("signs like Standard Webhooks (the specification's test vector)", async () => {
    expect(
      await sign(
        "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
        "msg_p5jXN8AQM9LWM0D4loKWxJek",
        1614265330,
        '{"test": 2432232314}',
      ),
    ).toBe("v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=");
  });

  it("queues an event once per webhook that wants it, however often it is announced", async () => {
    state.hooks = [
      { id: "a", events: ["post.published", "post.failed"] },
      { id: "b", events: ["post.failed"] },
    ];
    await emitEvent("u", "post.published", { post: { id: "p1" } }, "p1:published:1");
    await emitEvent("u", "post.published", { post: { id: "p1" } }, "p1:published:1");
    expect(state.created).toHaveLength(1);
    expect(state.created[0].id).toMatch(/^a-evt_[0-9a-f]{24}$/);
    expect(state.created[0].params).toMatchObject({
      webhookId: "a",
      event: { type: "post.published", data: { post: { id: "p1" } } },
    });

    // A later attempt is a new event.
    await emitEvent("u", "post.published", { post: { id: "p1" } }, "p1:published:2");
    expect(state.created).toHaveLength(2);
  });

  it("never throws at the caller", async () => {
    state.hooks = [{ id: "a", events: ["post.failed"] }];
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = state.created;
    state.created = null as never;
    await expect(emitEvent("u", "post.failed", {}, "k")).resolves.toBeUndefined();
    state.created = failing;
  });
});
