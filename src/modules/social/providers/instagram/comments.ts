import { InvalidInputError, type Comment, type CommentsCapability } from "../types";
import { ig } from "./api";

/**
 * Comments on the account's Reels, as the account. Instagram moderates by hiding a
 * comment; it has no review queue and cannot ban from a comment.
 */

type IgComment = {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  like_count?: number;
  hidden?: boolean;
  replies?: { data?: IgComment[] };
};

const toComment = (comment: IgComment): Comment => ({
  id: comment.id,
  author: comment.username ?? "",
  text: comment.text ?? "",
  likes: comment.like_count ?? 0,
  publishedAt: comment.timestamp ?? "",
  replyCount: comment.replies?.data?.length,
  moderationStatus: comment.hidden ? "hidden" : "published",
  replies: comment.replies?.data?.map(toComment),
});

const FIELDS = "id,text,username,timestamp,like_count,hidden";

export const instagramComments: CommentsCapability = {
  async list(mediaId, token, { limit, held }) {
    const data = await ig<{ data?: IgComment[] }>(token, `${mediaId}/comments`, {
      params: {
        fields: `${FIELDS},replies{${FIELDS}}`,
        limit: Math.min(Math.max(limit, 1), 50),
      },
    });
    const comments = (data.data ?? []).map(toComment);
    return held ? comments.filter((comment) => comment.moderationStatus === "hidden") : comments;
  },

  async post(mediaId, text, token) {
    const created = await ig<{ id: string }>(token, `${mediaId}/comments`, {
      method: "POST",
      params: { message: text },
    });
    return { id: created.id, author: "", text, likes: 0, publishedAt: new Date().toISOString() };
  },

  async reply(commentId, text, token) {
    const created = await ig<{ id: string }>(token, `${commentId}/replies`, {
      method: "POST",
      params: { message: text },
    });
    return { id: created.id, author: "", text, likes: 0, publishedAt: new Date().toISOString() };
  },

  async moderate(commentId, status, token, { banAuthor }) {
    if (status === "heldForReview")
      throw new InvalidInputError(
        'Instagram has no review queue: use "rejected" to hide a comment',
      );
    if (banAuthor) throw new InvalidInputError("Instagram cannot ban from a comment");
    await ig(token, commentId, { method: "POST", params: { hide: status === "rejected" } });
  },
};
