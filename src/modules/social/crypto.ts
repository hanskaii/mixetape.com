import { env } from "cloudflare:workers";

/**
 * Encryption for everything that would let someone post as the user: OAuth client
 * secrets, access tokens and refresh tokens. AES-GCM with a key held only in the
 * CREDENTIALS_KEY secret, so a copy of the database alone is useless.
 *
 * Stored form: `v1.<iv base64url>.<ciphertext base64url>`.
 */

const VERSION = "v1";

let cachedKey: Promise<CryptoKey> | undefined;

function key(): Promise<CryptoKey> {
  cachedKey ??= (async () => {
    const secret = env.CREDENTIALS_KEY;
    if (!secret) throw new Error("CREDENTIALS_KEY is not configured");
    const raw = base64urlDecode(secret);
    if (raw.byteLength !== 32)
      throw new Error("CREDENTIALS_KEY must be 32 bytes, base64url-encoded");
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  })();
  return cachedKey;
}

export async function encrypt(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(),
    new TextEncoder().encode(plain),
  );
  return `${VERSION}.${base64urlEncode(iv)}.${base64urlEncode(new Uint8Array(data))}`;
}

export async function decrypt(sealed: string): Promise<string> {
  const [version, iv, data] = sealed.split(".");
  if (version !== VERSION || !iv || !data) throw new Error("Unrecognised encrypted value");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64urlDecode(iv) },
    await key(),
    base64urlDecode(data),
  );
  return new TextDecoder().decode(plain);
}

/** SHA-256 hex, for API keys: only the hash is stored, never the key. */
export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  return base64urlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(text: string): Uint8Array<ArrayBuffer> {
  const padded = text
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(text.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
