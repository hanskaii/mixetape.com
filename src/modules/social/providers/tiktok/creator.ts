import { TikTokApiError, tiktok } from "./api";

/** Who a TikTok post goes to and what that account allows, read fresh for each post form. */
export type TikTokCreator = {
  nickname: string;
  username: string | null;
  avatarUrl: string | null;
  /** The privacy levels this account may post with, in TikTok's order. */
  privacyLevelOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  /** The longest video this account may post, in seconds. */
  maxVideoPostDurationSec: number | null;
  /** Why TikTok will not take a post from this account right now; null when it will. */
  blocked: string | null;
};

type CreatorInfo = {
  creator_nickname?: string;
  creator_username?: string;
  creator_avatar_url?: string;
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
};

// TikTok's reasons a creator cannot post now, told to the person about to post.
const BLOCKED: Record<string, string> = {
  spam_risk_too_many_posts: "This account has posted too much today. Try again later.",
  spam_risk_user_banned_from_posting: "TikTok does not let this account post right now.",
  reached_active_user_cap: "TikTok's daily limit for this app is reached. Try again later.",
};

/**
 * The creator info TikTok's Direct Post rules ask for before every post: the account's name,
 * the privacy levels and interactions it allows, its longest video, or why it cannot post.
 */
export async function tiktokCreatorInfo(token: string): Promise<TikTokCreator> {
  try {
    const info = await tiktok<CreatorInfo>(token, "post/publish/creator_info/query/", {
      body: {},
    });
    return {
      nickname: info.creator_nickname || info.creator_username || "TikTok account",
      username: info.creator_username ?? null,
      avatarUrl: info.creator_avatar_url ?? null,
      privacyLevelOptions: info.privacy_level_options ?? [],
      commentDisabled: info.comment_disabled === true,
      duetDisabled: info.duet_disabled === true,
      stitchDisabled: info.stitch_disabled === true,
      maxVideoPostDurationSec: info.max_video_post_duration_sec ?? null,
      blocked: null,
    };
  } catch (error) {
    if (error instanceof TikTokApiError && !error.rateLimited) {
      const blocked =
        BLOCKED[error.code] ??
        "TikTok will not take a post from this account right now. Try again later.";
      return {
        nickname: "TikTok account",
        username: null,
        avatarUrl: null,
        privacyLevelOptions: [],
        commentDisabled: true,
        duetDisabled: true,
        stitchDisabled: true,
        maxVideoPostDurationSec: null,
        blocked,
      };
    }
    throw error;
  }
}
