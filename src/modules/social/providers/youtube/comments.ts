import type { Comment, CommentsCapability } from "../types";
import { DATA_API, youtubeFetch } from "./api";

/**
 * Comments on the channel's videos (list 1 unit; insert and moderation 50 units). YouTube's
 * API cannot pin a comment; pinning stays a click in Studio.
 */

type CommentResource = {
  id: string;
  snippet?: {
    authorDisplayName?: string;
    authorChannelId?: { value?: string };
    textDisplay?: string;
    textOriginal?: string;
    likeCount?: number;
    publishedAt?: string;
    moderationStatus?: string;
  };
};

type Thread = {
  id: string;
  snippet?: { topLevelComment?: CommentResource; totalReplyCount?: number };
  replies?: { comments?: CommentResource[] };
};

const toComment = (comment: CommentResource): Comment => ({
  id: comment.id,
  author: comment.snippet?.authorDisplayName ?? "",
  authorAccountId: comment.snippet?.authorChannelId?.value,
  text: comment.snippet?.textOriginal ?? comment.snippet?.textDisplay ?? "",
  likes: comment.snippet?.likeCount ?? 0,
  publishedAt: comment.snippet?.publishedAt ?? "",
  moderationStatus: comment.snippet?.moderationStatus,
});

export const youtubeComments: CommentsCapability = {
  async list(videoId, token, { limit, order, held }) {
    const data = await youtubeFetch<{ items?: Thread[] }>(token, `${DATA_API}/commentThreads`, {
      query: {
        part: "snippet,replies",
        videoId,
        maxResults: Math.min(Math.max(limit, 1), 100),
        order,
        textFormat: "plainText",
        ...(held && { moderationStatus: "heldForReview" }),
      },
    });
    // The comment id (not the thread id) is what reply and moderate take.
    return (data.items ?? []).flatMap((thread) => {
      const top = thread.snippet?.topLevelComment;
      if (!top) return [];
      return [
        {
          ...toComment(top),
          replyCount: thread.snippet?.totalReplyCount ?? 0,
          replies: (thread.replies?.comments ?? []).map(toComment),
        },
      ];
    });
  },

  async post(videoId, text, token) {
    const thread = await youtubeFetch<Thread>(token, `${DATA_API}/commentThreads`, {
      method: "POST",
      query: { part: "snippet" },
      body: JSON.stringify({
        snippet: { videoId, topLevelComment: { snippet: { textOriginal: text } } },
      }),
    });
    const top = thread.snippet?.topLevelComment;
    return top ? toComment(top) : { id: thread.id, author: "", text, likes: 0, publishedAt: "" };
  },

  async reply(parentId, text, token) {
    const comment = await youtubeFetch<CommentResource>(token, `${DATA_API}/comments`, {
      method: "POST",
      query: { part: "snippet" },
      body: JSON.stringify({ snippet: { parentId, textOriginal: text } }),
    });
    return toComment(comment);
  },

  async moderate(commentId, status, token, { banAuthor }) {
    await youtubeFetch(token, `${DATA_API}/comments/setModerationStatus`, {
      method: "POST",
      query: {
        id: commentId,
        moderationStatus: status,
        ...(banAuthor && status === "rejected" && { banAuthor: true }),
      },
    });
  },
};
