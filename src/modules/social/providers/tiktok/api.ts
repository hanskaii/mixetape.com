import { ReconnectRequiredError } from "../types";

/** Shared plumbing for TikTok's Open API v2. */

export const OPEN_API = "https://open.tiktokapis.com/v2";

export class TikTokApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TikTokApiError";
  }

  get rateLimited() {
    return this.status === 429 || this.code === "rate_limit_exceeded";
  }
}

/**
 * Calls the Open API as the user. TikTok answers `{ data, error: { code, message } }`,
 * where code "ok" means success; an invalid token becomes ReconnectRequiredError.
 */
export async function tiktok<T>(
  token: string,
  path: string,
  {
    method = "POST",
    body,
    query,
  }: { method?: "GET" | "POST"; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const url = new URL(`${OPEN_API}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined && { "Content-Type": "application/json; charset=UTF-8" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: T;
    error?: { code?: string; message?: string };
  };
  const code = json.error?.code ?? (res.ok ? "ok" : String(res.status));
  if (res.ok && code === "ok") return json.data as T;
  if (code === "access_token_invalid" || res.status === 401) {
    throw new ReconnectRequiredError(
      "TikTok no longer accepts this account's access — reconnect it",
    );
  }
  throw new TikTokApiError(
    res.status,
    code,
    `TikTok ${res.status} (${code}): ${json.error?.message ?? "request failed"}`,
  );
}
