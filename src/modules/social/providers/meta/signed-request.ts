/**
 * Meta's signed_request: `<signature>.<payload>`, both base64url; the signature is the
 * payload's HMAC-SHA256 under the app secret. Facebook, Instagram and Threads send one to
 * an app's deauthorize and data-deletion callbacks, naming the person in `user_id`.
 */

export type SignedRequest = { user_id: string; algorithm: string; issued_at?: number };

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

/** The payload, when the signature is the app secret's; null for anything else. */
export async function verifySignedRequest(
  signedRequest: string,
  appSecret: string,
): Promise<SignedRequest | null> {
  const [signature, payload] = signedRequest.split(".");
  if (!signature || !payload) return null;
  let expected: Uint8Array<ArrayBuffer>;
  let data: SignedRequest;
  try {
    expected = fromBase64Url(signature);
    data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
  } catch {
    return null;
  }
  if (data.algorithm?.toUpperCase() !== "HMAC-SHA256" || !data.user_id) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  // subtle.verify compares in constant time.
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    expected,
    new TextEncoder().encode(payload),
  );
  return valid ? { ...data, user_id: String(data.user_id) } : null;
}
