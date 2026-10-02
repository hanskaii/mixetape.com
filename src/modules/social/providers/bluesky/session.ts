import type { JWK } from "jose";
import { ReconnectRequiredError } from "../types";
import { dpopFetch } from "./oauth";

/**
 * A Bluesky session as mixetape stores it for an account (JSON, encrypted like every
 * token): the account's DID and PDS, who issued the tokens, the tokens, and the DPoP key
 * they are bound to — the access token is useless without it.
 */

export type Session = {
  did: string;
  pds: string;
  issuer: string;
  token: string;
  dpopKey: JWK;
};

/** What refreshing needs besides the refresh token. */
export type RefreshState = Omit<Session, "token"> & {
  refresh: string;
  tokenEndpoint: string;
  clientId: string;
};

export function readSession(stored: string): Session {
  const session = JSON.parse(stored) as Session;
  if (!session.did || !session.token || !session.dpopKey) throw new ReconnectRequiredError();
  return session;
}

export class XrpcError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly error?: string,
  ) {
    super(message);
    this.name = "XrpcError";
  }
}

/** An XRPC call to the account's PDS, as the account. */
export async function xrpc<T>(
  session: Session,
  nsid: string,
  options: {
    query?: Record<string, string | number | undefined>;
    json?: unknown;
    body?: ArrayBuffer;
    contentType?: string;
  } = {},
): Promise<T> {
  const url = new URL(`${session.pds}/xrpc/${nsid}`);
  for (const [key, value] of Object.entries(options.query ?? {}))
    if (value !== undefined) url.searchParams.set(key, String(value));
  const post = options.json !== undefined || options.body !== undefined;
  const { res, body } = await dpopFetch(
    session.dpopKey,
    url.toString(),
    {
      method: post ? "POST" : "GET",
      headers: {
        Accept: "application/json",
        ...(post && {
          "Content-Type": options.contentType ?? "application/json",
        }),
      },
      body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
    },
    session.token,
  );
  const data = JSON.parse(body || "{}") as T & { error?: string; message?: string };
  if (res.status === 401) throw new ReconnectRequiredError();
  if (!res.ok)
    throw new XrpcError(
      `Bluesky refused it: ${data.message ?? data.error ?? `HTTP ${res.status}`}`,
      res.status,
      data.error,
    );
  return data;
}
