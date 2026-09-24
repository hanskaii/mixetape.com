import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { decrypt, encrypt, sha256 } from "./crypto";

beforeAll(() => {
  env.CREDENTIALS_KEY = Buffer.from(new Uint8Array(32).fill(7)).toString("base64url");
});

describe("credential encryption", () => {
  it("round-trips, and never stores the plain value", async () => {
    const sealed = await encrypt("client-secret-123");
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("client-secret-123");
    expect(await decrypt(sealed)).toBe("client-secret-123");
  });

  it("uses a fresh IV each time", async () => {
    expect(await encrypt("same")).not.toBe(await encrypt("same"));
  });

  it("refuses a tampered value", async () => {
    const [version, iv, data] = (await encrypt("secret")).split(".");
    const flipped = data.slice(0, -2) + (data.at(-2) === "A" ? "B" : "A") + data.at(-1);
    await expect(decrypt([version, iv, flipped].join("."))).rejects.toThrow();
  });

  it("hashes API keys deterministically", async () => {
    expect(await sha256("mxt_abc")).toBe(await sha256("mxt_abc"));
    expect(await sha256("mxt_abc")).toHaveLength(64);
  });
});
