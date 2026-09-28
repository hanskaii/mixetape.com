import { mediaRange, mediaSize } from "../media";
import { PermanentPublishError, type SocialProvider, type StatusCapability } from "../types";
import { TikTokApiError, tiktok } from "./api";
import { tiktokConnect } from "./connect";
import { tiktokMetadata, type TikTokVideoMeta } from "./metadata";

export type { TikTokVideoMeta } from "./metadata";

/**
 * TikTok Direct Post. TikTok cannot hold a post until a time, so mixetape uploads at the
 * scheduled moment. The file is sent in chunks (FILE_UPLOAD), so the media domain needs
 * no verification with TikTok. Comments and analytics need APIs TikTok does not open to
 * posting apps.
 */

const CHUNK = 10 * 1024 * 1024; // TikTok takes 5–64 MB chunks; the last may be up to 128 MB
const POLL_MS = 15_000;
const MAX_WAIT_MS = 10 * 60_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Status = {
  status?: string;
  fail_reason?: string;
  publicaly_available_post_id?: (string | number)[];
};

const videoUrl = (postId: string | number) => `https://m.tiktok.com/v/${postId}.html`;

async function status(publishId: string, token: string) {
  return tiktok<Status>(token, "post/publish/status/fetch/", { body: { publish_id: publishId } });
}

const tiktokStatus: StatusCapability = {
  async fetch(publishId, token) {
    const state = await status(publishId, token);
    const postId = state.publicaly_available_post_id?.[0];
    return {
      visibility: state.status === "PUBLISH_COMPLETE" ? (postId ? "public" : "private") : undefined,
      uploadStatus: state.status?.toLowerCase(),
      problem: state.status === "FAILED" ? `TikTok refused the video: ${state.fail_reason}` : null,
      url: postId ? videoUrl(postId) : undefined,
    };
  },
};

export const tiktokProvider: SocialProvider = {
  id: "tiktok",
  name: "TikTok",
  schedulesNatively: false,
  defaultLeadMinutes: 0,

  connect: tiktokConnect,
  metadata: tiktokMetadata,
  // Videos only (3 s–10 min, upright); photo posts are not supported yet.
  formats: {
    video: true,
    image: false,
    minVideoMs: 3_000,
    maxVideoMs: 10 * 60_000,
    vertical: true,
  },
  status: tiktokStatus,

  async upload(post, token, metadata) {
    const meta = metadata as TikTokVideoMeta;
    const privacy = meta.privacyLevel ?? "SELF_ONLY";
    try {
      const creator = await tiktok<{ privacy_level_options?: string[] }>(
        token,
        "post/publish/creator_info/query/",
        { body: {} },
      );
      if (creator.privacy_level_options && !creator.privacy_level_options.includes(privacy)) {
        throw new PermanentPublishError(
          `This TikTok account cannot post as ${privacy}; it allows ${creator.privacy_level_options.join(", ")}`,
        );
      }

      const { size, contentType } = await mediaSize(post.url);
      const chunks = Math.max(1, Math.floor(size / CHUNK));
      const chunkSize = chunks === 1 ? size : CHUNK;
      const init = await tiktok<{ publish_id: string; upload_url: string }>(
        token,
        "post/publish/video/init/",
        {
          body: {
            post_info: {
              title: meta.title,
              privacy_level: privacy,
              disable_comment: meta.disableComment ?? false,
              disable_duet: meta.disableDuet ?? false,
              disable_stitch: meta.disableStitch ?? false,
              video_cover_timestamp_ms: meta.coverFrameMs,
              is_aigc: meta.isAigc,
            },
            source_info: {
              source: "FILE_UPLOAD",
              video_size: size,
              chunk_size: chunkSize,
              total_chunk_count: chunks,
            },
          },
        },
      );

      // Every chunk is chunkSize bytes except the last, which takes the remainder.
      for (let index = 0; index < chunks; index++) {
        const start = index * chunkSize;
        const end = index === chunks - 1 ? size : start + chunkSize;
        const res = await fetch(init.upload_url, {
          method: "PUT",
          headers: {
            "Content-Type": contentType.startsWith("video/") ? contentType : "video/mp4",
            "Content-Range": `bytes ${start}-${end - 1}/${size}`,
            "Content-Length": String(end - start),
          },
          body: await mediaRange(post.url, start, end),
        });
        if (!res.ok) throw new Error(`TikTok upload failed at chunk ${index + 1}: ${res.status}`);
      }

      // TikTok processes and posts on its own; wait a while to report the outcome.
      const until = Date.now() + MAX_WAIT_MS;
      let state = await status(init.publish_id, token);
      while (!["PUBLISH_COMPLETE", "FAILED"].includes(state.status ?? "") && Date.now() < until) {
        await sleep(POLL_MS);
        state = await status(init.publish_id, token);
      }
      if (state.status === "FAILED")
        throw new PermanentPublishError(`TikTok refused the video: ${state.fail_reason}`);
      const postId = state.publicaly_available_post_id?.[0];
      return {
        platformPostId: init.publish_id,
        platformUrl: postId ? videoUrl(postId) : undefined,
        responseLog:
          state.status === "PUBLISH_COMPLETE"
            ? `Posted to TikTok (${privacy})`
            : "Uploaded; TikTok is still processing it",
      };
    } catch (error) {
      if (
        error instanceof TikTokApiError &&
        !error.rateLimited &&
        error.status >= 400 &&
        error.status < 500
      )
        throw new PermanentPublishError(error.message);
      throw error;
    }
  },
};
