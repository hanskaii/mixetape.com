import { env } from "cloudflare:workers";
import { db } from "#/database/index";
import { posts } from "#/database/schema";
import { eq } from "drizzle-orm";

// ==================== Types ====================

export interface AnalyticsStats {
  totalViews: number;
  totalClicks: number;
  totalQrScans: number;
  clickThroughRate: string;
}

export interface DestinationItem {
  out: string;
  click_count: number;
}

export interface LinkTextItem {
  link_text: string;
  out: string;
  click_count: number;
}

export interface SlugItem {
  slug: string;
  title: string | null;
  click_count: number;
  views?: number;
}

export interface CachedAnalytics {
  stats: AnalyticsStats;
  recentEvents: any[];
  destinationBreakdown: DestinationItem[];
  linkTextBreakdown: LinkTextItem[];
  slugBreakdown: SlugItem[];
  topPosts: Array<{
    id: number;
    title: string;
    slug: string;
    views: number;
  }>;
  totalViews: number;
  postCount: number;
  r2SqlEngineAvailable: boolean;
  r2SqlData: any[];
  hasData: boolean;
  analyticsError: string | null;
  lastUpdated: string;
}

export interface AnalyticsResult {
  data: CachedAnalytics;
  fromCache: boolean;
  errorMessage: string | null;
}

export interface PostViewsRef {
  id: number;
  slug: string;
  createdAt?: Date;
}

// ==================== Helpers ====================

function postViewsCacheKey(postId: number, slug: string): string {
  return `analytics:views:${postId || slug}`;
}

// ==================== Public API ====================

/**
 * Get individual article view count from KV cache.
 */
export async function getPostViews(post: PostViewsRef): Promise<number> {
  if (!env.KIT_CACHE) return 0;

  try {
    const key = postViewsCacheKey(post.id, post.slug);
    const cached = await env.KIT_CACHE.get(key);
    if (cached) return Number(cached) || 0;

    // Fallback: check by slug
    const bySlug = await env.KIT_CACHE.get(`analytics:views:${post.slug}`);
    return Number(bySlug) || 0;
  } catch {
    return 0;
  }
}

/**
 * Record a post view directly into KV cache.
 */
export async function recordPostView(slug: string, postId?: number): Promise<void> {
  if (!env.KIT_CACHE) return;

  try {
    const key = postId ? `analytics:views:${postId}` : `analytics:views:${slug}`;
    const current = Number(await env.KIT_CACHE.get(key)) || 0;
    const next = current + 1;
    await env.KIT_CACHE.put(key, String(next));

    if (postId && slug) {
      await env.KIT_CACHE.put(`analytics:views:${slug}`, String(next));
    }
  } catch (err) {
    console.warn("Failed to record view in KV:", err);
  }
}

/**
 * Invalidate cached analytics when a post is removed.
 */
export async function invalidatePostAnalytics(
  slug: string,
  postId: number,
  _userId: string,
): Promise<void> {
  if (!env.KIT_CACHE) return;

  try {
    await Promise.all([
      env.KIT_CACHE.delete(`analytics:views:${postId}`),
      env.KIT_CACHE.delete(`analytics:views:${slug}`),
    ]);
  } catch {
    // Best-effort cleanup
  }
}

/**
 * Get aggregated analytics metrics from D1 database and KV counters.
 */
export async function getAnalyticsData(
  userId: string,
  _slugFilter?: string,
): Promise<AnalyticsResult> {
  try {
    const userPosts = await db.query.posts.findMany({
      where: eq(posts.userId, userId),
    });

    const topPosts = await Promise.all(
      userPosts.map(async (p) => {
        const views = await getPostViews({ id: p.id, slug: p.slug });
        return {
          id: p.id,
          title: p.title,
          slug: p.slug,
          views,
        };
      }),
    );

    topPosts.sort((a, b) => b.views - a.views);
    const totalViews = topPosts.reduce((acc, curr) => acc + curr.views, 0);

    const stats: AnalyticsStats = {
      totalViews,
      totalClicks: 0,
      totalQrScans: 0,
      clickThroughRate: "0%",
    };

    const slugBreakdown: SlugItem[] = topPosts.map((p) => ({
      slug: p.slug,
      title: p.title,
      click_count: p.views,
      views: p.views,
    }));

    const data: CachedAnalytics = {
      stats,
      recentEvents: [],
      destinationBreakdown: [],
      linkTextBreakdown: [],
      slugBreakdown,
      topPosts,
      totalViews,
      postCount: userPosts.length,
      r2SqlEngineAvailable: false,
      r2SqlData: [],
      hasData: totalViews > 0,
      analyticsError: null,
      lastUpdated: new Date().toISOString(),
    };

    return {
      data,
      fromCache: false,
      errorMessage: null,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error querying analytics";

    return {
      data: {
        stats: {
          totalViews: 0,
          totalClicks: 0,
          totalQrScans: 0,
          clickThroughRate: "0%",
        },
        recentEvents: [],
        destinationBreakdown: [],
        linkTextBreakdown: [],
        slugBreakdown: [],
        topPosts: [],
        totalViews: 0,
        postCount: 0,
        r2SqlEngineAvailable: false,
        r2SqlData: [],
        hasData: false,
        analyticsError: errorMessage,
        lastUpdated: new Date().toISOString(),
      },
      fromCache: false,
      errorMessage,
    };
  }
}
