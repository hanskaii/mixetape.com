/** Shared plumbing for the YouTube Data and Analytics APIs. */

export const DATA_API = "https://www.googleapis.com/youtube/v3";
export const UPLOAD_API = "https://www.googleapis.com/upload/youtube/v3";
export const ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2";

export const videoUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

type Query = Record<string, string | number | boolean | undefined>;

export class YouTubeApiError extends Error {
  constructor(
    readonly status: number,
    readonly reasons: string[],
    message: string,
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

/** Google's error body: `{ error: { message, errors: [{ reason }] } }`. */
export async function readError(res: Response): Promise<{ reasons: string[]; message: string }> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as {
      error?: { message?: string; errors?: { reason?: string }[] };
    };
    return {
      reasons: (body.error?.errors ?? []).map((error) => error.reason ?? "").filter(Boolean),
      message: body.error?.message ?? text.slice(0, 300),
    };
  } catch {
    return { reasons: [], message: text.slice(0, 300) };
  }
}

/**
 * Calls a YouTube endpoint as the account and returns its JSON (undefined for 204). A
 * refusal becomes a YouTubeApiError that says what YouTube said.
 */
export async function youtubeFetch<T>(
  token: string,
  url: string,
  { query, ...init }: RequestInit & { query?: Query } = {},
): Promise<T> {
  const target = new URL(url);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) target.searchParams.set(key, String(value));
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (typeof init.body === "string" && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");

  const res = await fetch(target, { ...init, headers });
  if (!res.ok) {
    const { reasons, message } = await readError(res);
    throw new YouTubeApiError(
      res.status,
      reasons,
      `YouTube ${res.status}${reasons.length ? ` (${reasons.join(", ")})` : ""}: ${message}`,
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Fetches a public file (thumbnail, caption) the caller pointed us at. */
export async function download(url: string, what: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${what} not reachable (${res.status}): ${url}`);
  return res;
}
