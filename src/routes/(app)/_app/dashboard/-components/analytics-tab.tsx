import { Link } from "@tanstack/react-router";
import {
  ChartBar as BarChart3,
  SpinnerGap as Loader2,
  Eye,
  ArrowUpRight,
  Article,
  TrendUp,
} from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import type { Post } from "#/database/schema";

interface AnalyticsTabProps {
  analyticsData: any;
  isLoadingAnalytics: boolean;
  analyticsFetchFailed: boolean;
  onRetryAnalytics: () => void;
  allPosts: Post[];
}

export function AnalyticsTab({
  analyticsData,
  isLoadingAnalytics,
  analyticsFetchFailed,
  onRetryAnalytics,
  allPosts,
}: AnalyticsTabProps) {
  if (analyticsFetchFailed) {
    return (
      <div className="bg-card p-6 rounded-2xl ring-1 ring-foreground/10 flex items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-semibold text-foreground">Couldn't load analytics</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            The request failed — check your connection and try again.
          </p>
        </div>
        <Button size="xs" variant="outline" onClick={onRetryAnalytics} className="shrink-0">
          Retry
        </Button>
      </div>
    );
  }

  const totalViews = analyticsData?.totalViews || 0;
  const publishedCount = allPosts.filter((p) => p.status === "published").length;
  const topPost = analyticsData?.topPosts?.[0] || allPosts[0];

  return (
    <div className="space-y-6">
      {/* Real-time Status Card */}
      <div className="bg-card p-4 sm:p-5 rounded-2xl ring-1 ring-foreground/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-2.5 rounded-full bg-emerald-500 shadow-2xs" />
          <div>
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span>Real-Time Reader Activity</span>
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Live visitor view metrics and popular article performance powered by Cloudflare KV.
            </p>
            {analyticsData?.analyticsError ? (
              <p className="text-xs text-muted-foreground mt-1.5">
                Analytics unavailable — {analyticsData.analyticsError}. View counts show 0 until
                this is resolved.
              </p>
            ) : null}
          </div>
        </div>

        <span className="text-[11px] font-mono font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
          Live Telemetry
        </span>
      </div>

      {/* Metrics Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card p-4 rounded-2xl ring-1 ring-foreground/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Views</span>
            <Eye className="size-4 text-primary" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-foreground">
              {totalViews.toLocaleString()}
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5">Across all articles</p>
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl ring-1 ring-foreground/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Published Articles</span>
            <Article className="size-4 text-emerald-500" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono text-foreground">{publishedCount}</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">Publicly readable</p>
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl ring-1 ring-foreground/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Top Performer</span>
            <TrendUp className="size-4 text-blue-500" />
          </div>
          <div className="mt-3 truncate">
            <span className="text-sm font-bold text-foreground truncate block">
              {topPost ? topPost.title : "No articles yet"}
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {topPost ? `${topPost.views ?? 0} views` : "Publish articles to start tracking"}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl ring-1 ring-foreground/10 overflow-hidden">
        <div className="p-4 border-b border-border/60 flex items-center justify-between">
          <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <BarChart3 className="size-3.5 text-primary" />
            <span>Popular Articles</span>
          </h4>
        </div>

        {isLoadingAnalytics ? (
          <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span>Loading performance data...</span>
          </div>
        ) : (analyticsData?.topPosts || allPosts).length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No views recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {(analyticsData?.topPosts || allPosts).slice(0, 10).map((p: any, idx: number) => (
              <div
                key={p.id}
                className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold font-mono text-muted-foreground shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <Link
                      to="/blog/$slug"
                      params={{ slug: p.slug }}
                      className="font-semibold text-foreground hover:underline truncate block"
                    >
                      {p.title}
                    </Link>
                    <span className="text-[10px] font-mono text-muted-foreground">/{p.slug}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    <Eye className="size-3" />
                    <span>{p.views ?? 0} views</span>
                  </span>
                  <Button
                    render={
                      <Link to="/blog/$slug" params={{ slug: p.slug }}>
                        <ArrowUpRight className="size-3" />
                      </Link>
                    }
                    size="xs"
                    variant="ghost"
                    className="size-7 rounded-full p-0"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
