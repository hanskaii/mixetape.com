import { ReconnectRequiredError } from "../types";

/**
 * Talking to a person's Mastodon server. Every server is its own platform, so what mixetape
 * stores as an account's token is a session: the server and the token together (JSON,
 * encrypted like every token).
 */

export type MastodonSession = { server: string; token: string };

export const encodeSession = (session: MastodonSession) => JSON.stringify(session);

export function readSession(stored: string): MastodonSession {
  const session = JSON.parse(stored) as MastodonSession;
  if (!session.server || !session.token) throw new ReconnectRequiredError();
  return session;
}

export class MastodonApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MastodonApiError";
  }
}

/**
 * The server's origin from what a person types: "mastodon.social", "https://mastodon.social",
 * "@you@mastodon.social" or "you@mastodon.social".
 */
export function serverOf(input: string): string {
  const value = input.trim().replace(/^@/, "");
  const host = value.includes("@") ? value.split("@").pop()! : value;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//.test(host) ? host : `https://${host}`);
  } catch {
    throw new Error(`"${input}" is not a Mastodon account or server`);
  }
  if (!url.hostname.includes(".") || /^\d+(\.\d+){3}$/.test(url.hostname))
    throw new Error(`"${input}" is not a Mastodon account or server`);
  return `https://${url.hostname}`;
}

type Options = {
  method?: string;
  query?: Record<string, string | number | undefined>;
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
};

/** A call to the person's server with their token; a refused token needs reconnecting. */
export async function mastodon<T>(
  session: MastodonSession,
  path: string,
  options: Options = {},
): Promise<T> {
  const url = new URL(`${session.server}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {}))
    if (value !== undefined) url.searchParams.set(key, String(value));
  const res = await fetch(url, {
    method: options.method ?? (options.json || options.body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${session.token}`,
      Accept: "application/json",
      ...(options.json !== undefined && { "Content-Type": "application/json" }),
      ...options.headers,
    },
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
  });
  if (res.status === 401) throw new ReconnectRequiredError();
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok)
    throw new MastodonApiError(
      `Mastodon (${new URL(session.server).hostname}) refused it: ${data.error ?? `HTTP ${res.status}`}`,
      res.status,
    );
  return data;
}

/** What the server allows: text length and media limits (Mastodon 4's /api/v2/instance). */
export type InstanceLimits = {
  maxCharacters: number;
  urlLength: number;
  maxMedia: number;
  imageSizeLimit: number;
  videoSizeLimit: number;
};

const limits = new Map<string, Promise<InstanceLimits>>();

export function instanceLimits(server: string): Promise<InstanceLimits> {
  let cached = limits.get(server);
  if (!cached) {
    cached = (async () => {
      const res = await fetch(`${server}/api/v2/instance`, {
        headers: { Accept: "application/json" },
      });
      const data = (await res.json().catch(() => ({}))) as {
        configuration?: {
          statuses?: {
            max_characters?: number;
            characters_reserved_per_url?: number;
            max_media_attachments?: number;
          };
          media_attachments?: { image_size_limit?: number; video_size_limit?: number };
        };
      };
      const config = data.configuration ?? {};
      return {
        maxCharacters: config.statuses?.max_characters ?? 500,
        urlLength: config.statuses?.characters_reserved_per_url ?? 23,
        maxMedia: config.statuses?.max_media_attachments ?? 4,
        imageSizeLimit: config.media_attachments?.image_size_limit ?? 16 * 1024 * 1024,
        videoSizeLimit: config.media_attachments?.video_size_limit ?? 99 * 1024 * 1024,
      };
    })();
    limits.set(server, cached);
    cached.catch(() => limits.delete(server));
  }
  return cached;
}

/** A status's text as Mastodon counts it: every link is a fixed number of characters. */
export function countCharacters(text: string, urlLength: number) {
  return [...text.replace(/https?:\/\/\S+/g, "x".repeat(urlLength))].length;
}

/** Plain text from a status's HTML content. */
export const plainText = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
