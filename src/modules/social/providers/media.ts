import { env } from "cloudflare:workers";

/**
 * Reads the media of a post in ranges, wherever it lives.
 *
 * Media uploaded through this app sits in its own R2 bucket and is read through the
 * binding (`r2://<key>`, or this site's /api/storage/file/<key> URL) — no public URL and no
 * round trip through the internet. Anything else is fetched over HTTP with Range requests,
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
