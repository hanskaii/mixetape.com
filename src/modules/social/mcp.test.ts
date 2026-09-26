import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./social.service", () => {
  class ServiceError extends Error {
    constructor(
      message: string,
      readonly status = 400,
    ) {
      super(message);
    }
  }
  return {
    ServiceError,
    listAccounts: vi.fn(),
    listPosts: vi.fn(),
    getPost: vi.fn(),
    postInsights: vi.fn(),
    createPost: vi.fn(),
    editPost: vi.fn(),
    cancelPost: vi.fn(),
    retryPost: vi.fn(),
  };
});

import * as social from "./social.service";
import { handleMessage } from "./mcp";

const call = (name: string, args: Record<string, unknown> = {}) =>
  handleMessage("user-1", {
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name, arguments: args },
  });

describe("mixetape MCP", () => {
  beforeEach(() => vi.clearAllMocks());

  it("introduces itself and lists its tools", async () => {
    const init = await handleMessage("user-1", {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18" },
    });
    expect(init).toMatchObject({
      result: { serverInfo: { name: "mixetape" }, capabilities: { tools: {} } },
    });

    const list = (await handleMessage("user-1", {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    })) as any;
    expect(list.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
      "list_accounts",
      "list_posts",
      "get_post",
      "get_post_insights",
      "create_post",
      "update_post",
      "cancel_post",
      "set_thumbnail",
      "retry_post",
    ]);
  });

  it("answers notifications with nothing", async () => {
    expect(
      await handleMessage("user-1", { jsonrpc: "2.0", method: "notifications/initialized" }),
    ).toBeNull();
  });

  it("runs a tool as the key's owner and returns its result as text", async () => {
    vi.mocked(social.editPost).mockResolvedValue({ id: "p1", status: "scheduled" } as any);
    const reply = (await call("update_post", {
      id: "p1",
      scheduledAt: "2026-10-01T17:00:00+07:00",
    })) as any;

    expect(social.editPost).toHaveBeenCalledWith("user-1", "p1", {
      scheduledAt: "2026-10-01T17:00:00+07:00",
    });
    expect(JSON.parse(reply.result.content[0].text)).toEqual({ id: "p1", status: "scheduled" });
    expect(reply.result.isError).toBeUndefined();
  });

  it("reports a refused action as a tool error, not a protocol error", async () => {
    vi.mocked(social.cancelPost).mockRejectedValue(
      new social.ServiceError("A published post cannot be cancelled", 409),
    );
    const reply = (await call("cancel_post", { id: "p1" })) as any;
    expect(reply.result).toEqual({
      content: [{ type: "text", text: "A published post cannot be cancelled" }],
      isError: true,
    });
  });

  it("rejects unknown tools and methods", async () => {
    expect(await call("delete_everything")).toMatchObject({ error: { code: -32602 } });
    expect(
      await handleMessage("user-1", { jsonrpc: "2.0", id: 3, method: "resources/list" }),
    ).toMatchObject({
      error: { code: -32601 },
    });
  });
});
