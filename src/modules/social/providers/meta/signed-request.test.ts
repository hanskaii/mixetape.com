import { describe, expect, it } from "vitest";
import { verifySignedRequest } from "./signed-request";

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** A signed_request as Meta makes it: HMAC-SHA256 of the encoded payload. */
async function sign(payload: object, secret: string) {
  const encoded = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded)),
  );
  return `${base64url(signature)}.${encoded}`;
}

describe("Meta's signed_request", () => {
  it("names the person when the app secret signed it", async () => {
    const request = await sign(
      { algorithm: "HMAC-SHA256", user_id: 1234567, issued_at: 1 },
      "s3cret",
    );
    expect(await verifySignedRequest(request, "s3cret")).toMatchObject({ user_id: "1234567" });
  });

  it("refuses another secret, a changed payload, and nonsense", async () => {
    const request = await sign({ algorithm: "HMAC-SHA256", user_id: "42" }, "s3cret");
    expect(await verifySignedRequest(request, "other")).toBeNull();
    const [signature] = request.split(".");
    const forged = base64url(
      new TextEncoder().encode(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "99" })),
    );
    expect(await verifySignedRequest(`${signature}.${forged}`, "s3cret")).toBeNull();
    expect(await verifySignedRequest("not-a-request", "s3cret")).toBeNull();
    expect(await verifySignedRequest("a.b", "s3cret")).toBeNull();
  });

  it("refuses another algorithm or a missing user", async () => {
    expect(
      await verifySignedRequest(await sign({ algorithm: "none", user_id: "1" }, "k"), "k"),
    ).toBeNull();
    expect(
      await verifySignedRequest(await sign({ algorithm: "HMAC-SHA256" }, "k"), "k"),
    ).toBeNull();
  });
});
