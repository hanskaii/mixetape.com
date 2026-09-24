import { db } from "#/database/index";
import { posts, type InsertPost, type Post } from "#/database/schema";
import { eq, desc, and } from "drizzle-orm";
import { markdownToHtml } from "./markdown";
import { invalidatePostAnalytics } from "#/modules/analytics/analytics.service";
import { siteConfig } from "#/config/site";

export interface CreatePostParams {
  title: string;
  content: string; // Markdown or HTML
  slug?: string;
  excerpt?: string;
  author?: string;
  authorUsername?: string;
  tags?: string;
  status?: "draft" | "published";
  coverImage?: string;
  userId?: string;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function createPost(params: CreatePostParams): Promise<Post> {
  const cleanSlug = params.slug ? slugify(params.slug) : slugify(params.title);

  // Convert markdown to HTML if content doesn't start with HTML tag
  let htmlContent = params.content;
  if (!params.content.trim().startsWith("<")) {
    htmlContent = await markdownToHtml(params.content);
  }

  const defaultUser = await db.query.user.findFirst();
  const userId = params.userId || defaultUser?.id || "admin";
  const author = params.author || defaultUser?.name || siteConfig.author.name;
  const authorUsername = (params.authorUsername || defaultUser?.name || siteConfig.author.handle)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");

  const excerpt =
    params.excerpt ||
    htmlContent
      .replace(/<[^>]+>/g, " ")
      .slice(0, 160)
      .trim();

  const newPostData: InsertPost = {
    userId,
    title: params.title,
    slug: cleanSlug,
    content: htmlContent,
    excerpt,
    author,
    authorUsername,
    tags: params.tags || "general",
    status: params.status || "published",
    coverImage: params.coverImage || null,
  };

  const inserted = await db.insert(posts).values(newPostData).returning();
  return inserted[0];
}

export async function listPosts(limit = 20): Promise<Post[]> {
  return await db.query.posts.findMany({
    orderBy: [desc(posts.createdAt)],
    limit,
  });
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const post = await db.query.posts.findFirst({
    where: eq(posts.slug, slug),
  });
  return post || null;
}

export interface DeletePostResult {
  deleted: boolean;
  reason?: "not-found" | "forbidden";
  post?: { id: number; title: string; slug: string };
}

/**
 * Delete a post by slug, but only if it belongs to the given user.
 * Returns a discriminated result instead of throwing, so callers (including
 * the AI tool loop) can surface a precise reason.
 */
export async function deletePost(slug: string, userId: string): Promise<DeletePostResult> {
  const existing = await db.query.posts.findFirst({
    where: eq(posts.slug, slug),
  });

  if (!existing) {
    return { deleted: false, reason: "not-found" };
  }

  if (existing.userId !== userId) {
    return { deleted: false, reason: "forbidden" };
  }

  await db.delete(posts).where(and(eq(posts.id, existing.id), eq(posts.userId, userId)));

  // Analytics events are append-only and keyed by slug; the cached aggregates
  // would otherwise keep serving a deleted post's numbers.
  await invalidatePostAnalytics(existing.slug, existing.id, userId);

  return {
    deleted: true,
    post: { id: existing.id, title: existing.title, slug: existing.slug },
  };
}
