// Adapted from clean/integrations/youtube-provider.ts — real chunked upload with retry

import type {
  SocialProvider,
  PostWithMedia,
  UploadResult,
  PlatformMetrics,
  PlatformStatus,
  YouTubeVideoMeta,
} from "./types";
import { PermanentPublishError } from "./types";
import { mediaRange, mediaSize } from "./media";
import { GoogleAuthFlow } from "../oauth/google-oauth";

const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB — multiple of 256 KB as YouTube recommends

interface YouTubeApiRequest {
  snippet: {
    title: string;
    description: string;
    categoryId: string;
    tags: string[];
  };
  status: {
    privacyStatus: string;
    publishAt?: string;
    selfDeclaredMadeForKids: boolean;
  };
}

interface YouTubeUploadResponse {
  id: string;
  kind: string;
}

export class YoutubeProvider implements SocialProvider {
  readonly id = "youtube";
  readonly name = "YouTube";
  readonly schedulesNatively = true;
  // Long videos need time for YouTube to build the HD versions; half an hour covers most.
  readonly defaultLeadMinutes = 30;

  async upload(
    post: PostWithMedia,
    accessToken: string,
    clientKey: string,
    secretKey: string,
    metadata: YouTubeVideoMeta,
  ): Promise<UploadResult> {
    if (!post.url) throw new PermanentPublishError("Video URL is required for YouTube upload");
    if (!clientKey || !secretKey)
      throw new PermanentPublishError("YouTube requires clientKey and secretKey");

    console.log("[YouTube] Starting chunked upload", { postId: post.id });

    const title = (metadata?.title ?? post.caption ?? "Untitled").slice(0, 100);
    // A scheduled video is uploaded private with publishAt; YouTube flips it public on time.
    const apiRequest: YouTubeApiRequest = {
      snippet: {
        title,
        description: (metadata?.description ?? post.caption ?? "").slice(0, 5000),
        categoryId: metadata?.category ?? "22",
        tags: metadata?.tags ?? [],
      },
      status: metadata?.publishAt
        ? {
            privacyStatus: "private",
            publishAt: metadata.publishAt,
            selfDeclaredMadeForKids: metadata.madeForKids ?? false,
          }
        : {
            privacyStatus: metadata?.privacyStatus ?? "private",
            selfDeclaredMadeForKids: metadata.madeForKids ?? false,
          },
    };

    const { size: fileSize, contentType } = await mediaSize(post.url);
    console.log(`[YouTube] File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    const uploadUrl = await this.initiateResumableUpload(
      accessToken,
      apiRequest,
      fileSize,
      contentType,
      metadata?.notifySubscribers ?? true,
    );
    const result = await this.uploadInChunks(uploadUrl, post.url, fileSize, contentType);

    // The video is up either way; a refused thumbnail is reported, not fatal.
    let warning: string | undefined;
    if (metadata?.thumbnailUrl) {
      try {
        await this.setThumbnail(result.id, metadata.thumbnailUrl, accessToken);
      } catch (error) {
        warning = `Thumbnail not set: ${error instanceof Error ? error.message : String(error)}`;
        console.warn("[YouTube]", warning);
      }
    }

    return {
      platformPostId: result.id,
      platformUrl: `https://www.youtube.com/watch?v=${result.id}`,
      responseLog: metadata?.publishAt
        ? `Video uploaded; YouTube publishes it at ${metadata.publishAt}`
        : "Video uploaded successfully",
      warning,
    };
  }

  /** Sets a custom thumbnail on a video already on YouTube (thumbnails.set, 50 quota units). */
  async setThumbnail(videoId: string, imageUrl: string, accessToken: string): Promise<void> {
    const image = await fetch(imageUrl);
    if (!image.ok) throw new Error(`thumbnail image not reachable (${image.status}): ${imageUrl}`);
    const bytes = await image.arrayBuffer();
    if (bytes.byteLength > 2 * 1024 * 1024)
      throw new Error("thumbnail is larger than YouTube's 2 MB limit");
    const type = image.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!/^image\/(jpeg|png)$/.test(type))
      throw new Error(`thumbnail must be JPEG or PNG, not ${type}`);

    const res = await fetch(
      `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": type },
        body: bytes,
      },
    );
    if (!res.ok) {
      const body = await res.text();
      // 403 here usually means the channel is not verified for custom thumbnails.
      throw new Error(`YouTube ${res.status}: ${body.slice(0, 300)}`);
    }
  }

  async refreshToken(
    refreshToken: string,
    clientKey: string,
    secretKey: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    return GoogleAuthFlow.refreshAccessToken(clientKey, secretKey, refreshToken);
  }

  async fetchAnalytics(videoId: string, accessToken: string): Promise<PlatformMetrics | null> {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(videoId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      items?: {
        statistics?: {
          viewCount?: string;
          likeCount?: string;
          commentCount?: string;
        };
      }[];
    };
    const stats = data.items?.[0]?.statistics ?? {};

    return {
      views: parseInt(stats.viewCount ?? "0", 10),
      likes: parseInt(stats.likeCount ?? "0", 10),
      comments: parseInt(stats.commentCount ?? "0", 10),
      raw: data,
    };
  }

  /**
   * Where a video stands on YouTube: visibility, processing, a scheduled publishAt, and
   * any rejection or failure. YouTube has no field for "locked private" (what happens to
   * uploads from an unverified OAuth app); such a video simply stays private after its
   * publishAt has passed.
   */
  async fetchStatus(videoId: string, accessToken: string): Promise<PlatformStatus | null> {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=status,processingDetails&id=${encodeURIComponent(videoId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      items?: {
        status?: {
          uploadStatus?: string;
          privacyStatus?: string;
          publishAt?: string;
          failureReason?: string;
          rejectionReason?: string;
        };
        processingDetails?: { processingStatus?: string };
      }[];
    };
    const item = data.items?.[0];
    if (!item) return { uploadStatus: "deleted", problem: "The video is no longer on YouTube" };
    const status = item.status ?? {};
    return {
      visibility: status.privacyStatus,
      uploadStatus: status.uploadStatus ?? item.processingDetails?.processingStatus,
      publishAt: status.publishAt ?? null,
      problem: status.rejectionReason
        ? `Rejected by YouTube: ${status.rejectionReason}`
        : status.failureReason
          ? `Processing failed: ${status.failureReason}`
          : null,
      url: `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  private async initiateResumableUpload(
    accessToken: string,
    apiRequest: YouTubeApiRequest,
    fileSize: number,
    contentType: string,
    notifySubscribers: boolean,
  ): Promise<string> {
    const res = await fetch(
      `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=${notifySubscribers}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": contentType,
          "X-Upload-Content-Length": fileSize.toString(),
        },
        body: JSON.stringify(apiRequest),
      },
    );

    if (!res.ok) throw await this.apiError("initiate upload", res);

    const uploadUrl = res.headers.get("location");
    if (!uploadUrl) throw new Error("YouTube did not return an upload URL");
    return uploadUrl;
  }

  private async uploadInChunks(
    uploadUrl: string,
    sourceUrl: string,
    fileSize: number,
    contentType: string,
  ): Promise<YouTubeUploadResponse> {
    let start = 0;

    while (start < fileSize) {
      const end = Math.min(start + CHUNK_SIZE, fileSize);
      const contentRange = `bytes ${start}-${end - 1}/${fileSize}`;
      const contentLength = end - start;

      console.log(
        `[YouTube] Chunk: ${contentRange} (${(contentLength / 1024 / 1024).toFixed(2)} MB)`,
      );

      const chunkBuffer = await mediaRange(sourceUrl, start, end);
      const result = await this.uploadChunkWithRetry(
        uploadUrl,
        chunkBuffer,
        contentRange,
        contentLength,
        contentType,
      );

      if ("id" in result) return result; // Last chunk returns the final response
      // YouTube says how far it got; a chunk it only partly kept is resumed from there.
      start = result.received;
    }

    throw new Error("Upload loop finished without a final response from YouTube");
  }

  private async uploadChunkWithRetry(
    uploadUrl: string,
    buffer: ArrayBuffer,
    contentRange: string,
    contentLength: number,
    contentType: string,
    maxRetries = 3,
  ): Promise<YouTubeUploadResponse | { received: number }> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Length": contentLength.toString(),
            "Content-Range": contentRange,
            "Content-Type": contentType,
          },
          body: buffer,
        });

        // Resume Incomplete — chunk accepted, not last
        if (res.status === 308) return { received: receivedBytes(res) };
        if (res.status === 200 || res.status === 201)
          return (await res.json()) as YouTubeUploadResponse;
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          throw await this.apiError("chunk upload", res);
        }

        throw new Error(`YouTube chunk upload returned ${res.status}`);
      } catch (err) {
        if (err instanceof PermanentPublishError) throw err;
        lastError = err;
        console.warn(`[YouTube] Chunk retry ${attempt}/${maxRetries}`, err);
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
        // After a failed PUT the server may hold part of the chunk; ask before resending.
        const status = await this.queryUploadStatus(uploadUrl, contentRange).catch(() => null);
        if (status) return status;
      }
    }

    throw new Error(`Chunk upload failed after ${maxRetries} retries: ${lastError}`);
  }

  /** Where an interrupted resumable upload stands: finished, or how many bytes it holds. */
  private async queryUploadStatus(
    uploadUrl: string,
    contentRange: string,
  ): Promise<YouTubeUploadResponse | { received: number } | null> {
    const total = contentRange.split("/")[1];
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Length": "0", "Content-Range": `bytes */${total}` },
    });
    if (res.status === 200 || res.status === 201)
      return (await res.json()) as YouTubeUploadResponse;
    if (res.status === 308) return { received: receivedBytes(res) };
    return null;
  }

  /**
   * Turns a YouTube error reply into an error the scheduler understands: quota and auth
   * problems are named, and client errors that a retry cannot fix are marked permanent.
   */
  private async apiError(stage: string, res: Response): Promise<Error> {
    const text = await res.text();
    let reasons: string[] = [];
    try {
      const body = JSON.parse(text) as { error?: { errors?: { reason?: string }[] } };
      reasons = (body.error?.errors ?? []).map((e) => e.reason ?? "").filter(Boolean);
    } catch {
      // not JSON
    }

    const quotaReasons = [
      "quotaExceeded",
      "dailyLimitExceeded",
      "userRateLimitExceeded",
      "uploadLimitExceeded",
    ];
    if (reasons.some((reason) => quotaReasons.includes(reason)))
      return new Error("YOUTUBE_QUOTA_EXCEEDED");
    if (res.status === 401) return new Error("YouTube authentication failed");
    const message = `YouTube ${stage} failed: ${res.status}${reasons.length ? ` (${reasons.join(", ")})` : ""} ${text.slice(0, 300)}`;
    if (res.status === 400 || res.status === 403 || res.status === 404)
      return new PermanentPublishError(message);
    return new Error(message);
  }
}

/** Parses the `Range: bytes=0-N` header of a 308 into the next byte to send. */
function receivedBytes(res: Response): number {
  const range = res.headers.get("range");
  const match = range?.match(/bytes=0-(\d+)/);
  return match ? Number(match[1]) + 1 : 0;
}
