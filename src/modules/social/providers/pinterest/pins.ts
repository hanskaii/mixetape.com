import { mediaStream, publicMediaUrl } from "../media";
import {
  PermanentPublishError,
  type AnalyticsCapability,
  type CollectionsCapability,
  type Metadata,
  type Metrics,
  type PostWithMedia,
  type StatusCapability,
} from "../types";
import { PinterestApiError, pinterest } from "./api";
import type { PinterestPinMeta } from "./metadata";

/**
 * Pins, boards and Pin analytics. A video goes to Pinterest's upload bucket first (a
 * multipart form streamed straight from mixetape's storage, so a large file never sits in
 * memory), then becomes a Pin once Pinterest has processed it. An image is taken by URL,
 * and several images become one carousel Pin.
 */

const POLL_MS = 10_000;
const MAX_WAIT_MS = 15 * 60_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const pinUrl = (id: string) => `https://www.pinterest.com/pin/${id}/`;

function refused(error: unknown): Error {
  if (
    error instanceof PinterestApiError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 429
  )
    return new PermanentPublishError(error.message);
  return error instanceof Error ? error : new Error(String(error));
}

/** Streams the media into Pinterest's bucket as the multipart form it asks for. */
async function uploadVideo(url: string, token: string): Promise<string> {
  const registered = await pinterest<{
    media_id: string;
    upload_url: string;
    upload_parameters: Record<string, string>;
  }>(token, "media", { method: "POST", body: { media_type: "video" } });

  const { stream, size, contentType } = await mediaStream(url);
  const boundary = `mixetape-${crypto.randomUUID()}`;
  const encoder = new TextEncoder();
  const fields = Object.entries(registered.upload_parameters)
    .map(
      ([key, value]) =>
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
    )
    .join("");
  const head = encoder.encode(
    `${fields}--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="video.mp4"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = encoder.encode(`\r\n--${boundary}--\r\n`);

  // S3 needs the exact length up front; FixedLengthStream carries it.
  const { readable, writable } = new FixedLengthStream(head.byteLength + size + tail.byteLength);
  const pump = (async () => {
    const writer = writable.getWriter();
    await writer.write(head);
    const reader = stream.getReader();
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read())
      await writer.write(chunk.value);
    await writer.write(tail);
    await writer.close();
  })();
  const res = await fetch(registered.upload_url, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: readable,
  });
  await pump;
  if (!res.ok) throw new Error(`Pinterest video upload failed: ${res.status} ${await res.text()}`);

  const until = Date.now() + MAX_WAIT_MS;
  while (true) {
    const media = await pinterest<{ status?: string }>(token, `media/${registered.media_id}`);
    if (media.status === "succeeded") return registered.media_id;
    if (media.status === "failed")
      throw new PermanentPublishError("Pinterest could not process the video");
    if (Date.now() > until) throw new Error("Pinterest is still processing the video; will retry");
    await sleep(POLL_MS);
  }
}

export async function createPin(post: PostWithMedia, token: string, metadata: Metadata) {
  const meta = metadata as PinterestPinMeta;
  const [first] = post.media;
  try {
    const media_source =
      post.media.length > 1
        ? {
            source_type: "multiple_image_urls",
            items: post.media.map((item) => ({ url: publicMediaUrl(item.url) })),
          }
        : first.kind === "image"
          ? { source_type: "image_url", url: publicMediaUrl(first.url) }
          : {
              source_type: "video_id",
              media_id: await uploadVideo(post.url, token),
              ...(meta.thumbnailUrl
                ? { cover_image_url: meta.thumbnailUrl }
                : { cover_image_key_frame_time: meta.coverFrameSeconds ?? 1 }),
            };
    const pin = await pinterest<{ id: string }>(token, "pins", {
      method: "POST",
      body: {
        board_id: meta.boardId,
        title: meta.title,
        description: meta.description,
        link: meta.link,
        alt_text: meta.altText,
        media_source,
      },
    });
    return { platformPostId: pin.id, platformUrl: pinUrl(pin.id) };
  } catch (error) {
    throw refused(error);
  }
}

export const pinterestStatus: StatusCapability = {
  async fetch(pinId, token) {
    try {
      await pinterest(token, `pins/${pinId}`);
      return { visibility: "public", uploadStatus: "published", url: pinUrl(pinId) };
    } catch (error) {
      if (error instanceof PinterestApiError && error.status === 404)
        return { uploadStatus: "deleted", problem: "The Pin is no longer on Pinterest" };
      throw error;
    }
  },
};

type Board = {
  id: string;
  name: string;
  description?: string;
  privacy?: string;
  pin_count?: number;
};

const toCollection = (board: Board) => ({
  id: board.id,
  title: board.name,
  description: board.description || undefined,
  visibility: board.privacy?.toLowerCase(),
  itemCount: board.pin_count,
});

/** Boards, as collections. */
export const pinterestBoards: CollectionsCapability = {
  async list(token) {
    const boards: Board[] = [];
    let bookmark: string | undefined;
    for (let page = 0; page < 10; page++) {
      const data = await pinterest<{ items?: Board[]; bookmark?: string | null }>(token, "boards", {
        query: { page_size: "100", ...(bookmark && { bookmark }) },
      });
      boards.push(...(data.items ?? []));
      if (!data.bookmark) break;
      bookmark = data.bookmark;
    }
    return boards.map(toCollection);
  },

  async create(token, { title, description, visibility }) {
    const board = await pinterest<Board>(token, "boards", {
      method: "POST",
      body: { name: title, description, privacy: visibility === "private" ? "SECRET" : "PUBLIC" },
    });
    return toCollection(board);
  },

  async add(token, boardId, pinId) {
    await pinterest(token, `pins/${pinId}/save`, { method: "POST", body: { board_id: boardId } });
  },
};

type Summary = Record<string, number | undefined>;

const METRICS = "IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK,VIDEO_MRC_VIEW,VIDEO_AVG_WATCH_TIME";

function metrics(summary: Summary | undefined): Metrics {
  const avgMs = summary?.VIDEO_AVG_WATCH_TIME;
  return {
    views: summary?.VIDEO_MRC_VIEW ?? summary?.IMPRESSION,
    shares: summary?.SAVE,
    averageViewDurationSeconds: avgMs === undefined ? undefined : Math.round(avgMs / 10) / 100,
  };
}

/** Pin and account analytics (Pinterest keeps 90 days of daily numbers). */
export const pinterestAnalytics: AnalyticsCapability = {
  delayDays: 2,

  async post(pinId, token, range) {
    const data = await pinterest<{ all?: { summary_metrics?: Summary } }>(
      token,
      `pins/${pinId}/analytics`,
      {
        query: { start_date: range.from, end_date: range.to, metric_types: METRICS },
      },
    );
    return { range, totals: metrics(data.all?.summary_metrics), retention: [], trafficSources: [] };
  },

  async account(_accountId, token, range) {
    const data = await pinterest<{
      all?: { summary_metrics?: Summary; daily_metrics?: { date: string; metrics?: Summary }[] };
    }>(token, "user_account/analytics", {
      query: {
        start_date: range.from,
        end_date: range.to,
        metric_types: "IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK",
      },
    });
    return {
      range,
      totals: metrics(data.all?.summary_metrics),
      daily: (data.all?.daily_metrics ?? []).map((day) => ({
        date: day.date,
        ...metrics(day.metrics),
      })),
      topPosts: [],
      trafficSources: [],
    };
  },
};
