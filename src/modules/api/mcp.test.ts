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
}));
vi.mock("../social/platform.service", () => ({ postComment: vi.fn(), postInsights: vi.fn() }));
vi.mock("../social/analytics.service", () => ({ accountAnalytics: vi.fn() }));
vi.mock("../storage/storage.service", () => ({
  MEDIA_PREFIX: "media/",
  listAllOwnedMedia: vi.fn(),
}));
vi.mock("../storage/upload.service", () => ({
  createUpload: vi.fn(),
  publicUrl: (key: string) => `https://media.mixetape.com/${key}`,
}));
vi.mock("./api-keys.service", async () => {
  const { ServiceError } = await import("./errors");
  return {
    requireScope: (caller: { scopes: string[] }, scope: string) => {
      if (!caller.scopes.includes(scope)) throw new ServiceError(`lacks "${scope}"`, 403);
    },
  };
});

import * as platform from "../social/platform.service";
import * as social from "../social/social.service";
import * as uploads from "../storage/upload.service";
import * as storage from "../storage/storage.service";
import { ServiceError } from "./errors";
import type { Caller } from "./api-keys.service";
import { handleMessage } from "./mcp";

const everything: Caller = {
  userId: "user-1",
  scopes: ["read", "publish", "manage", "comments", "analytics", "storage", "channels"],
};
const publisher: Caller = { userId: "user-1", scopes: ["read", "publish"] };

const call = (name: string, args: Record<string, unknown> = {}, caller = everything) =>
  handleMessage(caller, {
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name, arguments: args },
  });

const toolNames = async (caller: Caller) => {
  const list = (await handleMessage(caller, { jsonrpc: "2.0", id: 2, method: "tools/list" })) as {
    result: { tools: { name: string }[] };
  };
  return list.result.tools.map((tool) => tool.name);
};

describe("mixetape MCP", () => {
  beforeEach(() => vi.clearAllMocks());

  it("introduces itself and lists every tool to a key that may use them all", async () => {
    const init = await handleMessage(everything, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18" },
    });
    expect(init).toMatchObject({
      result: { serverInfo: { name: "mixetape" }, capabilities: { tools: {} } },
    });

    expect(await toolNames(everything)).toEqual([
      "list_accounts",
      "list_posts",
      "get_post",
      "get_post_insights",
      "list_collections",
      "list_captions",
      "create_post",
      "update_post",
      "cancel_post",
      "retry_post",
      "set_thumbnail",
      "edit_published_post",
      "create_collection",
      "add_to_collection",
      "upload_caption",
      "list_comments",
      "post_comment",
      "reply_to_comment",
      "moderate_comment",
      "connect_channel",
      "get_connection",
      "choose_channels",
      "get_post_analytics",
      "get_account_analytics",
      "create_upload",
      "import_file",
      "list_files",
      "delete_file",
    ]);
  });

  it("shows a key only the tools its permissions allow", async () => {
    const names = await toolNames(publisher);
    expect(names).toContain("create_post");
    expect(names).not.toContain("post_comment");
    expect(names).not.toContain("get_account_analytics");
    expect(names).not.toContain("create_upload");
  });

  it("starts a storage upload for a key with the storage permission", async () => {
    vi.mocked(uploads.createUpload).mockResolvedValue({ url: "r2://media/u/ep.mp4" } as never);
    const reply = (await call("create_upload", {
      fileName: "ep.mp4",
      contentType: "video/mp4",
    })) as {
      result: { content: { text: string }[] };
    };
    expect(uploads.createUpload).toHaveBeenCalledWith("user-1", {
      fileName: "ep.mp4",
      contentType: "video/mp4",
      size: undefined,
    });
    expect(JSON.parse(reply.result.content[0].text)).toEqual({ url: "r2://media/u/ep.mp4" });
  });

  it("refuses a tool the key has no permission for, as a tool error", async () => {
    const reply = (await call("post_comment", { id: "p1", text: "hi" }, publisher)) as {
      result: { content: { text: string }[]; isError: boolean };
    };
    expect(reply.result.isError).toBe(true);
    expect(reply.result.content[0].text).toContain('"comments"');
    expect(platform.postComment).not.toHaveBeenCalled();
  });

  it("answers notifications with nothing", async () => {
    expect(
      await handleMessage(everything, { jsonrpc: "2.0", method: "notifications/initialized" }),
    ).toBeNull();
  });

  it("runs a tool as the key's owner and returns its result as text", async () => {
    vi.mocked(social.editPost).mockResolvedValue({ id: "p1", status: "scheduled" } as never);
    const reply = (await call("update_post", {
      id: "p1",
      scheduledAt: "2026-10-01T17:00:00+07:00",
    })) as { result: { content: { text: string }[]; isError?: boolean } };

    expect(social.editPost).toHaveBeenCalledWith("user-1", "p1", {
      scheduledAt: "2026-10-01T17:00:00+07:00",
    });
    expect(JSON.parse(reply.result.content[0].text)).toEqual({ id: "p1", status: "scheduled" });
    expect(reply.result.isError).toBeUndefined();
  });

  it("checks argument types before calling a service", async () => {
    const reply = (await call("get_post", { id: 42 })) as {
      result: { content: { text: string }[]; isError: boolean };
    };
    expect(reply.result).toEqual({
      content: [{ type: "text", text: "id must be text" }],
      isError: true,
    });
    expect(social.getPost).not.toHaveBeenCalled();
  });

  it("reports a refused action as a tool error, not a protocol error", async () => {
    vi.mocked(social.cancelPost).mockRejectedValue(
      new ServiceError("A published post cannot be cancelled", 409),
    );
    const reply = (await call("cancel_post", { id: "p1" })) as { result: unknown };
    expect(reply.result).toEqual({
      content: [{ type: "text", text: "A published post cannot be cancelled" }],
      isError: true,
    });
  });

  it("rejects unknown tools and methods", async () => {
    expect(await call("delete_everything")).toMatchObject({ error: { code: -32602 } });
    expect(
      await handleMessage(everything, { jsonrpc: "2.0", id: 3, method: "resources/list" }),
    ).toMatchObject({ error: { code: -32601 } });
  });
});

describe("connecting channels over MCP", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hands the agent a sign-in link, marked as started by an agent", async () => {
    vi.mocked(social.beginConnect).mockResolvedValue({
      url: "https://www.facebook.com/v25.0/dialog/oauth?state=s1",
      state: "s1",
      expiresAt: "2026-09-28T10:10:00.000Z",
    });
    const response = (await call("connect_channel", { platform: "facebook" })) as {
      result: { content: { text: string }[] };
    };
    expect(social.beginConnect).toHaveBeenCalledWith("user-1", "facebook", "agent");
    expect(JSON.parse(response.result.content[0].text)).toEqual({
      url: "https://www.facebook.com/v25.0/dialog/oauth?state=s1",
      state: "s1",
      expiresAt: "2026-09-28T10:10:00.000Z",
    });
  });

  it("adds only the channels the user chose", async () => {
    vi.mocked(social.chooseChannels).mockResolvedValue({ channels: ["Ruang Work"] });
    await call("choose_channels", { state: "s1", platformAccountIds: ["page-2"] });
    expect(social.chooseChannels).toHaveBeenCalledWith("user-1", "s1", ["page-2"]);

    const empty = (await call("choose_channels", { state: "s1", platformAccountIds: [] })) as {
      result: { isError?: boolean; content: { text: string }[] };
    };
    expect(empty.result.isError).toBe(true);
    expect(empty.result.content[0].text).toBe("Choose at least one channel");
  });

  it("keeps connecting to keys with the channels permission", async () => {
    expect(await toolNames(publisher)).not.toContain("connect_channel");
    const refused = (await call("connect_channel", { platform: "youtube" }, publisher)) as {
      result: { isError?: boolean };
    };
    expect(refused.result.isError).toBe(true);
    expect(social.beginConnect).not.toHaveBeenCalled();
  });
});

describe("narrowing and paging lists", () => {
  beforeEach(() => vi.clearAllMocks());

  const result = (response: unknown) =>
    JSON.parse((response as { result: { content: { text: string }[] } }).result.content[0].text);

  it("passes list_posts' filters and cursor through", async () => {
    vi.mocked(social.listPosts).mockResolvedValue({ posts: [], nextCursor: null });
    await call("list_posts", {
      accountId: ["acc-1", "acc-2"],
      provider: ["youtube"],
      search: "pompeii",
      cursor: "abc",
      limit: 20,
    });
    expect(social.listPosts).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        accountId: ["acc-1", "acc-2"],
        provider: ["youtube"],
        search: "pompeii",
        cursor: "abc",
        limit: 20,
      }),
    );
  });

  it("lists files newest first, by name, a page at a time", async () => {
    const file = (name: string, at: number) => ({
      key: `media/user-1/${at}-${name}`,
      size: 10,
      uploaded: new Date(at),
    });
    vi.mocked(storage.listAllOwnedMedia).mockResolvedValue([
      file("old-episode.mp4", 1000),
      file("new-episode.mp4", 3000),
      file("cover.jpg", 2000),
      file("mid-episode.mp4", 2500),
    ]);

    const first = result(await call("list_files", { search: "EPISODE", limit: 2 }));
    expect(first.files.map((f: { name: string }) => f.name)).toEqual([
      "new-episode.mp4",
      "mid-episode.mp4",
    ]);
    expect(first.nextCursor).toEqual(expect.any(String));

    const second = result(
      await call("list_files", { search: "episode", limit: 2, cursor: first.nextCursor }),
    );
    expect(second.files.map((f: { name: string }) => f.name)).toEqual(["old-episode.mp4"]);
    expect(second.nextCursor).toBeNull();
  });

  it("refuses a cursor it did not give out", async () => {
    vi.mocked(storage.listAllOwnedMedia).mockResolvedValue([]);
    const response = await call("list_files", { cursor: "not-a-cursor" });
    expect((response as { result: { isError?: boolean } }).result.isError).toBe(true);
  });
});
