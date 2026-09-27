import type { AnalyticsCapability, Metrics, PostAnalytics } from "../types";
import { graph } from "../meta/graph";

/**
 * Video and Reel insights. Facebook reports these for the lifetime of the post, not per
 * day, so the requested range is echoed back but the numbers are lifetime totals. Page-
 * level insights are left out: Meta has been retiring most of those metrics.
 */

type Insight = { name: string; values?: { value?: number | Record<string, number> }[] };

const VIDEO = [
  "total_video_views",
  "total_video_avg_time_watched",
  "total_video_view_total_time",
  "total_video_retention_graph",
];
const REEL = [
  "blue_reels_play_count",
  "post_video_avg_time_watched",
  "post_video_view_time",
  "post_video_retention_graph",
];

async function insights(videoId: string, token: string, metrics: string[]) {
  const data = await graph<{ data?: Insight[] }>(token, `${videoId}/video_insights`, {
    params: { metric: metrics.join(","), period: "lifetime" },
  });
  return new Map((data.data ?? []).map((insight) => [insight.name, insight.values?.[0]?.value]));
}

const number = (value: unknown) => (typeof value === "number" ? value : undefined);
const round = (value: number) => Math.round(value * 100) / 100;

export const facebookAnalytics: AnalyticsCapability = {
  delayDays: 1,

  async post(videoId, token, range): Promise<PostAnalytics> {
    // A Reel answers only to the Reel metrics; try the video ones first.
    let values = await insights(videoId, token, VIDEO).catch(() => new Map<string, unknown>());
    const isReel = number(values.get("total_video_views")) === undefined;
    if (isReel) values = await insights(videoId, token, REEL);

    const views = number(values.get(isReel ? "blue_reels_play_count" : "total_video_views"));
    const avgMs = number(
      values.get(isReel ? "post_video_avg_time_watched" : "total_video_avg_time_watched"),
    );
    const totalMs = number(
      values.get(isReel ? "post_video_view_time" : "total_video_view_total_time"),
    );
    const totals: Metrics = {
      views,
      averageViewDurationSeconds: avgMs === undefined ? undefined : round(avgMs / 1000),
      watchTimeMinutes: totalMs === undefined ? undefined : round(totalMs / 60_000),
    };

    // The retention graph maps a position bucket ("0"…"40") to the share still watching.
    const graphValue = values.get(
      isReel ? "post_video_retention_graph" : "total_video_retention_graph",
    );
    const points =
      graphValue && typeof graphValue === "object"
        ? Object.entries(graphValue as Record<string, number>)
        : [];
    const last = Math.max(1, ...points.map(([key]) => Number(key)));
    return {
      range,
      totals,
      retention: points
        .map(([key, value]) => ({ position: round(Number(key) / last), watchRatio: round(value) }))
        .sort((a, b) => a.position - b.position),
      trafficSources: [],
    };
  },
};
