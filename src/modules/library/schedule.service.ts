import type { JsonValue } from "#/database/schema";
import { ServiceError } from "#/modules/api/errors";
import * as brands from "#/modules/social/brands.service";
import { checkFormat, type FormatCheck } from "#/modules/social/formats";
import { InvalidInputError, getProvider, type Metadata } from "#/modules/social/providers";
import * as social from "#/modules/social/social.service";
import { getItem, type ItemView } from "./library.service";

/**
 * Sending a library item out: to brands (every channel in them) and to single channels.
 * `planItem` answers, channel by channel, whether the item can go there and exactly what
 * would be posted — the compatibility matrix — without scheduling anything; `scheduleItem`
 * then creates one post per channel that can take it, linked back to the item.
 *
 * What each channel gets: the item's caption as the post caption; its shared metadata,
 * only the fields that platform knows; its title and description where the platform has
 * them (provider.textFields); then that platform's own overrides on top. A `caption` in a
 * platform's overrides replaces the caption for that platform.
 */

export type Target = { brandIds?: string[]; accountIds?: string[] };

export type PlanRow = {
  accountId: string;
  name: string;
  provider: string;
  platform: string;
  /** The chosen brands this channel is in. */
  brands: string[];
  ready: boolean;
  format: FormatCheck["format"];
  problems: string[];
  warnings: string[];
  /** What the post would carry. */
  caption: string | null;
  metadata: Metadata;
};

/** The channels a target names: those of its brands and the ones given directly. */
async function channelsFor(userId: string, target: Target) {
  const brandIds = [...new Set(target.brandIds ?? [])];
  const accountIds = new Set(target.accountIds ?? []);
  if (!brandIds.length && !accountIds.size)
    throw new ServiceError("Choose brands or channels to send the content to");

  const [allBrands, accounts] = await Promise.all([
    brandIds.length ? brands.listBrands(userId) : [],
    social.listAccounts(userId),
  ]);
  const chosenBrands = brandIds.map(
    (id) =>
      allBrands.find((brand) => brand.id === id) ??
      (() => {
        throw new ServiceError(`Brand not found: ${id}`, 404);
      })(),
  );
  for (const id of accountIds)
    if (!accounts.some((account) => account.id === id))
      throw new ServiceError(`Account not found: ${id}`, 404);
  for (const brand of chosenBrands) for (const id of brand.accountIds) accountIds.add(id);

  return accounts
    .filter((account) => accountIds.has(account.id))
    .map((account) => ({
      ...account,
      brands: chosenBrands
        .filter((brand) => brand.accountIds.includes(account.id))
        .map((brand) => brand.name),
    }));
}

const isObject = (value: JsonValue | undefined): value is Record<string, JsonValue> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The caption and raw (not yet validated) metadata an item gives a platform. */
export function postFields(
  item: Pick<ItemView, "title" | "caption" | "description" | "metadata">,
  provider: string,
) {
  const platform = getProvider(provider);
  const known = new Set(
    Object.keys((platform.metadata.schema.properties as Record<string, unknown> | undefined) ?? {}),
  );
  const { platforms, ...shared } = item.metadata;
  const overrides = {
    ...(isObject(platforms) && isObject(platforms[provider]) ? platforms[provider] : {}),
  };

  const metadata: Metadata = {};
  for (const [key, value] of Object.entries(shared)) if (known.has(key)) metadata[key] = value;
  const { title, description } = platform.textFields ?? {};
  if (title && item.title && metadata[title] === undefined) metadata[title] = item.title;
  if (description && item.description && metadata[description] === undefined)
    metadata[description] = item.description;

  let caption = item.caption;
  if ("caption" in overrides && !known.has("caption")) {
    const value = overrides.caption;
    caption = typeof value === "string" ? value : null;
    delete overrides.caption;
  }
  return { caption, metadata: { ...metadata, ...overrides } };
}

function planFor(
  item: ItemView,
  channel: Awaited<ReturnType<typeof channelsFor>>[number],
): PlanRow {
  const platform = getProvider(channel.provider);
  const check = checkFormat(platform.name, platform.formats, item.files);
  const problems = [...check.problems];
  if (channel.status !== "active") problems.push("The channel needs reconnecting");

  const { caption, metadata } = postFields(item, channel.provider);
  let validated = metadata;
  try {
    validated = platform.metadata.validate(metadata, caption);
  } catch (error) {
    if (!(error instanceof InvalidInputError)) throw error;
    problems.push(error.message);
  }
  return {
    accountId: channel.id,
    name: channel.name.trim(),
    provider: channel.provider,
    platform: platform.name,
    brands: channel.brands,
    ready: problems.length === 0,
    format: check.format,
    problems,
    warnings: check.warnings,
    caption,
    metadata: validated,
  };
}

/** Channel by channel: can the item go there, and what would be posted. Schedules nothing. */
export async function planItem(userId: string, itemId: string, target: Target) {
  const [item, channels] = await Promise.all([
    getItem(userId, itemId),
    channelsFor(userId, target),
  ]);
  if (!item.files.length) throw new ServiceError("The content has no file to post", 409);
  return { itemId, channels: channels.map((channel) => planFor(item, channel)) };
}

/**
 * Schedules the item to every targeted channel that can take it, one post each. Channels
 * that cannot are skipped with their reasons; a post the platform check still refuses is
 * reported as failed without stopping the others.
 */
export async function scheduleItem(
  userId: string,
  itemId: string,
  target: Target,
  timing: { scheduledAt?: string; leadMinutes?: number } = {},
) {
  const item = await getItem(userId, itemId);
  if (!item.files.length) throw new ServiceError("The content has no file to post", 409);
  const channels = await channelsFor(userId, target);

  const scheduled: { accountId: string; name: string; provider: string; postId: string }[] = [];
  const skipped: { accountId: string; name: string; provider: string; problems: string[] }[] = [];
  const failed: { accountId: string; name: string; provider: string; error: string }[] = [];

  for (const channel of channels) {
    const plan = planFor(item, channel);
    const who = { accountId: plan.accountId, name: plan.name, provider: plan.provider };
    if (!plan.ready) {
      skipped.push({ ...who, problems: plan.problems });
      continue;
    }
    const { caption, metadata } = postFields(item, channel.provider);
    try {
      const post = await social.createPost(userId, {
        accountId: channel.id,
        media: item.files.map((file) => file.url),
        caption: caption ?? undefined,
        metadata,
        scheduledAt: timing.scheduledAt,
        // Omitted, each platform keeps its own default; one it refuses fails only that channel.
        leadMinutes: timing.leadMinutes,
        itemId: item.id,
      });
      scheduled.push({ ...who, postId: post.id });
    } catch (error) {
      if (!(error instanceof ServiceError)) throw error;
      failed.push({ ...who, error: error.message });
    }
  }
  return { itemId, scheduled, skipped, failed };
}
