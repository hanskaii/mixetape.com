import { InvalidInputError, type Comment, type CommentsCapability } from "../types";
import { graph } from "../meta/graph";

/**
 * Comments on a Page's videos and Reels, as the Page. Facebook moderates by hiding a
 * comment (visible only to its author and friends) or showing it again; it has no queue
 * of comments held for review, and banning a person is done from the Page, not a comment.
 */

type FbComment = {
  id: string;
  message?: string;
  from?: { id?: string; name?: string };
  created_time?: string;
  like_count?: number;
  comment_count?: number;
  is_hidden?: boolean;
  comments?: { data?: FbComment[] };
};

const toComment = (comment: FbComment): Comment => ({
  id: comment.id,
  author: comment.from?.name ?? "",
  authorAccountId: comment.from?.id,
  text: comment.message ?? "",
  likes: comment.like_count ?? 0,
  publishedAt: comment.created_time ?? "",
  replyCount: comment.comment_count,
  moderationStatus: comment.is_hidden ? "hidden" : "published",
  replies: comment.comments?.data?.map(toComment),
});

const FIELDS = "id,message,from{id,name},created_time,like_count,is_hidden";

export const facebookComments: CommentsCapability = {
  async list(videoId, token, { limit, order, held }) {
    const data = await graph<{ data?: FbComment[] }>(token, `${videoId}/comments`, {
      params: {
        fields: `${FIELDS},comment_count,comments.limit(10){${FIELDS}}`,
        filter: "toplevel",
        order: order === "relevance" ? "ranked" : "reverse_chronological",
        limit: Math.min(Math.max(limit, 1), 100),
      },
    });
    const comments = (data.data ?? []).map(toComment);
    // Facebook's closest thing to "held for review" is a hidden comment.
    return held ? comments.filter((comment) => comment.moderationStatus === "hidden") : comments;
  },

  async post(videoId, text, token) {
    const created = await graph<{ id: string }>(token, `${videoId}/comments`, {
      method: "POST",
      params: { message: text },
    });
    return { id: created.id, author: "", text, likes: 0, publishedAt: new Date().toISOString() };
  },

  async reply(commentId, text, token) {
    const created = await graph<{ id: string }>(token, `${commentId}/comments`, {
      method: "POST",
      params: { message: text },
    });
    return { id: created.id, author: "", text, likes: 0, publishedAt: new Date().toISOString() };
  },

  async moderate(commentId, status, token, { banAuthor }) {
    if (status === "heldForReview")
      throw new InvalidInputError('Facebook has no review queue: use "rejected" to hide a comment');
    if (banAuthor)
      throw new InvalidInputError(
        "Facebook cannot ban from a comment; block the person from the Page instead",
      );
    await graph(token, commentId, {
      method: "POST",
      params: { is_hidden: status === "rejected" },
    });
  },
};
