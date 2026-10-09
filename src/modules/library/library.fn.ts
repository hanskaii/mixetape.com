import { createServerFn } from "@tanstack/react-start";
import { currentUserId, payingUserId } from "#/modules/auth/auth.server";
import type { JsonValue } from "#/database/schema";
import * as brands from "#/modules/social/brands.service";
import { platformFields } from "#/modules/social/fields";
import { getProvider } from "#/modules/social/providers";
import * as social from "#/modules/social/social.service";
import { tiktokCreatorInfo } from "#/modules/social/providers/tiktok/creator";
import * as files from "#/modules/storage/files.service";
import * as groups from "./groups.service";
import * as publishing from "./publish.service";

/**
 * Server functions behind the Library page — the same services the library and storage
 * tools use, so what a person groups here is what an agent finds, and the other way round.
 */

type Metadata = Record<string, JsonValue>;

const PENDING = new Set(["scheduled", "publishing", "uploaded"]);

export const getLibraryData = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await payingUserId();
  const [groupList, fileList, accounts, brandList, pending] = await Promise.all([
    groups.listGroups(userId, { limit: 200 }),
    files.listFiles(userId, { loose: true, limit: 80 }),
    social.listAccounts(userId),
    brands.listBrands(userId),
    social.listPosts(userId, { status: files.NEEDS_FILES, limit: 500 }),
  ]);
  // How many posts not yet out use each file, for the "scheduled" mark on its card.
  const scheduled: Record<string, number> = {};
  for (const post of pending.posts)
    if (PENDING.has(post.status))
      for (const item of social.postMedia(post))
        scheduled[item.url] = (scheduled[item.url] ?? 0) + 1;
  // Files storage keeps for a post (failed and paused ones, thumbnails included): no
  // countdown on their cards.
  const held = files.heldBy(
    pending.posts,
    fileList.files.map((file) => file.url),
  );

  const providers = [...new Set(accounts.map((account) => account.provider))];
  return {
    groups: groupList.groups,
    files: fileList,
    scheduled,
    held,
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name.trim(),
      provider: account.provider,
      avatar: account.avatar,
      status: account.status,
    })),
    brands: brandList,
    // Each platform the user posts to: its form, and which shared words it takes.
    platforms: providers.map((id) => {
      const provider = getProvider(id);
      return {
        id,
        name: provider.name,
        fields: platformFields(id),
        takesTitle: Boolean(provider.textFields?.title),
        takesDescription: Boolean(provider.textFields?.description),
      };
    }),
    retentionHours: files.UNATTACHED_HOURS,
  };
});

export const listLooseFiles = createServerFn({ method: "GET" })
  .validator((data: { search?: string; kind?: string[]; cursor?: string }) => data)
  .handler(async ({ data }) =>
    files.listFiles(await payingUserId(), { ...data, loose: true, limit: 80 }),
  );

// ── groups ──────────────────────────────────────────────────────────────────

export const createGroupFromFiles = createServerFn({ method: "POST" })
  .validator((data: { fileIds: string[]; title?: string }) => data)
  .handler(async ({ data }) =>
    groups.createGroup(await payingUserId(), { fileIds: data.fileIds, title: data.title }, "user"),
  );

export const addFilesToGroup = createServerFn({ method: "POST" })
  .validator((data: { groupId: string; fileIds: string[] }) => data)
  .handler(async ({ data }) => groups.addToGroup(await payingUserId(), data.groupId, data.fileIds));

export const ungroupFiles = createServerFn({ method: "POST" })
  .validator((data: { fileIds: string[] }) => data)
  .handler(async ({ data }) => groups.ungroupFiles(await payingUserId(), data.fileIds));

export const saveGroup = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      title?: string | null;
      caption?: string | null;
      description?: string | null;
      fileIds?: string[];
    }) => data,
  )
  .handler(async ({ data: { id, ...changes } }) =>
    groups.updateGroup(await payingUserId(), id, changes),
  );

export const removeGroup = createServerFn({ method: "POST" })
  .validator((data: { id: string; deleteFiles: boolean }) => data)
  .handler(async ({ data }) =>
    groups.deleteGroup(await currentUserId(), data.id, { deleteFiles: data.deleteFiles }),
  );

// ── publishing ──────────────────────────────────────────────────────────────

type Selection = {
  fileIds: string[];
  groupId?: string;
  draft: { title?: string; caption?: string; description?: string; metadata?: Metadata };
  brandIds: string[];
  accountIds: string[];
};

const source = (userId: string, data: Selection) =>
  publishing.filesSource(userId, data.fileIds, data.draft, data.groupId);

export const planSelection = createServerFn({ method: "POST" })
  .validator((data: Selection) => data)
  .handler(async ({ data }) => {
    const userId = await payingUserId();
    return publishing.planPost(userId, await source(userId, data), data);
  });

export const publishSelection = createServerFn({ method: "POST" })
  .validator((data: Selection & { scheduledAt?: string }) => data)
  .handler(async ({ data }) => {
    const userId = await payingUserId();
    const result = await publishing.publishPost(userId, await source(userId, data), data, {
      scheduledAt: data.scheduledAt,
    });
    // The group keeps the words it went out with, for next time.
    if (data.groupId) {
      const { title, caption, description } = data.draft;
      await groups.updateGroup(userId, data.groupId, { title, caption, description });
    }
    return result;
  });

/**
 * TikTok's creator info for the chosen accounts, read fresh each time TikTok's form opens
 * (TikTok's Direct Post rules): who the post goes to, the privacy levels and interactions
 * each allows, its longest video, or why it cannot post now.
 */
export const getTikTokCreators = createServerFn({ method: "POST" })
  .validator((data: { accountIds: string[] }) => ({
    accountIds: (Array.isArray(data?.accountIds) ? data.accountIds : []).map(String).slice(0, 20),
  }))
  .handler(async ({ data }) => {
    const userId = await payingUserId();
    return Promise.all(
      data.accountIds.map(async (accountId) => {
        const account = await social.loadAccount(userId, accountId);
        if (account.provider !== "tiktok") throw new Error("Not a TikTok account");
        const creator = await tiktokCreatorInfo(await social.accessTokenFor(account));
        return { accountId, name: account.name.trim(), ...creator };
      }),
    );
  });
