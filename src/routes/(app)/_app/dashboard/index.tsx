import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { useState, useMemo, useEffect, useCallback } from "react";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import {
  FileText,
  Image as ImageIcon,
  Tag,
  Gear as Settings,
  Plus,
  ChartBar as BarChart3,
  Pulse as Activity,
} from "@phosphor-icons/react";
import { db } from "#/database/index";
import { posts } from "#/database/schema";
import { auth } from "#/modules/auth/auth.server";
import { Button } from "#/components/ui/button";
import { useConfirmModal } from "#/components/providers/modal-providers";
import { getAnalyticsMetrics } from "./-fn/dashboard.fn";
import { PostsTab } from "./-components/posts-tab";
import { AnalyticsTab } from "./-components/analytics-tab";
import { MediaTab, type MediaItem } from "./-components/media-tab";
import { TagsTab } from "./-components/tags-tab";
import { SettingsTab } from "./-components/settings-tab";

const dashboardSearchSchema = z.object({
  tab: z.enum(["posts", "analytics", "media", "tags", "settings"]).default("posts").optional(),
});

export const getDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  if (!headers) throw new Error("Unauthorized");

  const session = await auth.api.getSession({ headers }).catch(() => null);
  if (!session?.user) throw new Error("Unauthorized");

  const allPosts = await db.query.posts.findMany({
    where: eq(posts.userId, session.user.id),
    orderBy: [desc(posts.createdAt)],
  });

  let mediaFiles: Array<MediaItem> = [];
  try {
    if (env.BUCKET) {
      const list = await env.BUCKET.list({ limit: 100 });
      mediaFiles = list.objects.map((obj) => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded ? new Date(obj.uploaded).toISOString() : new Date().toISOString(),
        url: `/api/storage/file/${encodeURIComponent(obj.key)}`,
      }));
    }
  } catch (e) {
    console.error("Storage list error:", e);
  }

  // Aggregate tags
  const tagCountMap = new Map<string, number>();
  allPosts.forEach((p) => {
    if (p.tags) {
      p.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((tag) => {
          tagCountMap.set(tag, (tagCountMap.get(tag) || 0) + 1);
        });
    }
  });

  const allTags = Array.from(tagCountMap.entries()).map(([name, count]) => ({
    name,
    count,
  }));

  return {
    allPosts,
    mediaFiles,
    allTags,
    sessionUser: session.user,
  };
});

export const deletePostServerFn = createServerFn({ method: "POST" })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    if (!headers) throw new Error("Unauthorized");

    const session = await auth.api.getSession({ headers }).catch(() => null);
    if (!session?.user) throw new Error("Unauthorized");

    const existing = await db.query.posts.findFirst({
      where: eq(posts.id, data.id),
    });

    if (!existing || existing.userId !== session.user.id) {
      throw new Error("Forbidden or post not found");
    }

    await db.delete(posts).where(eq(posts.id, data.id));
    return { success: true };
  });

export const Route = createFileRoute("/(app)/_app/dashboard/")({
  validateSearch: (search) => dashboardSearchSchema.parse(search),
  beforeLoad: ({ context }) => {
    if (!context.session?.user) {
      throw redirect({
        to: "/",
        search: { redirect: "/dashboard" },
      });
    }
  },
  loader: async () => {
    return await getDashboardData();
  },
  component: Dashboard,
});

function Dashboard() {
  const router = useRouter();
  const search = Route.useSearch();
  const {
    allPosts: initialPosts,
    mediaFiles: initialMedia,
    allTags,
    sessionUser,
  } = Route.useLoaderData();
  const { confirm } = useConfirmModal();

  const currentTab = search.tab || "posts";

  const [allPosts, setAllPosts] = useState(initialPosts);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");

  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [analyticsFetchFailed, setAnalyticsFetchFailed] = useState(false);

  const fetchAnalytics = useCallback(() => {
    setIsLoadingAnalytics(true);
    setAnalyticsFetchFailed(false);
    getAnalyticsMetrics()
      .then((data) => setAnalyticsData(data))
      .catch((err) => {
        console.error("Analytics fetch error:", err);
        setAnalyticsFetchFailed(true);
      })
      .finally(() => setIsLoadingAnalytics(false));
  }, []);

  useEffect(() => {
    // Only the mount-time auto-fetch is gated on `!analyticsData`; a manual
    // retry (below) must be able to run again even though that condition
    // never changes after a failed attempt leaves it at null forever.
    if (currentTab === "analytics" && !analyticsData) {
      fetchAnalytics();
    }
  }, [currentTab, analyticsData, fetchAnalytics]);

  const handleDeletePost = (id: number) => {
    confirm({
      title: "Delete Article",
      description: "Are you sure you want to delete this article? This action cannot be undone.",
      confirmText: "Delete",
      variant: "destructive",
      onConfirm: async () => {
        try {
          await deletePostServerFn({ data: { id } });
          setAllPosts((prev) => prev.filter((p) => p.id !== id));
          router.invalidate();
        } catch (err) {
          console.error("Delete error:", err);
          alert("Failed to delete post");
        }
      },
    });
  };

  const filteredPosts = useMemo(() => {
    return allPosts.filter((post) => {
      const matchesSearch =
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (post.tags && post.tags.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === "all" ? true : (post.status || "published") === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [allPosts, searchQuery, statusFilter]);

  const totalViews = useMemo(() => {
    return analyticsData?.totalViews || 0;
  }, [analyticsData]);

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Fast Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            Workspace
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your stories, media, analytics, and publication schedules.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            render={
              <Link to="/blog/new">
                <Plus className="size-3.5 mr-1" />
                <span>New Article</span>
              </Link>
            }
            size="sm"
            className="h-8 px-4 rounded-full text-xs font-semibold shadow-xs cursor-pointer"
          />
        </div>
      </div>

      {/* Metrics Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card p-4 rounded-2xl ring-1 ring-foreground/10 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Articles</span>
            <FileText className="size-4" />
          </div>
          <p className="text-2xl font-bold text-foreground font-mono tabular-nums">
            {allPosts.length}
          </p>
        </div>

        <div className="bg-card p-4 rounded-2xl ring-1 ring-foreground/10 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Published</span>
            <span className="size-2 rounded-full bg-primary inline-block" />
          </div>
          <p className="text-2xl font-bold text-foreground font-mono tabular-nums">
            {allPosts.filter((p) => p.status !== "draft").length}
          </p>
        </div>

        <div className="bg-card p-4 rounded-2xl ring-1 ring-foreground/10 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Drafts</span>
            <span className="size-2 rounded-full bg-muted-foreground/60 inline-block" />
          </div>
          <p className="text-2xl font-bold text-foreground font-mono tabular-nums">
            {allPosts.filter((p) => p.status === "draft").length}
          </p>
        </div>

        <div className="bg-card p-4 rounded-2xl ring-1 ring-foreground/10 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Views (Live)</span>
            <Activity className="size-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground font-mono tabular-nums">
            {totalViews.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Navigation Tabs Header */}
      <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-full border border-border/60 max-w-fit overflow-x-auto no-scrollbar">
        <Link
          to="/dashboard"
          search={{ tab: "posts" }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
            currentTab === "posts"
              ? "bg-background text-foreground font-semibold shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="size-3.5" />
          <span>Articles</span>
        </Link>

        <Link
          to="/dashboard"
          search={{ tab: "analytics" }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
            currentTab === "analytics"
              ? "bg-background text-foreground font-semibold shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="size-3.5" />
          <span>Analytics</span>
        </Link>

        <Link
          to="/dashboard"
          search={{ tab: "media" }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
            currentTab === "media"
              ? "bg-background text-foreground font-semibold shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ImageIcon className="size-3.5" />
          <span>Storage &amp; Media</span>
        </Link>

        <Link
          to="/dashboard"
          search={{ tab: "tags" }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
            currentTab === "tags"
              ? "bg-background text-foreground font-semibold shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Tag className="size-3.5" />
          <span>Tags</span>
        </Link>

        <Link
          to="/dashboard"
          search={{ tab: "settings" }}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
            currentTab === "settings"
              ? "bg-background text-foreground font-semibold shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className="size-3.5" />
          <span>Settings</span>
        </Link>
      </div>

      {/* Tab Panels */}
      <div>
        {currentTab === "posts" && (
          <PostsTab
            allPosts={allPosts}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            filteredPosts={filteredPosts}
            handleDeletePost={handleDeletePost}
          />
        )}

        {currentTab === "analytics" && (
          <AnalyticsTab
            analyticsData={analyticsData}
            isLoadingAnalytics={isLoadingAnalytics}
            analyticsFetchFailed={analyticsFetchFailed}
            onRetryAnalytics={fetchAnalytics}
            allPosts={allPosts}
          />
        )}

        {currentTab === "media" && <MediaTab initialMedia={initialMedia} />}

        {currentTab === "tags" && <TagsTab allTags={allTags} />}

        {currentTab === "settings" && <SettingsTab sessionUser={sessionUser} />}
      </div>
    </main>
  );
}
