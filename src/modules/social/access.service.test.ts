import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => ({ list: [] as Record<string, unknown>[] }));
const social = vi.hoisted(() => ({ accessTokenFor: vi.fn(), deleteAccount: vi.fn() }));
const updates = vi.hoisted(() => ({ set: [] as Record<string, unknown>[] }));

vi.mock("#/database/index", () => ({
  db: {
    query: { socialAccounts: { findMany: async () => rows.list } },
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updates.set.push(values);
        return { where: async () => {} };
      },
    }),
  },
}));
vi.mock("./social.service", () => social);
vi.mock("./providers", () => ({
  getProvider: () => ({
    connect: {
      accounts: async () => [
        { platformAccountId: "UC-a", name: "Renamed", handle: "@renamed", avatar: "a.jpg" },
      ],
    },
  }),
}));

import { ServiceError } from "#/modules/api/errors";
import { checkRevokedAccess, deleteRevokedAccounts } from "./access.service";
import { REVOKED_DAYS, removalDate } from "./revocation";

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  rows.list = [];
  social.accessTokenFor.mockReset();
  social.deleteAccount.mockReset();
  updates.set = [];
});

describe("revoked access", () => {
  it("deletes a revoked YouTube channel within 7 days of the revocation", () => {
    const revokedAt = new Date("2026-10-01T00:00:00Z");
    const date = removalDate({ provider: "youtube", revokedAt });
    expect(date!.getTime() - revokedAt.getTime()).toBe(REVOKED_DAYS * DAY);
    // The daily check finds it at most a day late.
    expect(REVOKED_DAYS + 1).toBeLessThanOrEqual(7);
  });

  it("keeps other platforms' channels, and channels never revoked", () => {
    expect(removalDate({ provider: "instagram", revokedAt: new Date() })).toBeNull();
    expect(removalDate({ provider: "youtube", revokedAt: null })).toBeNull();
  });

  it("asks YouTube for a fresh token and counts the refusals", async () => {
    rows.list = [
      { id: "a", provider: "youtube", platformAccountId: "UC-a" },
      { id: "b", provider: "youtube", platformAccountId: "UC-b" },
      { id: "c", provider: "youtube", platformAccountId: "UC-c" },
    ];
    social.accessTokenFor
      .mockResolvedValueOnce("token")
      .mockRejectedValueOnce(new ServiceError("revoked", 409, { code: "account_needs_reconnect" }))
      .mockRejectedValueOnce(new Error("network"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await checkRevokedAccess()).toEqual({ checked: 3, revoked: 1 });
    expect(social.accessTokenFor).toHaveBeenCalledWith(rows.list[0], { fresh: true });
    // The channel YouTube still knows gets its current name, handle and avatar.
    expect(updates.set).toEqual([
      expect.objectContaining({ name: "Renamed", handle: "@renamed", avatar: "a.jpg" }),
    ]);
  });

  it("deletes only the YouTube channels that are due", async () => {
    rows.list = [
      { id: "yt", userId: "u", provider: "youtube" },
      { id: "ig", userId: "u", provider: "instagram" },
    ];
    expect(await deleteRevokedAccounts()).toEqual({ deleted: 1 });
    expect(social.deleteAccount).toHaveBeenCalledExactlyOnceWith("u", "yt");
  });
});
