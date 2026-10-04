import { env } from "cloudflare:workers";
import { ReconnectRequiredError } from "../types";

/** Shared plumbing for the Pinterest API v5. */

/**
 * An app on Trial access may not create Pins in production, only in Pinterest's API
 * Sandbox, whose tokens, boards and Pins are separate from production. PINTEREST_SANDBOX
 * points every call (OAuth included) there; remove it once the app has Standard access,
 * then reconnect the Pinterest accounts.
 */
export const sandbox = () => env.PINTEREST_SANDBOX === "true";
export const pinterestBase = () =>
  sandbox() ? "https://api-sandbox.pinterest.com/v5" : "https://api.pinterest.com/v5";

export class PinterestApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "PinterestApiError";
  }
}

export async function pinterest<T>(
  token: string,
  path: string,
  {
    method = "GET",
    body,
    query,
  }: { method?: "GET" | "POST"; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const url = new URL(`${pinterestBase()}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined && { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401) {
    throw new ReconnectRequiredError(
      "Pinterest no longer accepts this account's access — reconnect it",
    );
  }
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok)
    throw new PinterestApiError(
      res.status,
      `Pinterest ${res.status}: ${data.message ?? "request failed"}`,
    );
  return data;
}
