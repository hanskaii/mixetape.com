import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../social/social.service", () => ({
  listAccounts: vi.fn(),
  listPosts: vi.fn(),
  getPost: vi.fn(),
  createPost: vi.fn(),
  editPost: vi.fn(),
  cancelPost: vi.fn(),
  retryPost: vi.fn(),
  beginConnect: vi.fn(),
  connectResult: vi.fn(),
  chooseChannels: vi.fn(),
  disconnectAccount: vi.fn(),
  postView: ({ userId: _u, workflowId: _w, ...post }: Record<string, unknown>) => post,
  accountView: (account: unknown) => account,
}));
vi.mock("../social/platform.service", () => ({ postInsights: vi.fn(), moderateComment: vi.fn() }));
vi.mock("../social/analytics.service", () => ({ accountAnalytics: vi.fn() }));
vi.mock("../social/brands.service", () => ({ listBrands: vi.fn() }));
vi.mock("../storage/files.service", () => ({ createFileUpload: vi.fn(), getFile: vi.fn() }));
vi.mock("../library/groups.service", () => ({ deleteGroup: vi.fn() }));
vi.mock("../library/publish.service", () => ({
  planPost: vi.fn(),
  publishPost: vi.fn(),
  groupSource: vi.fn(),
  filesSource: vi.fn(),
}));
vi.mock("./rate-limit", () => ({ countCall: vi.fn(), RETRY_AFTER_SECONDS: 60 }));
// The idempotency store without D1: same contract, kept in memory.
vi.mock("./idempotency.service", async () => {
  const { ServiceError } = await import("./errors");
  const kept = new Map<string, { fingerprint: string; status: number; body: unknown }>();
  return {
    once: async (
      _userId: string,
      key: string | undefined,
      request: unknown,
      run: () => Promise<{ status: number; body: unknown }>,
    ) => {
      if (key === undefined) return { ...(await run()), replayed: false };
      const fingerprint = JSON.stringify(request);
      const earlier = kept.get(key);
      if (earlier && earlier.fingerprint !== fingerprint)
        throw new ServiceError("used before", 422, { code: "idempotency_key_reused" });
      if (earlier) return { status: earlier.status, body: earlier.body, replayed: true };
      const answer = await run();
      kept.set(key, { fingerprint, ...answer });
      return { ...answer, replayed: false };
    },
  };
});
vi.mock("./http", () => ({ requireCaller: vi.fn() }));
vi.mock("./api-keys.service", async () => {
  const { ServiceError } = await import("./errors");
  return {
    API_SCOPES: { read: "", publish: "" },
    requireScope: (caller: { scopes: string[] }, scope: string) => {
      if (!caller.scopes.includes(scope)) throw new ServiceError(`lacks "${scope}"`, 403);
    },
  };
});

import * as social from "../social/social.service";
import * as platform from "../social/platform.service";
import * as analytics from "../social/analytics.service";
import * as files from "../storage/files.service";
import * as groups from "../library/groups.service";
import * as publishing from "../library/publish.service";
import { ENDPOINTS } from "./endpoints";
import { ServiceError } from "./errors";
import { requireCaller } from "./http";
import { countCall } from "./rate-limit";
import { openApiDocument } from "./openapi";
import { fromQuery, handle, match } from "./rest";
import { TOOLS } from "./tools";

const everything = {
  userId: "user-1",
  scopes: ["read", "publish", "manage", "comments", "analytics", "storage", "channels", "library"],
};

const request = (method: string, path: string, body?: unknown, headers?: HeadersInit) =>
  handle(
    new Request(`https://mixetape.com/api/v1${path}`, {
      method,
      headers,
      ...(body !== undefined && { body: typeof body === "string" ? body : JSON.stringify(body) }),
    }),
    ENDPOINTS,
  );

describe("REST routing", () => {
  it("prefers a literal path to a {param}", () => {
    const found = match(ENDPOINTS, "POST", "/files/uploads");
    expect(found && "endpoint" in found && found.endpoint.operationId).toBe("createUpload");
    expect(match(ENDPOINTS, "GET", "/files/uploads")).toEqual({ allowed: ["POST"] });
  });

  it("reads path params, decoded", () => {
    const found = match(ENDPOINTS, "PATCH", "/posts/p%201/comments/c9");
    expect(found).toMatchObject({
      endpoint: { operationId: "moderateComment" },
      params: { id: "p 1", commentId: "c9" },
    });
  });

  it("answers 404 for no endpoint and 405 with Allow for a wrong method", async () => {
    vi.mocked(requireCaller).mockResolvedValue(everything as never);
    expect((await request("GET", "/nothing")).status).toBe(404);
    const wrong = await request("PUT", "/posts");
    expect(wrong.status).toBe(405);
    expect(wrong.headers.get("Allow")).toBe("GET, POST");
  });

  it("reads query parameters as their declared types", () => {
    const query = new URLSearchParams("status=scheduled,failed&limit=20&held=true&from=x&other=1");
    expect(
      fromQuery(query, {
        status: { type: "array" },
        limit: { type: "integer" },
        held: { type: "boolean" },
        from: { type: "string" },
      }),
    ).toEqual({ status: ["scheduled", "failed"], limit: 20, held: true, from: "x" });
    expect(fromQuery(new URLSearchParams("limit=lots"), { limit: { type: "integer" } })).toEqual({
      limit: "lots",
    });
  });
});

describe("REST endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireCaller).mockResolvedValue(everything as never);
  });

  it("lists posts the way the image worker asks for them", async () => {
    vi.mocked(social.listPosts).mockResolvedValue({
      posts: [{ id: "p1", userId: "user-1", workflowId: "w" }],
      nextCursor: null,
    } as never);
    const response = await request(
      "GET",
      "/posts?from=2026-10-01T00:00:00Z&limit=50&status=scheduled",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ posts: [{ id: "p1" }], nextCursor: null });
    expect(social.listPosts).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        from: new Date("2026-10-01T00:00:00Z"),
        limit: 50,
        status: ["scheduled"],
      }),
    );
  });

  it("schedules a post: 201 with the post", async () => {
    vi.mocked(social.createPost).mockResolvedValue({ id: "p2", userId: "user-1" } as never);
    const response = await request("POST", "/posts", {
      accountId: "a1",
      mediaUrl: "r2://v.mp4",
      metadata: { title: "Ep" },
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ post: { id: "p2" } });
    expect(social.createPost).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        accountId: "a1",
        mediaUrl: "r2://v.mp4",
        metadata: { title: "Ep" },
      }),
    );
  });

  it("takes the id from the path, not the body", async () => {
    vi.mocked(social.editPost).mockResolvedValue({ id: "p1" } as never);
    await request("PATCH", "/posts/p1", { id: "other", caption: "New" });
    expect(social.editPost).toHaveBeenCalledWith("user-1", "p1", { caption: "New" });
  });

  it("refuses a body that is not a JSON object", async () => {
    const response = await request("POST", "/posts", "[1]");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "invalid_request", message: "The body must be a JSON object" },
    });
  });

  it("checks argument types before calling a service", async () => {
    const response = await request("POST", "/posts", { accountId: 7 });
    expect(await response.json()).toEqual({
      error: { code: "invalid_field", message: "accountId must be text", field: "accountId" },
    });
    expect(social.createPost).not.toHaveBeenCalled();
  });

  it("needs a key, and the endpoint's permission", async () => {
    vi.mocked(requireCaller).mockRejectedValue(new ServiceError("Unauthorized", 401));
    expect((await request("GET", "/accounts")).status).toBe(401);

    vi.mocked(requireCaller).mockResolvedValue({ userId: "user-1", scopes: ["read"] } as never);
    const response = await request("POST", "/posts", { accountId: "a1" });
    expect(response.status).toBe(403);
    expect(social.createPost).not.toHaveBeenCalled();
  });

  it("passes a service's refusal through with its status and code", async () => {
    vi.mocked(social.cancelPost).mockRejectedValue(
      new ServiceError("Already published", 409, { code: "invalid_post_state" }),
    );
    const response = await request("POST", "/posts/p1/cancel");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "invalid_post_state", message: "Already published" },
    });
  });

  it("still cancels on the old DELETE /posts/{id}", async () => {
    vi.mocked(social.cancelPost).mockResolvedValue({ id: "p1", status: "cancelled" } as never);
    const response = await request("DELETE", "/posts/p1");
    expect(response.status).toBe(200);
    expect(social.cancelPost).toHaveBeenCalledWith("user-1", "p1");
  });

  it("refuses a field the endpoint does not take, naming it", async () => {
    const response = await request("POST", "/posts", { accountId: "a1", schedueldAt: "x" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "unknown_field", field: "schedueldAt" },
    });
    expect(social.createPost).not.toHaveBeenCalled();
  });

  it("runs a write once per Idempotency-Key and replays the answer", async () => {
    vi.mocked(social.createPost).mockResolvedValue({ id: "p9", userId: "user-1" } as never);
    const body = { accountId: "a1", mediaUrl: "r2://v.mp4" };
    const key = { "Idempotency-Key": "k-1" };
    const first = await request("POST", "/posts", body, key);
    const again = await request("POST", "/posts", body, key);
    expect(first.status).toBe(201);
    expect(again.status).toBe(201);
    expect(again.headers.get("Idempotent-Replayed")).toBe("true");
    expect(await again.json()).toEqual({ post: { id: "p9" } });
    expect(social.createPost).toHaveBeenCalledTimes(1);

    const other = await request("POST", "/posts", { ...body, caption: "x" }, key);
    expect(other.status).toBe(422);
    expect(await other.json()).toMatchObject({ error: { code: "idempotency_key_reused" } });
  });

  it("answers 429 with Retry-After over the allowance", async () => {
    vi.mocked(countCall).mockRejectedValueOnce(
      new ServiceError("Too many requests", 429, { code: "rate_limited" }),
    );
    const response = await request("GET", "/accounts");
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toMatchObject({ error: { code: "rate_limited" } });
  });

  it("disconnects an account", async () => {
    vi.mocked(social.disconnectAccount).mockResolvedValue({ deleted: true, id: "a1" } as never);
    const response = await request("DELETE", "/accounts/a1");
    expect(await response.json()).toEqual({ deleted: true, id: "a1" });
    expect(social.disconnectAccount).toHaveBeenCalledWith("user-1", "a1");
  });

  it("lists posts changed since a time", async () => {
    vi.mocked(social.listPosts).mockResolvedValue({ posts: [], nextCursor: null } as never);
    await request("GET", "/posts?updatedSince=2026-10-02T08:00:00%2B07:00");
    expect(social.listPosts).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ updatedSince: new Date("2026-10-02T01:00:00Z") }),
    );
  });

  it("plans and publishes files that are not in a group", async () => {
    vi.mocked(publishing.filesSource).mockResolvedValue({ files: [{ id: "f1" }] } as never);
    vi.mocked(publishing.planPost).mockResolvedValue({ channels: [] } as never);
    await request("POST", "/files/plan", { fileIds: ["f1"], caption: "Hi", brandIds: ["b1"] });
    expect(publishing.filesSource).toHaveBeenCalledWith("user-1", ["f1"], {
      title: undefined,
      caption: "Hi",
      description: undefined,
      metadata: undefined,
    });
    expect(publishing.planPost).toHaveBeenCalledWith(
      "user-1",
      { files: [{ id: "f1" }] },
      { brandIds: ["b1"], accountIds: undefined },
    );
    vi.mocked(publishing.publishPost).mockResolvedValue({ scheduled: [] } as never);
    const published = await request("POST", "/files/publish", {
      fileIds: ["f1"],
      accountIds: ["a1"],
      scheduledAt: "2026-10-03T10:00:00+07:00",
    });
    expect(published.status).toBe(201);
  });

  it("answers a post as the platform has it", async () => {
    vi.mocked(platform.postInsights).mockResolvedValue({
      post: { id: "p1", userId: "user-1" },
      platform: { visibility: "public" },
    } as never);
    expect(await (await request("GET", "/posts/p1/platform")).json()).toEqual({
      post: { id: "p1" },
      platform: { visibility: "public" },
    });
  });

  it("moderates a comment by its path", async () => {
    vi.mocked(platform.moderateComment).mockResolvedValue({ commentId: "c1" } as never);
    await request("PATCH", "/posts/p1/comments/c1", { status: "rejected", banAuthor: true });
    expect(platform.moderateComment).toHaveBeenCalledWith("user-1", "p1", "c1", "rejected", true);
  });

  it("reads an account's analytics over a range", async () => {
    vi.mocked(analytics.accountAnalytics).mockResolvedValue({} as never);
    await request("GET", "/accounts/a1/analytics?from=2026-09-01&to=2026-09-30");
    expect(analytics.accountAnalytics).toHaveBeenCalledWith("user-1", "a1", {
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("starts an upload and gets a file", async () => {
    vi.mocked(files.createFileUpload).mockResolvedValue({ fileId: "f1" } as never);
    const started = await request("POST", "/files/uploads", { fileName: "a.mp4", size: 10 });
    expect(started.status).toBe(201);
    expect(files.createFileUpload).toHaveBeenCalledWith("user-1", {
      fileName: "a.mp4",
      contentType: undefined,
      size: 10,
      groupId: undefined,
    });
    vi.mocked(files.getFile).mockResolvedValue({ id: "f1" } as never);
    expect(await (await request("GET", "/files/f1")).json()).toEqual({ file: { id: "f1" } });
  });

  it("plans a group for brands and accounts from the query", async () => {
    vi.mocked(publishing.groupSource).mockResolvedValue({ files: [] } as never);
    vi.mocked(publishing.planPost).mockResolvedValue({ channels: [] } as never);
    await request("GET", "/groups/g1/plan?brandIds=b1,b2&accountIds=a1");
    expect(publishing.planPost).toHaveBeenCalledWith(
      "user-1",
      { files: [] },
      {
        brandIds: ["b1", "b2"],
        accountIds: ["a1"],
      },
    );
  });

  it("deletes a group's files only when asked", async () => {
    vi.mocked(groups.deleteGroup).mockResolvedValue({ deleted: true, id: "g1" } as never);
    await request("DELETE", "/groups/g1?deleteFiles=true");
    expect(groups.deleteGroup).toHaveBeenCalledWith("user-1", "g1", { deleteFiles: true });
  });
});

describe("the OpenAPI document", () => {
  const document = openApiDocument("https://mixetape.com");
  const operations = Object.entries(document.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, operation]) => ({
      path,
      method,
      ...(operation as {
        operationId: string;
        tags: string[];
        description: string;
        parameters?: { in: string; description?: string }[];
        responses: Record<string, unknown>;
      }),
    })),
  );

  it("describes every endpoint once, and nothing else", () => {
    expect(operations).toHaveLength(ENDPOINTS.length);
    const ids = operations.map((operation) => operation.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(operations.every((operation) => operation.path.startsWith("/api/v1/"))).toBe(true);
    expect(operations.some((operation) => operation.path.includes("/tools"))).toBe(false);
  });

  it("files every endpoint under a known section, with its path params described", () => {
    const sections = document.tags.map((tag) => tag.name);
    for (const operation of operations) {
      expect(sections).toContain(operation.tags[0]);
      for (const param of operation.parameters?.filter((p) => p.in === "path") ?? [])
        expect(param.description, `${operation.operationId} path param`).toBeTruthy();
      expect(Object.keys(operation.responses).some((status) => status.startsWith("2"))).toBe(true);
    }
  });

  it("offers Idempotency-Key on the writes that must not happen twice", () => {
    const keyed = operations
      .filter((operation) =>
        operation.parameters?.some((p) => (p as { name?: string }).name === "Idempotency-Key"),
      )
      .map((operation) => operation.operationId)
      .sort();
    expect(keyed).toEqual(["createPost", "importFile", "publishFiles", "publishGroup"]);
  });

  it("describes errors by code, rate limits and the deprecated cancel path", () => {
    const error = document.components.schemas.Error.properties.error;
    expect(error.required).toEqual(["code", "message"]);
    expect(error.properties.code.enum).toContain("unknown_field");
    expect(operations.find((o) => o.operationId === "createPost")?.responses).toHaveProperty("429");
    expect(operations.find((o) => o.operationId === "deletePost")).toMatchObject({
      deprecated: true,
    });
  });

  it("speaks REST, not MCP tool names", () => {
    const tools = TOOLS.map((tool) => tool.name);
    for (const operation of operations)
      for (const tool of tools)
        expect(operation.description, operation.operationId).not.toMatch(
          new RegExp(`\\b${tool}\\b`),
        );
  });
});
