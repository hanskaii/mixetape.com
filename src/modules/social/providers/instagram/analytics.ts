import type { AnalyticsCapability, Metrics } from "../types";
import { graph } from "../meta/graph";

/**
 * Reel insights: lifetime totals (Instagram does not break them down by day), so the
 * requested range is echoed back. Account-level insights are left out.
 */

const METRICS = [
  "views",
  "likes",
  "comments",
  "shares",
  "ig_reels_avg_watch_time",
  "ig_reels_video_view_total_time",
];

const round = (value: number) => Math.round(value * 100) / 100;

export const instagramAnalytics: AnalyticsCapability = {
  delayDays: 1,

  async post(mediaId, token, range) {
    const data = await graph<{ data?: { name: string; values?: { value?: number }[] }[] }>(
      token,
      `${mediaId}/insights`,
      { params: { metric: METRICS.join(",") } },
    );
    const value = (name: string) =>
      data.data?.find((item) => item.name === name)?.values?.[0]?.value;
    const avgMs = value("ig_reels_avg_watch_time");
    const totalMs = value("ig_reels_video_view_total_time");
    const totals: Metrics = {
      views: value("views"),
      likes: value("likes"),
      comments: value("comments"),
      shares: value("shares"),
      averageViewDurationSeconds: avgMs === undefined ? undefined : round(avgMs / 1000),
      watchTimeMinutes: totalMs === undefined ? undefined : round(totalMs / 60_000),
    };
    return { range, totals, retention: [], trafficSources: [] };
  },
};
