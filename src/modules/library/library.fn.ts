import { createServerFn } from "@tanstack/react-start";
import { currentUserId } from "#/modules/auth/auth.server";
import type { JsonValue } from "#/database/schema";
import * as brands from "#/modules/social/brands.service";
import { platformFields } from "#/modules/social/fields";
import { getProvider } from "#/modules/social/providers";
import * as social from "#/modules/social/social.service";
import * as files from "#/modules/storage/files.service";
import * as groups from "./groups.service";
import * as publishing from "./schedule.service";

/**
 * Server functions behind the Library page — the same services the library and storage
 * tools use, so what a person groups here is what an agent finds, and the other way round.
 */

type Metadata = Record<string, JsonValue>;

const PENDING = ["scheduled", "publishing", "uploaded"];

export const getLibraryData = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await currentUserId();
  const [groupList, fileList, accounts, brandList, pending] = await Promise.all([
    groups.listGroups(userId, { limit: 200 }),
    files.listFiles(userId, { loose: true, limit: 80 }),
    social.listAccounts(userId),
    brands.listBrands(userId),
    social.listPosts(userId, { status: PENDING, limit: 500 }),
  ]);
  // How many posts not yet out use each file, for the "scheduled" mark on its card.
  const scheduled: Record<string, number> = {};
  for (const post of pending.posts)
    for (const item of social.postMedia(post)) scheduled[item.url] = (scheduled[item.url] ?? 0) + 1;

  const providers = [...new Set(accounts.map((account) => account.provider))];
  return {
    groups: groupList.groups,
    files: fileList,
    scheduled,
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
    retentionDays: files.RETENTION_DAYS,
  };
});

export const listLooseFiles = createServerFn({ method: "GET" })
  .validator((data: { search?: string; kind?: string[]; cursor?: string }) => data)
  .handler(async ({ data }) =>
    files.listFiles(await currentUserId(), { ...data, loose: true, limit: 80 }),
  );

// ── groups ──────────────────────────────────────────────────────────────────

export const createGroupFromFiles = createServerFn({ method: "POST" })
  .validator((data: { fileIds: string[]; title?: string }) => data)
  .handler(async ({ data }) =>
    groups.createGroup(await currentUserId(), { fileIds: data.fileIds, title: data.title }, "user"),
  );

export const addFilesToGroup = createServerFn({ method: "POST" })
  .validator((data: { groupId: string; fileIds: string[] }) => data)
  .handler(async ({ data }) =>
    groups.addToGroup(await currentUserId(), data.groupId, data.fileIds),
  );

export const ungroupFiles = createServerFn({ method: "POST" })
  .validator((data: { fileIds: string[] }) => data)
  .handler(async ({ data }) => groups.ungroupFiles(await currentUserId(), data.fileIds));

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
    groups.updateGroup(await currentUserId(), id, changes),
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
    const userId = await currentUserId();
    return publishing.planPost(userId, await source(userId, data), data);
  });

export const publishSelection = createServerFn({ method: "POST" })
  .validator((data: Selection & { scheduledAt?: string; keepFiles: boolean }) => data)
  .handler(async ({ data }) => {
    const userId = await currentUserId();
    const result = await publishing.publishPost(userId, await source(userId, data), data, {
      scheduledAt: data.scheduledAt,
      keepFiles: data.keepFiles,
    });
    // The group keeps the words it went out with, for next time.
    if (data.groupId) {
      const { title, caption, description } = data.draft;
      await groups.updateGroup(userId, data.groupId, { title, caption, description });
    }
    return result;
  });
