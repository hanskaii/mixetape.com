/**
 * Sends a file to /api/media/upload in parts, so a video of any size reaches R2 without a
 * request ever exceeding the 100 MB body limit. Returns the `r2://` media URL for a post.
 */

const PART_SIZE = 50 * 1024 * 1024; // R2 needs ≥ 5 MB for every part but the last

type Part = { partNumber: number; etag: string };

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);
  return data;
}

export async function uploadMedia(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const json = { "content-type": "application/json" };
  const { key, uploadId } = await call<{ key: string; uploadId: string }>(
    "/api/media/upload?action=create",
    {
      method: "POST",
      headers: json,
      body: JSON.stringify({ name: file.name, type: file.type || "video/mp4" }),
    },
  );

  try {
    const parts: Part[] = [];
    const total = Math.max(1, Math.ceil(file.size / PART_SIZE));
    for (let index = 0; index < total; index++) {
      const blob = file.slice(index * PART_SIZE, (index + 1) * PART_SIZE);
      const query = new URLSearchParams({ action: "part", key, uploadId, part: String(index + 1) });
      parts.push(await call<Part>(`/api/media/upload?${query}`, { method: "PUT", body: blob }));
      onProgress?.((index + 1) / total);
    }
    const done = await call<{ url: string }>("/api/media/upload?action=complete", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ key, uploadId, parts }),
    });
    return done.url;
  } catch (error) {
    // Leave no half-finished upload behind in the bucket.
    await fetch("/api/media/upload?action=abort", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ key, uploadId }),
    }).catch(() => {});
    throw error;
  }
}
