import type { JsonValue } from "#/database/schema";
import { ServiceError } from "#/modules/api/errors";
import * as brands from "#/modules/social/brands.service";
import { checkFormat, type FormatCheck } from "#/modules/social/formats";
import { InvalidInputError, getProvider, type Metadata } from "#/modules/social/providers";
import * as social from "#/modules/social/social.service";
import { fileView, type FileView } from "#/modules/storage/files.service";
import { getGroup, readyFiles } from "./groups.service";

/**
 * Publishing from the library: a selection of files (a group, or files picked by hand) and
 * its words, to brands (every channel in them) and single channels.
 *
 * `planPost` answers, channel by channel, whether the files can go there, as what (a Short,
 * a Reel, a carousel…) and exactly what would be posted — without posting; `publishPost`
 * creates one post per channel that can take it.
 *
 * What each channel gets: the caption as the post caption; the shared metadata fields that
 * platform knows; the title and description where the platform has them
 * (provider.textFields: YouTube and Pinterest take both, Facebook only a title, for videos),
 * an empty description falling back to the caption; then that platform's own overrides. A `caption` override on a
 * platform without a caption field of its own replaces the caption there. On top, the
 * obvious choice where the files make it one: a short upright video goes to Facebook as a
 * Reel.
 */

export type Target = { brandIds?: string[]; accountIds?: string[] };

/** The words for a post: what an agent drafted on a group, or what the person typed. */
export type Draft = {
  title?: string | null;
  caption?: string | null;
  description?: string | null;
  metadata?: Metadata;
};

export type Source = { files: FileView[]; draft: Draft; groupId?: string };

export type PlanRow = {
  accountId: string;
  name: string;
  provider: string;
  platform: string;
  /** The chosen brands this channel is in. */
  brands: string[];
  /** The platform takes these files at all (whatever else it still needs). */
  fits: boolean;
  ready: boolean;
  format: FormatCheck["format"];
  /** What the post is on this platform: "Short", "Reel", "Carousel", "Album"… */
  label: string;
  problems: string[];
  warnings: string[];
  /** What the post would carry. */
  caption: string | null;
  metadata: Metadata;
};

export async function groupSource(userId: string, groupId: string): Promise<Source> {
  const group = await getGroup(userId, groupId);
  return { files: group.files, draft: group, groupId };
}

export async function filesSource(
  userId: string,
  fileIds: string[],
  draft: Draft,
  groupId?: string,
): Promise<Source> {
  if (!fileIds.length)
    throw new ServiceError("Choose the files to publish", 400, {
      code: "missing_field",
      field: "fileIds",
    });
  const files = await readyFiles(userId, fileIds);
  return { files: files.map((file) => fileView(file, groupId ?? null)), draft, groupId };
}

/** The channels a target names: those of its brands and the ones given directly. */
async function channelsFor(userId: string, target: Target) {
  const brandIds = [...new Set(target.brandIds ?? [])];
  const accountIds = new Set(target.accountIds ?? []);
  if (!brandIds.length && !accountIds.size)
    throw new ServiceError("Choose brands or channels to publish to", 400, {
      code: "missing_field",
      field: "accountIds",
    });

  const [allBrands, accounts] = await Promise.all([
    brandIds.length ? brands.listBrands(userId) : [],
    social.listAccounts(userId),
  ]);
  const chosenBrands = brandIds.map((id) => {
    const brand = allBrands.find((candidate) => candidate.id === id);
    if (!brand) throw new ServiceError(`Brand not found: ${id}`, 404);
    return brand;
  });
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

type Channel = Awaited<ReturnType<typeof channelsFor>>[number];

const isObject = (value: JsonValue | undefined): value is Record<string, JsonValue> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const upright = (file: FileView) => Boolean(file.width && file.height && file.height > file.width);

/** Choices the files make obvious, unless the draft already made them. */
function smartDefaults(provider: string, files: FileView[], metadata: Metadata): Metadata {
  const [only] = files;
  if (
    provider === "facebook" &&
    files.length === 1 &&
    only.kind === "video" &&
    upright(only) &&
    only.durationMs &&
    only.durationMs >= 3_000 &&
    only.durationMs <= 90_000 &&
    metadata.format === undefined
  )
    return { ...metadata, format: "reel" };
  return metadata;
}

/** What the post is on the platform, in its own words. */
export function postLabel(provider: string, files: FileView[], metadata: Metadata): string {
  if (files.length > 1)
    return provider === "facebook"
      ? "Album"
      : provider === "pinterest"
        ? "Carousel Pin"
        : "Carousel";
  const [file] = files;
  if (file.kind === "image") return provider === "pinterest" ? "Pin" : "Photo";
  switch (provider) {
    case "youtube":
      return upright(file) && (file.durationMs ?? Infinity) <= 180_000 ? "Short" : "Video";
    case "instagram":
      return "Reel";
    case "facebook":
      return metadata.format === "reel" ? "Reel" : "Video";
    case "pinterest":
      return "Video Pin";
    default:
      return "Video";
  }
}

/** The caption and raw (not yet validated) metadata a draft gives a platform. */
export function postFields(draft: Draft, provider: string, files: FileView[] = []) {
  const platform = getProvider(provider);
  const known = new Set(
    Object.keys((platform.metadata.schema.properties as Record<string, unknown> | undefined) ?? {}),
  );
  const { platforms, ...shared } = draft.metadata ?? {};
  const overrides: Metadata = {
    ...(isObject(platforms) && isObject(platforms[provider]) ? platforms[provider] : {}),
  };

  const metadata: Metadata = {};
  for (const [key, value] of Object.entries(shared)) if (known.has(key)) metadata[key] = value;
  const { title, description } = platform.textFields ?? {};
  if (title && draft.title && metadata[title] === undefined) metadata[title] = draft.title;
  // An empty description is the caption: a YouTube video is never left without one.
  const longText = draft.description || draft.caption;
  if (description && longText && metadata[description] === undefined)
    metadata[description] = longText;

  let caption = draft.caption ?? null;
  if ("caption" in overrides && !known.has("caption")) {
    const value = overrides.caption;
    caption = typeof value === "string" ? value : null;
    delete overrides.caption;
  }
  return { caption, metadata: smartDefaults(provider, files, { ...metadata, ...overrides }) };
}

function planFor(source: Source, channel: Channel): PlanRow {
  const platform = getProvider(channel.provider);
  const check = checkFormat(platform.name, platform.formats, source.files);
  const problems = [...check.problems];
  if (channel.status !== "active") problems.push("The channel needs reconnecting");

  const { caption, metadata } = postFields(source.draft, channel.provider, source.files);
  let validated = metadata;
  if (!check.problems.length)
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
    fits: check.problems.length === 0,
    ready: problems.length === 0,
    format: check.format,
    label: check.problems.length ? "" : postLabel(channel.provider, source.files, validated),
    problems,
    warnings: check.warnings,
    caption,
    metadata: validated,
  };
}

/** Channel by channel: can the files go there, as what, and what would be posted. */
export async function planPost(userId: string, source: Source, target: Target) {
  if (!source.files.length)
    throw new ServiceError("There is no file to publish", 409, { code: "nothing_to_publish" });
  const channels = await channelsFor(userId, target);
  return { channels: channels.map((channel) => planFor(source, channel)) };
}

/**
 * Publishes the files to every targeted channel that can take them, one post each. Channels
 * that cannot are skipped with their reasons; a post a platform check still refuses is
 * reported as failed without stopping the others. Each post lets go of the files once it is
 * out; storage deletes them when the last one is.
 */
export async function publishPost(
  userId: string,
  source: Source,
  target: Target,
  options: { scheduledAt?: string; leadMinutes?: number } = {},
) {
  if (!source.files.length)
    throw new ServiceError("There is no file to publish", 409, { code: "nothing_to_publish" });
  const channels = await channelsFor(userId, target);

  const scheduled: { accountId: string; name: string; provider: string; postId: string }[] = [];
  const skipped: { accountId: string; name: string; provider: string; problems: string[] }[] = [];
  const failed: { accountId: string; name: string; provider: string; error: string }[] = [];

  for (const channel of channels) {
    const plan = planFor(source, channel);
    const who = { accountId: plan.accountId, name: plan.name, provider: plan.provider };
    if (!plan.ready) {
      skipped.push({ ...who, problems: plan.problems });
      continue;
    }
    const { caption, metadata } = postFields(source.draft, channel.provider, source.files);
    try {
      const post = await social.createPost(userId, {
        accountId: channel.id,
        media: source.files.map((file) => file.url),
        caption: caption ?? undefined,
        metadata,
        scheduledAt: options.scheduledAt,
        // Omitted, each platform keeps its own default; one it refuses fails only that channel.
        leadMinutes: options.leadMinutes,
        groupId: source.groupId,
      });
      scheduled.push({ ...who, postId: post.id });
    } catch (error) {
      if (!(error instanceof ServiceError)) throw error;
      failed.push({ ...who, error: error.message });
    }
  }
  return { scheduled, skipped, failed };
}
