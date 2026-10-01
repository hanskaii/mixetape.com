import { InvalidInputError, type AnalyticsCapability, type Metrics } from "../types";
import { tiktok } from "./api";

/**
 * TikTok's Display API counts: lifetime views, likes, comments and shares per video, with
 * no daily breakdown, so a post's numbers ignore the date range and an account report
 * sums the videos published within it.
 */

const FIELDS = "id,create_time,view_count,like_count,comment_count,share_count";
const PAGES = 5; // 20 videos a page, newest first

type Video = {
  id: string;
  create_time?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
};

const metrics = (video: Video): Metrics => ({
  views: video.view_count,
  likes: video.like_count,
  comments: video.comment_count,
  shares: video.share_count,
});

/** mixetape keeps TikTok's publish id; the video id comes once the post is public. */
async function videoId(platformPostId: string, token: string): Promise<string> {
  if (/^\d+$/.test(platformPostId)) return platformPostId;
  const state = await tiktok<{ publicaly_available_post_id?: (string | number)[] }>(
    token,
    "post/publish/status/fetch/",
    { body: { publish_id: platformPostId } },
  );
  const id = state.publicaly_available_post_id?.[0];
  if (id === undefined)
    throw new InvalidInputError("TikTok has no public video for this post yet, so no analytics");
  return String(id);
}

export const tiktokAnalytics: AnalyticsCapability = {
  delayDays: 0,

  async post(platformPostId, token, range) {
    const id = await videoId(platformPostId, token);
    const data = await tiktok<{ videos?: Video[] }>(token, "video/query/", {
      query: { fields: FIELDS },
      body: { filters: { video_ids: [id] } },
    });
    const video = data.videos?.[0];
    if (!video) throw new InvalidInputError("TikTok did not find this video");
    return { range, totals: metrics(video), retention: [], trafficSources: [] };
  },

  async account(_accountId, token, range) {
    const from = Date.parse(`${range.from}T00:00:00Z`) / 1000;
    const to = Date.parse(`${range.to}T23:59:59Z`) / 1000;
    const videos: Video[] = [];
    let cursor: number | undefined;
    for (let page = 0; page < PAGES; page++) {
      const data = await tiktok<{ videos?: Video[]; cursor?: number; has_more?: boolean }>(
        token,
        "video/list/",
        { query: { fields: FIELDS }, body: { max_count: 20, ...(cursor && { cursor }) } },
      );
      const batch = data.videos ?? [];
      videos.push(
        ...batch.filter((v) => (v.create_time ?? 0) >= from && (v.create_time ?? 0) <= to),
      );
      // Newest first: once a page reaches past the range, the rest is older still.
      if (!data.has_more || batch.some((v) => (v.create_time ?? 0) < from)) break;
      cursor = data.cursor;
    }
    const sum = (key: keyof Metrics) =>
      videos.reduce((total, video) => total + (metrics(video)[key] ?? 0), 0);
    return {
      range,
      totals: {
        views: sum("views"),
        likes: sum("likes"),
        comments: sum("comments"),
        shares: sum("shares"),
      },
      daily: [],
      topPosts: [...videos]
        .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
        .slice(0, 10)
        .map((video) => ({ platformPostId: video.id, ...metrics(video) })),
      trafficSources: [],
    };
  },
};
