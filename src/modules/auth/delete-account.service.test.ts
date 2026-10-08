import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";

const state = vi.hoisted(() => ({
  person: undefined as Record<string, unknown> | undefined,
  renewing: undefined as Record<string, unknown> | undefined,
  deletedUser: false,
  deletedKeys: [] as string[],
  calls: [] as string[],
}));

vi.mock("#/database", () => ({
  db: {
    query: {
      user: { findFirst: async () => state.person },
      subscriptions: { findFirst: async () => state.renewing },
    },
    delete: () => ({
      where: async () => {
        state.deletedUser = true;
        state.calls.push("user");
      },
    }),
  },
}));
vi.mock("#/modules/billing/lifecycle.service", () => ({
  deleteWorkspaceData: async () => void state.calls.push("workspace"),
}));
vi.mock("#/modules/email/email.service", () => ({
  sendEmail: async () => void state.calls.push("email"),
}));

import { deleteUserAccount } from "./delete-account.service";

beforeEach(() => {
  state.person = { id: "u1", email: "Someone@Example.com", billingExempt: false };
  state.renewing = undefined;
  state.deletedUser = false;
  state.deletedKeys = [];
  state.calls = [];
  Object.assign(env, {
    BUCKET: {
      list: async ({ prefix }: { prefix: string }) => ({
        objects: [{ key: `${prefix}a` }],
        truncated: false,
      }),
      delete: async (keys: string[]) => void state.deletedKeys.push(...keys),
    },
  });
});

describe("deleting an account", () => {
  it("needs the account's email typed to confirm", async () => {
    await expect(deleteUserAccount("u1", "other@example.com")).rejects.toMatchObject({
      status: 400,
    });
    expect(state.deletedUser).toBe(false);
  });

  it("refuses while a plan still renews, so nobody is charged for a deleted account", async () => {
    state.renewing = { id: "sub_1", status: "active", cancelAtPeriodEnd: false };
    await expect(deleteUserAccount("u1", "someone@example.com")).rejects.toMatchObject({
      status: 409,
    });
    expect(state.calls).toEqual([]);
  });

  it("deletes the workspace, the bucket's files, then the account, and says so by email", async () => {
    await expect(deleteUserAccount("u1", " someone@example.com ")).resolves.toEqual({
      deleted: true,
    });
    expect(state.calls).toEqual(["workspace", "user", "email"]);
    expect(state.deletedKeys.sort()).toEqual(["avatars/u1/a", "media/u1/a"]);
  });

  it("lets an exempt account go without a plan check", async () => {
    state.person = { id: "u1", email: "a@b.c", billingExempt: true };
    state.renewing = { id: "sub_1", status: "active", cancelAtPeriodEnd: false };
    await expect(deleteUserAccount("u1", "a@b.c")).resolves.toEqual({ deleted: true });
  });
});
