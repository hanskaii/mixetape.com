import type { JsonValue, SocialAccount } from "#/database/schema";
import {
  InvalidInputError,
  getProvider,
  type Capability,
  type CaptionInput,
  type CommentModeration,
  type Metadata,
  type SocialProvider,
} from "./providers";
import {
  accessTokenFor,
  getPost,
  loadAccount,
  loadForPublishing,
  missingScopes,
  updatePost,
} from "./social.service";
import { ServiceError } from "#/modules/api/errors";

/**
 * Work on what is already on a platform: a post's live details, thumbnail, playlists,
 * captions and comments, and an account's playlists. Every operation is written once
 * against a provider capability, so a new platform gets it by implementing the capability.
 */

const LABELS: Record<Capability, string> = {
  status: "status checks",
  thumbnails: "custom thumbnails",
  editing: "editing posts after they are published",
  collections: "playlists",
  captions: "captions",
  comments: "comments",
  analytics: "analytics",
};

type Use<C extends Capability> = NonNullable<SocialProvider[C]>;

function capability<C extends Capability>(provider: SocialProvider, name: C): Use<C> {
  const found = provider[name];
  if (!found) throw new ServiceError(`${provider.name} does not support ${LABELS[name]}`, 409);
  return found as Use<C>;
}

/** Runs a platform call; its failure becomes a ServiceError that says what went wrong. */
export async function platformCall<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (error instanceof InvalidInputError) throw new ServiceError(error.message);
    throw new ServiceError(error instanceof Error ? error.message : String(error), 502);
  }
}

function ensureScopes(account: SocialAccount) {
  if (missingScopes(account).length) {
    throw new ServiceError(
      `Reconnect "${account.name.trim()}" on Channels — mixetape now asks for more permissions than it was given`,
      409,
    );
  }
}

/** An owned account, a capability of its platform, and a token to use it with. */
export async function onAccount<C extends Capability>(userId: string, accountId: string, name: C) {
  const { account, credential } = await loadAccount(userId, accountId);
  const use = capability(getProvider(account.provider), name);
  ensureScopes(account);
  return { account, use, token: await accessTokenFor(account, credential) };
}

/** An owned post that is on its platform, a capability, and a token to use it with. */
export async function onPlatform<C extends Capability>(userId: string, postId: string, name: C) {
  const post = await getPost(userId, postId);
  if (!post.platformPostId) {
    throw new ServiceError(
      "This post is not on the platform yet — it goes up shortly before its scheduled time",
      409,
    );
  }
  const loaded = await loadForPublishing(postId);
  if (!loaded) throw new ServiceError("The post's account or credential is gone", 409);
  const use = capability(getProvider(post.provider), name);
  ensureScopes(loaded.account);
  return {
    post,
    platformPostId: post.platformPostId,
    use,
    token: await accessTokenFor(loaded.account, loaded.credential),
  };
}

const requiredText = (value: string | undefined, name: string) => {
  const text = (value ?? "").trim();
  if (!text) throw new ServiceError(`${name} is required`);
  return text;
};

// ── status, thumbnail, live edits ────────────────────────────────────────────

/** A post with what its platform says now: visibility, processing, rejection, counters. */
export async function postInsights(userId: string, id: string) {
  const post = await getPost(userId, id);
  if (!post.platformPostId || !getProvider(post.provider).status) return { post, platform: null };
  const { platformPostId, use, token } = await onPlatform(userId, id, "status");
  return { post, platform: await platformCall(() => use.fetch(platformPostId, token)) };
}

/**
 * Sets (or replaces) the thumbnail of a post already on the platform and remembers it. A
 * post still waiting in mixetape takes metadata.thumbnailUrl instead.
 */
export async function setPostThumbnail(userId: string, id: string, imageUrl: string) {
  if (!(imageUrl ?? "").startsWith("https://"))
    throw new ServiceError("imageUrl must be a public https URL");
  const { post, platformPostId, use, token } = await onPlatform(userId, id, "thumbnails");
  await platformCall(() => use.set(platformPostId, imageUrl, token));
  await updatePost(id, { metadata: { ...post.metadata, thumbnailUrl: imageUrl } });
  return getPost(userId, id);
}

/** Changes the details of a post that is already on the platform (title, tags, privacy…). */
export async function editPublishedPost(userId: string, id: string, changes: Metadata) {
  const { post, platformPostId, use, token } = await onPlatform(userId, id, "editing");
  await platformCall(() => use.update(platformPostId, changes, token));
  // Keep mixetape's copy in step; null clears a field.
  const metadata: Record<string, JsonValue> = { ...post.metadata };
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) delete metadata[key];
    else metadata[key] = value;
  }
  await updatePost(id, { metadata });
  return getPost(userId, id);
}

// ── collections (playlists) ──────────────────────────────────────────────────

export async function listCollections(userId: string, accountId: string) {
  const { use, token } = await onAccount(userId, accountId, "collections");
  return platformCall(() => use.list(token));
}

export async function createCollection(
  userId: string,
  accountId: string,
  input: { title?: string; description?: string; visibility?: string },
) {
  const title = requiredText(input.title, "title");
  const visibility = input.visibility ?? "public";
  if (!["public", "unlisted", "private"].includes(visibility))
    throw new ServiceError("visibility must be public, unlisted or private");
  const { use, token } = await onAccount(userId, accountId, "collections");
  return platformCall(() =>
    use.create(token, { title, description: input.description, visibility }),
  );
}

export async function addToCollection(
  userId: string,
  postId: string,
  collectionId: string,
  position?: number,
) {
  const id = requiredText(collectionId, "collectionId");
  if (position !== undefined && (!Number.isInteger(position) || position < 0))
    throw new ServiceError("position must be a whole number from 0");
  const { platformPostId, use, token } = await onPlatform(userId, postId, "collections");
  await platformCall(() => use.add(token, id, platformPostId, position));
  return { added: true, collectionId: id, postId };
}

// ── captions ─────────────────────────────────────────────────────────────────

export async function listCaptions(userId: string, postId: string) {
  const { platformPostId, use, token } = await onPlatform(userId, postId, "captions");
  return platformCall(() => use.list(platformPostId, token));
}

export async function putCaption(userId: string, postId: string, input: Partial<CaptionInput>) {
  const caption: CaptionInput = {
    language: requiredText(input.language, "language"),
    name: input.name?.trim(),
    url: requiredText(input.url, "url"),
    isDraft: input.isDraft,
  };
  if (!caption.url.startsWith("https://"))
    throw new ServiceError("url must be a public https URL of an SRT or WebVTT file");
  const { platformPostId, use, token } = await onPlatform(userId, postId, "captions");
  return platformCall(() => use.put(platformPostId, caption, token));
}

// ── comments ─────────────────────────────────────────────────────────────────

export async function listComments(
  userId: string,
  postId: string,
  options: { limit?: number; order?: string; held?: boolean } = {},
) {
  const order = options.order === "relevance" ? "relevance" : "time";
  const { platformPostId, use, token } = await onPlatform(userId, postId, "comments");
  return platformCall(() =>
    use.list(platformPostId, token, {
      limit: options.limit ?? 20,
      order,
      held: options.held ?? false,
    }),
  );
}

export async function postComment(userId: string, postId: string, text: string) {
  const body = requiredText(text, "text");
  const { platformPostId, use, token } = await onPlatform(userId, postId, "comments");
  return platformCall(() => use.post(platformPostId, body, token));
}

export async function replyToComment(
  userId: string,
  postId: string,
  commentId: string,
  text: string,
) {
  const parent = requiredText(commentId, "commentId");
  const body = requiredText(text, "text");
  const { use, token } = await onPlatform(userId, postId, "comments");
  return platformCall(() => use.reply(parent, body, token));
}

const MODERATION: CommentModeration[] = ["published", "heldForReview", "rejected"];

export async function moderateComment(
  userId: string,
  postId: string,
  commentId: string,
  status: string,
  banAuthor = false,
) {
  const id = requiredText(commentId, "commentId");
  const moderation = MODERATION.find((candidate) => candidate === status);
  if (!moderation) throw new ServiceError(`status must be one of ${MODERATION.join(", ")}`);
  const { use, token } = await onPlatform(userId, postId, "comments");
  await platformCall(() => use.moderate(id, moderation, token, { banAuthor }));
  return {
    commentId: id,
    status: moderation,
    bannedAuthor: banAuthor && moderation === "rejected",
  };
}

/**
 * Posts metadata.firstComment once the post is public, for the publishing workflow. Runs
 * at most once per post: the comment's id is kept in the metadata.
 */
export async function postFirstComment(postId: string): Promise<string | null> {
  const loaded = await loadForPublishing(postId);
  const text = loaded?.post.metadata?.firstComment;
  if (!loaded?.post.platformPostId || typeof text !== "string" || !text) return null;
  if (loaded.post.metadata?.firstCommentId) return null;
  const comments = getProvider(loaded.post.provider).comments;
  if (!comments) return null;
  const token = await accessTokenFor(loaded.account, loaded.credential);
  const comment = await comments.post(loaded.post.platformPostId, text, token);
  await updatePost(postId, { metadata: { ...loaded.post.metadata, firstCommentId: comment.id } });
  return comment.id;
}
