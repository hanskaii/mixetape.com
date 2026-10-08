import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:workers";

vi.mock("#/modules/secrets/secrets.service", () => ({ secret: async () => "turnstile-secret" }));

import { codeRequestRefusal, isQaInbox, verifyTurnstile } from "./sign-in-guard";

const kv = new Map<string, string>();

beforeEach(() => {
  kv.clear();
  Object.assign(env, {
    TURNSTILE_HOSTNAMES: "mixetape.com,www.mixetape.com",
    KIT_CACHE: {
      get: async (key: string) => kv.get(key) ?? null,
      put: async (key: string, value: string) => void kv.set(key, value),
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

function siteverifyAnswers(result: Record<string, unknown>, ok = true) {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify(result), { status: ok ? 200 : 500 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Turnstile check", () => {
  it("accepts a token for the sign-in action from our own hostname", async () => {
    const fetchMock = siteverifyAnswers({
      success: true,
      action: "sign-in",
      hostname: "mixetape.com",
    });
    expect(await verifyTurnstile("token", "1.2.3.4", "sign-in")).toBe(true);
    const body = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
      .body as URLSearchParams;
    expect(body.get("secret")).toBe("turnstile-secret");
    expect(body.get("remoteip")).toBe("1.2.3.4");
  });

  it.each([
    ["a failed check", { success: false, action: "sign-in", hostname: "mixetape.com" }],
    ["another action", { success: true, action: "checkout", hostname: "mixetape.com" }],
    ["another site", { success: true, action: "sign-in", hostname: "evil.example" }],
    ["a local token in production", { success: true, action: "sign-in", hostname: "localhost" }],
  ])("refuses %s", async (_name, result) => {
    siteverifyAnswers(result);
    expect(await verifyTurnstile("token", "", "sign-in")).toBe(false);
  });

  it("refuses without a token, and when siteverify cannot be reached", async () => {
    siteverifyAnswers({ success: true, action: "sign-in", hostname: "mixetape.com" }, false);
    expect(await verifyTurnstile(undefined, "", "sign-in")).toBe(false);
    expect(await verifyTurnstile("token", "", "sign-in")).toBe(false);
  });
});

describe("sign-in code limits", () => {
  it("allows one code a minute per address", async () => {
    expect(await codeRequestRefusal("a@example.com", "1.1.1.1")).toBeNull();
    expect(await codeRequestRefusal("a@example.com", "1.1.1.1")).toMatch(/Wait a minute/);
  });

  it("caps codes per address per hour", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await codeRequestRefusal("b@example.com", `2.2.2.${i}`)).toBeNull();
      kv.delete("signin:recent:b@example.com");
    }
    expect(await codeRequestRefusal("b@example.com", "2.2.2.9")).toMatch(/Too many codes/);
  });

  it("caps requests per network per hour", async () => {
    for (let i = 0; i < 20; i++)
      expect(await codeRequestRefusal(`u${i}@example.com`, "3.3.3.3")).toBeNull();
    expect(await codeRequestRefusal("u99@example.com", "3.3.3.3")).toMatch(/this network/);
  });

  it("knows mixetape's own test inboxes", () => {
    expect(isQaInbox("qa-1@mixetape.com")).toBe(true);
    expect(isQaInbox("qa-billing@mixetape.com")).toBe(true);
    expect(isQaInbox("qa-1@mixetape.com.evil.example")).toBe(false);
    expect(isQaInbox("someone@mixetape.com")).toBe(false);
  });
});
