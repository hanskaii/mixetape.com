import { PermanentPublishError, type Metadata } from "../types";
import { mediaRange, mediaSize } from "../media";
import { UPLOAD_API, readError } from "./api";
import type { YouTubeVideoMeta } from "./metadata";

/**
 * The resumable, chunked upload of a video (videos.insert, 1,600 quota units). A chunk that
 * fails is retried and resumed from the byte YouTube says it holds.
 */

const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB — a multiple of 256 KB as YouTube asks

type UploadResponse = { id: string; kind: string };
type Progress = UploadResponse | { received: number };

/** The body of videos.insert: a scheduled video goes up private with publishAt. */
function videoResource(meta: YouTubeVideoMeta, caption: string | null | undefined) {
  const madeForKids = meta.madeForKids ?? false;
  return {
    snippet: {
      title: (meta.title ?? caption ?? "Untitled").slice(0, 100),
      description: (meta.description ?? caption ?? "").slice(0, 5000),
      categoryId: meta.category ?? "22",
      tags: meta.tags ?? [],
      ...(meta.defaultLanguage && { defaultLanguage: meta.defaultLanguage }),
    },
    status: meta.publishAt
      ? {
          privacyStatus: "private",
          publishAt: meta.publishAt,
          selfDeclaredMadeForKids: madeForKids,
        }
      : { privacyStatus: meta.privacyStatus ?? "private", selfDeclaredMadeForKids: madeForKids },
    ...(meta.localizations && { localizations: meta.localizations }),
  };
}

/** Uploads the media at `url` as a new video and returns its id. */
export async function uploadVideo(
  url: string,
  caption: string | null | undefined,
  token: string,
  metadata: Metadata,
): Promise<string> {
  const meta = metadata as YouTubeVideoMeta;
  const resource = videoResource(meta, caption);
  const { size, contentType } = await mediaSize(url);
  console.log(`[YouTube] Uploading ${(size / 1024 / 1024).toFixed(2)} MB`);

  const parts = resource.localizations ? "snippet,status,localizations" : "snippet,status";
  const res = await fetch(
    `${UPLOAD_API}/videos?uploadType=resumable&part=${parts}&notifySubscribers=${meta.notifySubscribers ?? true}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": contentType,
        "X-Upload-Content-Length": size.toString(),
      },
      body: JSON.stringify(resource),
    },
  );
  if (!res.ok) throw await uploadError("initiate upload", res);
  const session = res.headers.get("location");
  if (!session) throw new Error("YouTube did not return an upload URL");

  return (await uploadInChunks(session, url, size, contentType)).id;
}

async function uploadInChunks(
  session: string,
  sourceUrl: string,
  size: number,
  contentType: string,
): Promise<UploadResponse> {
  let start = 0;
  while (start < size) {
    const end = Math.min(start + CHUNK_SIZE, size);
    const range = `bytes ${start}-${end - 1}/${size}`;
    const chunk = await mediaRange(sourceUrl, start, end);
    const result = await putChunkWithRetry(session, chunk, range, end - start, contentType);
    if ("id" in result) return result; // the last chunk answers with the video
    // YouTube says how far it got; a chunk it only partly kept is resumed from there.
    start = result.received;
  }
  throw new Error("Upload loop finished without a final response from YouTube");
}

async function putChunkWithRetry(
  session: string,
  chunk: ArrayBuffer,
  range: string,
  length: number,
  contentType: string,
  maxRetries = 3,
): Promise<Progress> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(session, {
        method: "PUT",
        headers: {
          "Content-Length": length.toString(),
          "Content-Range": range,
          "Content-Type": contentType,
        },
        body: chunk,
      });
      if (res.status === 308) return { received: receivedBytes(res) };
      if (res.status === 200 || res.status === 201) return (await res.json()) as UploadResponse;
      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429)
        throw await uploadError("chunk upload", res);
      throw new Error(`YouTube chunk upload returned ${res.status}`);
    } catch (error) {
      if (error instanceof PermanentPublishError) throw error;
      lastError = error;
      console.warn(`[YouTube] Chunk retry ${attempt}/${maxRetries}`, error);
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
      // After a failed PUT the server may hold part of the chunk; ask before resending.
      const status = await uploadStatus(session, range).catch(() => null);
      if (status) return status;
    }
  }
  throw new Error(`Chunk upload failed after ${maxRetries} retries: ${lastError}`);
}

/** Where an interrupted resumable upload stands: finished, or how many bytes it holds. */
async function uploadStatus(session: string, range: string): Promise<Progress | null> {
  const total = range.split("/")[1];
  const res = await fetch(session, {
    method: "PUT",
    headers: { "Content-Length": "0", "Content-Range": `bytes */${total}` },
  });
  if (res.status === 200 || res.status === 201) return (await res.json()) as UploadResponse;
  if (res.status === 308) return { received: receivedBytes(res) };
  return null;
}

const QUOTA_REASONS = [
  "quotaExceeded",
  "dailyLimitExceeded",
  "userRateLimitExceeded",
  "uploadLimitExceeded",
];

/**
 * Turns a refused upload into an error the scheduler understands: quota and auth problems
 * are named, and client errors a retry cannot fix are marked permanent.
 */
async function uploadError(stage: string, res: Response): Promise<Error> {
  const { reasons, message } = await readError(res);
  if (reasons.some((reason) => QUOTA_REASONS.includes(reason)))
    return new Error("YOUTUBE_QUOTA_EXCEEDED");
  if (res.status === 401) return new Error("YouTube authentication failed");
  const text = `YouTube ${stage} failed: ${res.status}${reasons.length ? ` (${reasons.join(", ")})` : ""} ${message}`;
  if (res.status === 400 || res.status === 403 || res.status === 404)
    return new PermanentPublishError(text);
  return new Error(text);
}

/** Parses the `Range: bytes=0-N` header of a 308 into the next byte to send. */
function receivedBytes(res: Response): number {
  const match = res.headers.get("range")?.match(/bytes=0-(\d+)/);
  return match ? Number(match[1]) + 1 : 0;
}
