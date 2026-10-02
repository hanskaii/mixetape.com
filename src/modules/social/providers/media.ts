import { env } from "cloudflare:workers";
import type { MediaItem } from "./types";

/**
 * Reads the media of a post in ranges, wherever it lives.
 *
 * Media uploaded through this app sits in its own R2 bucket and is read through the
 * binding (`r2://<key>`, its media.mixetape.com URL, or this site's /api/storage/file/<key>
 * URL) — no round trip through the internet. Anything else is fetched over HTTP with Range requests,
 * which public R2 buckets and most CDNs support.
 */

const STORAGE_PATH = "/api/storage/file/";

function bucketKey(url: string): string | null {
  if (url.startsWith("r2://")) return url.slice("r2://".length);
  try {
    const parsed = new URL(url);
    const site = env.SITE_URL ? new URL(env.SITE_URL) : null;
    if (site && parsed.host === site.host && parsed.pathname.startsWith(STORAGE_PATH)) {
      return decodeURIComponent(parsed.pathname.slice(STORAGE_PATH.length));
    }
    const media = env.MEDIA_PUBLIC_URL ? new URL(env.MEDIA_PUBLIC_URL) : null;
    if (media && parsed.host === media.host) return decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    // not a URL at all; falls through to the HTTP error below
  }
  return null;
}

export async function mediaSize(url: string): Promise<{ size: number; contentType: string }> {
  const key = bucketKey(url);
  if (key) {
    const head = await env.BUCKET.head(key);
    if (!head) throw new Error(`Media not found in storage: ${key}`);
    return { size: head.size, contentType: head.httpMetadata?.contentType ?? "video/mp4" };
  }

  const res = await fetch(url, { method: "HEAD" });
  if (!res.ok) throw new Error(`Cannot reach media URL: ${res.status}`);
  const size = Number.parseInt(res.headers.get("content-length") ?? "0", 10);
  if (!size) throw new Error("Could not determine media size (missing Content-Length)");
  return { size, contentType: res.headers.get("content-type") ?? "video/mp4" };
}

/** Bytes [start, end) of the media. */
export async function mediaRange(url: string, start: number, end: number): Promise<ArrayBuffer> {
  const key = bucketKey(url);
  if (key) {
    const object = await env.BUCKET.get(key, { range: { offset: start, length: end - start } });
    if (!object) throw new Error(`Media not found in storage: ${key}`);
    return object.arrayBuffer();
  }

  const res = await fetch(url, { headers: { Range: `bytes=${start}-${end - 1}` } });
  if (!res.ok) throw new Error(`Failed to fetch media range: ${res.status}`);
  const body = await res.arrayBuffer();
  // A server that ignores Range sends the whole file; take our slice of it rather than
  // uploading the wrong bytes.
  if (res.status === 200 && body.byteLength !== end - start) return body.slice(start, end);
  return body;
}

/**
 * A URL the platform itself can fetch, for platforms that pull media rather than take an
 * upload (Facebook's file_url). Files in mixetape's bucket are public on its custom domain.
 */
export function publicMediaUrl(url: string): string {
  const key = bucketKey(url);
  if (!key) return url;
  const base = (env.MEDIA_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (!base) throw new Error("MEDIA_PUBLIC_URL is not set, so stored media has no public URL");
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** The whole media as a stream with its size and type, for uploads a platform takes in one body. */
export async function mediaStream(
  url: string,
): Promise<{ stream: ReadableStream; size: number; contentType: string }> {
  const key = bucketKey(url);
  if (key) {
    const object = await env.BUCKET.get(key);
    if (!object) throw new Error(`Media not found in storage: ${key}`);
    return {
      stream: object.body,
      size: object.size,
      contentType: object.httpMetadata?.contentType ?? "video/mp4",
    };
  }
  const res = await fetch(url);
  const size = Number(res.headers.get("content-length") ?? 0);
  if (!res.ok || !res.body || !size) throw new Error(`Cannot read media URL: ${res.status}`);
  return { stream: res.body, size, contentType: res.headers.get("content-type") ?? "video/mp4" };
}

/**
 * A stored image as JPEG, made at the edge by Cloudflare Image Transformations from the
 * public URL — for platforms that take JPEG only. At most 1440 px wide, Instagram's limit.
 */
export function jpegUrl(url: string, width = 1440, quality = 92): string {
  const key = bucketKey(url);
  if (!key) return url;
  const base = (env.MEDIA_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (!base) throw new Error("MEDIA_PUBLIC_URL is not set, so stored media has no public URL");
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `${base}/cdn-cgi/image/format=jpeg,quality=${quality},fit=scale-down,width=${width}/${path}`;
}

/**
 * The URL a platform should fetch an image from: as stored when it takes that type, turned
 * into JPEG on the way when not (a PNG for Instagram). Unknown types go as they are.
 */
export function imageUrlFor(item: MediaItem, accepted: readonly string[] | undefined): string {
  if (!accepted || !item.type || accepted.includes(item.type)) return publicMediaUrl(item.url);
  return jpegUrl(item.url);
}
