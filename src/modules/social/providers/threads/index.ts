import {
  InvalidInputError,
  type AnalyticsCapability,
  type CommentsCapability,
  type SocialProvider,
} from "../types";
import { threads as call } from "./api";
import { threadsConnect } from "./connect";
import { threadsMetadata } from "./metadata";
import { IMAGE_TYPES, publishContainer, publishText, threadsStatus, uploadMedia } from "./posts";

/**
 * Threads profiles: video posts prepared ahead and published by mixetape at go-live, with
 * replies (a reply is itself a Threads post) and post insights.
 */

type Reply = {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  hide_status?: string;
};

const threadsComments: CommentsCapability = {
  async list(postId, token, { limit, held }) {
    const data = await call<{ data?: Reply[] }>(token, `${postId}/replies`, {
      params: {
        fields: "id,text,username,timestamp,hide_status",
        limit: Math.min(Math.max(limit, 1), 100),
      },
    });
    const replies = (data.data ?? []).map((reply) => ({
      id: reply.id,
      author: reply.username ?? "",
      text: reply.text ?? "",
      likes: 0,
      publishedAt: reply.timestamp ?? "",
      moderationStatus: reply.hide_status === "HIDDEN" ? "hidden" : "published",
    }));
    return held ? replies.filter((reply) => reply.moderationStatus === "hidden") : replies;
  },

  // Threads has no separate comments: both are replies posted by the profile.
  async post(postId, text, token) {
    const me = await call<{ id: string }>(token, "me", { params: { fields: "id" } });
    const live = await publishText(token, me.id, text, postId);
    return {
      id: live.platformPostId,
      author: "",
      text,
      likes: 0,
      publishedAt: new Date().toISOString(),
    };
  },

  async reply(replyId, text, token) {
    const me = await call<{ id: string }>(token, "me", { params: { fields: "id" } });
    const live = await publishText(token, me.id, text, replyId);
    return {
      id: live.platformPostId,
      author: "",
      text,
      likes: 0,
      publishedAt: new Date().toISOString(),
    };
  },

  async moderate(replyId, status, token, { banAuthor }) {
    if (status === "heldForReview")
      throw new InvalidInputError('Threads has no review queue: use "rejected" to hide a reply');
    if (banAuthor) throw new InvalidInputError("Threads cannot ban from a reply");
    await call(token, `${replyId}/manage_reply`, {
      method: "POST",
      params: { hide: status === "rejected" },
    });
  },
};

const threadsAnalytics: AnalyticsCapability = {
  delayDays: 1,
  async post(postId, token, range) {
    const data = await call<{ data?: { name: string; values?: { value?: number }[] }[] }>(
      token,
      `${postId}/insights`,
      { params: { metric: "views,likes,replies,reposts,quotes,shares" } },
    );
    const value = (name: string) =>
      data.data?.find((item) => item.name === name)?.values?.[0]?.value;
    return {
      range,
      totals: {
        views: value("views"),
        likes: value("likes"),
        comments: value("replies"),
        shares: (value("shares") ?? 0) + (value("reposts") ?? 0) + (value("quotes") ?? 0),
      },
      retention: [],
      trafficSources: [],
    };
  },

  // Profile insights: views come day by day, the rest as totals over the range.
  async account(accountId, token, range) {
    const since = Date.parse(`${range.from}T00:00:00Z`) / 1000;
    const until = Date.parse(`${range.to}T23:59:59Z`) / 1000;
    const data = await call<{
      data?: {
        name: string;
        values?: { value?: number; end_time?: string }[];
        total_value?: { value?: number };
      }[];
    }>(token, `${accountId}/threads_insights`, {
      params: { metric: "views,likes,replies,reposts,quotes", since, until },
    });
    const metric = (name: string) => data.data?.find((item) => item.name === name);
    const total = (name: string) => metric(name)?.total_value?.value;
    const daily = (metric("views")?.values ?? []).map((day) => ({
      date: (day.end_time ?? "").slice(0, 10),
      views: day.value,
    }));
    return {
      range,
      totals: {
        views: daily.reduce((sum, day) => sum + (day.views ?? 0), 0),
        likes: total("likes"),
        comments: total("replies"),
        shares: (total("reposts") ?? 0) + (total("quotes") ?? 0),
      },
      daily,
      topPosts: [],
      trafficSources: [],
    };
  },
};

export const threads: SocialProvider = {
  id: "threads",
  name: "Threads",
  // mixetape holds the time itself: the post is prepared `leadMinutes` early and released.
  schedulesNatively: true,
  defaultLeadMinutes: 10,

  connect: threadsConnect,
  metadata: threadsMetadata,
  // Videos up to 5 minutes, JPEG/PNG images, and carousels of 2–20 of either.
  formats: {
    video: true,
    image: true,
    carousel: { min: 2, max: 20, kinds: ["image", "video"] },
    imageTypes: IMAGE_TYPES,
    convertsImages: ["image/webp", "image/gif"],
    maxVideoMs: 5 * 60_000,
  },
  status: threadsStatus,
  comments: threadsComments,
  analytics: threadsAnalytics,

  async upload(post, token, metadata) {
    const result = await uploadMedia(post, token, metadata);
    return {
      platformPostId: result.platformPostId,
      platformUrl: "platformUrl" in result ? result.platformUrl : undefined,
      responseLog: result.responseLog,
    };
  },

  release: (container, token, userId) => publishContainer(container, token, userId),
};
