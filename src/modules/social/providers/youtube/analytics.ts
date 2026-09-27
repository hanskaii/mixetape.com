import type {
  AccountAnalytics,
  AnalyticsCapability,
  DateRange,
  Metrics,
  PostAnalytics,
  TrafficSource,
} from "../types";
import { ANALYTICS_API, youtubeFetch } from "./api";

/**
 * YouTube Analytics reports (their own quota, separate from the Data API). Numbers lag by
 * two to three days, so the most recent days of a range are incomplete.
 */

/** YouTube metric → mixetape metric. */
const METRICS = {
  views: "views",
  estimatedMinutesWatched: "watchTimeMinutes",
  averageViewDuration: "averageViewDurationSeconds",
  averageViewPercentage: "averageViewPercentage",
  likes: "likes",
  comments: "comments",
  shares: "shares",
  subscribersGained: "subscribersGained",
  subscribersLost: "subscribersLost",
} as const satisfies Record<string, keyof Metrics>;

const ALL = Object.keys(METRICS);
// The top-videos report does not take subscribersLost.
const PER_VIDEO = ALL.filter((metric) => metric !== "subscribersLost");

type Row = Record<string, string | number>;

async function report(
  token: string,
  range: DateRange,
  query: {
    ids?: string;
    metrics: string[];
    dimensions?: string;
    filters?: string;
    sort?: string;
    maxResults?: number;
  },
): Promise<Row[]> {
  const data = await youtubeFetch<{
    columnHeaders?: { name: string }[];
    rows?: (string | number)[][];
  }>(token, `${ANALYTICS_API}/reports`, {
    query: {
      ids: query.ids ?? "channel==MINE",
      startDate: range.from,
      endDate: range.to,
      metrics: query.metrics.join(","),
      dimensions: query.dimensions,
      filters: query.filters,
      sort: query.sort,
      maxResults: query.maxResults,
    },
  });
  const names = (data.columnHeaders ?? []).map((header) => header.name);
  return (data.rows ?? []).map((row) =>
    Object.fromEntries(row.map((value, index) => [names[index], value])),
  );
}

function metrics(row: Row | undefined): Metrics {
  const out: Metrics = {};
  for (const [source, target] of Object.entries(METRICS)) {
    const value = row?.[source];
    if (typeof value === "number") out[target] = Math.round(value * 100) / 100;
  }
  return out;
}

async function trafficSources(
  token: string,
  range: DateRange,
  ids: string | undefined,
  filters?: string,
): Promise<TrafficSource[]> {
  const rows = await report(token, range, {
    ids,
    metrics: ["views", "estimatedMinutesWatched"],
    dimensions: "insightTrafficSourceType",
    filters,
    sort: "-views",
  });
  return rows.map((row) => ({
    source: String(row.insightTrafficSourceType),
    views: Number(row.views),
    watchTimeMinutes: Number(row.estimatedMinutesWatched),
  }));
}

export const youtubeAnalytics: AnalyticsCapability = {
  delayDays: 3,

  async post(videoId, token, range): Promise<PostAnalytics> {
    const filters = `video==${videoId}`;
    const [totals, retention, sources] = await Promise.all([
      report(token, range, { metrics: ALL, filters }),
      report(token, range, {
        metrics: ["audienceWatchRatio", "relativeRetentionPerformance"],
        dimensions: "elapsedVideoTimeRatio",
        filters,
        sort: "elapsedVideoTimeRatio",
      }),
      trafficSources(token, range, undefined, filters),
    ]);
    return {
      range,
      totals: metrics(totals[0]),
      retention: retention.map((row) => ({
        position: Number(row.elapsedVideoTimeRatio),
        watchRatio: Number(row.audienceWatchRatio),
        relativePerformance: Number(row.relativeRetentionPerformance),
      })),
      trafficSources: sources,
    };
  },

  async account(channelId, token, range): Promise<AccountAnalytics> {
    const ids = `channel==${channelId}`;
    const [totals, daily, top, sources] = await Promise.all([
      report(token, range, { ids, metrics: ALL }),
      report(token, range, { ids, metrics: ALL, dimensions: "day", sort: "day" }),
      report(token, range, {
        ids,
        metrics: PER_VIDEO,
        dimensions: "video",
        sort: "-views",
        maxResults: 10,
      }),
      trafficSources(token, range, ids),
    ]);
    return {
      range,
      totals: metrics(totals[0]),
      daily: daily.map((row) => ({ date: String(row.day), ...metrics(row) })),
      topPosts: top.map((row) => ({ platformPostId: String(row.video), ...metrics(row) })),
      trafficSources: sources,
    };
  },
};
