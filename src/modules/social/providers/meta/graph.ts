import { ReconnectRequiredError } from "../types";

/** Shared plumbing for Meta's Graph API, used by the Facebook and Instagram providers. */

export const GRAPH_VERSION = "v25.0";
export const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

type Params = Record<string, string | number | boolean | undefined>;

export class GraphApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: number | undefined,
    readonly subcode: number | undefined,
    message: string,
  ) {
    super(message);
    this.name = "GraphApiError";
  }

  /** The object is gone (deleted, or never existed for this token). */
  get notFound() {
    return this.code === 100 && this.subcode === 33;
  }

  /** Rate limits: application (4), user (17), page (32), and too many calls (613). */
  get rateLimited() {
    return [4, 17, 32, 613].includes(this.code ?? 0);
  }
}

const toForm = (params: Params) => {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) form.set(key, String(value));
  }
  return form;
};

/**
 * Calls the Graph API as the given token. GET sends the params as a query, POST as a form
 * body (or a multipart body when one is given). An expired or revoked token (code 190)
 * becomes a ReconnectRequiredError; anything else a GraphApiError with Meta's message.
 */
export async function graph<T>(
  token: string,
  path: string,
  {
    method = "GET",
    params = {},
    body,
  }: { method?: "GET" | "POST" | "DELETE"; params?: Params; body?: FormData } = {},
): Promise<T> {
  const url = new URL(path.startsWith("https://") ? path : `${GRAPH}/${path.replace(/^\//, "")}`);
  const init: RequestInit = { method, headers: { Authorization: `Bearer ${token}` } };
  if (method === "GET" || method === "DELETE") {
    for (const [key, value] of toForm(params)) url.searchParams.set(key, value);
  } else if (body) {
    for (const [key, value] of toForm(params)) body.set(key, value);
    init.body = body;
  } else {
    init.body = toForm(params);
  }

  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string; code?: number; error_subcode?: number };
  };
  if (res.ok && !data.error) return data;

  const error = data.error ?? {};
  if (error.code === 190) {
    throw new ReconnectRequiredError(
      "Meta no longer accepts this account's access — reconnect it on Channels",
    );
  }
  throw new GraphApiError(
    res.status,
    error.code,
    error.error_subcode,
    `Meta ${res.status}${error.code ? ` (code ${error.code})` : ""}: ${error.message ?? "request failed"}`,
  );
}

/** Fetches a public file (thumbnail, caption) the caller pointed us at. */
export async function download(url: string, what: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${what} not reachable (${res.status}): ${url}`);
  return res;
}
