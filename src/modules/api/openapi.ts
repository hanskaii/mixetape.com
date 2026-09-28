import { API_SCOPES, type ApiScope } from "./api-keys.service";
import { TOOLS, findTool } from "./tools";

/**
 * The public API as an OpenAPI 3.1 document, built from the same tool registry MCP and
 * REST serve — so it cannot drift from the code. Served at /api/v1/openapi.json; the docs
 * site (docs/) copies it for its API reference.
 */

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: unknown) => ({ "application/json": { schema } });
const ok = (description: string, schema: unknown) => ({ description, content: json(schema) });
const ERRORS = {
  "400": { $ref: "#/components/responses/BadRequest" },
  "401": { $ref: "#/components/responses/Unauthorized" },
  "403": { $ref: "#/components/responses/Forbidden" },
};
const postBody = { type: "object", properties: { post: ref("Post") }, required: ["post"] };
const withId = { name: "id", in: "path", required: true, schema: { type: "string" } };

/** A tool's input schema without some fields, e.g. `id`, which REST takes in the path. */
function inputWithout(tool: string, ...fields: string[]) {
  const schema = findTool(tool)?.inputSchema as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  const properties = Object.fromEntries(
    Object.entries(schema?.properties ?? {}).filter(([key]) => !fields.includes(key)),
  );
  const required = (schema?.required ?? []).filter((key) => !fields.includes(key));
  return { type: "object", properties, ...(required.length && { required }) };
}

const permission = (scope: ApiScope) => `Needs the **${scope}** permission.`;

export function openApiDocument(serverUrl: string) {
  const toolPaths = Object.fromEntries(
    TOOLS.map((tool) => [
      `/api/v1/tools/${tool.name}`,
      {
        post: {
          operationId: tool.name,
          summary: tool.name,
          description: `${tool.description} ${permission(tool.scope)} Also available as the MCP tool \`${tool.name}\`.`,
          tags: [tool.scope],
          "x-permission": tool.scope,
          requestBody: { required: true, content: json(tool.inputSchema) },
          responses: {
            "200": ok("The tool's result.", {
              type: "object",
              properties: { result: { description: "What the tool returns" } },
              required: ["result"],
            }),
            ...ERRORS,
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
    ]),
  );

  return {
    openapi: "3.1.0",
    info: {
      title: "mixetape API",
      version: "1.0.0",
      summary: "Schedule and manage posts on connected social channels.",
      description:
        "Schedule and manage posts on connected social channels — the same actions agents use over MCP.",
    },
    servers: [{ url: serverUrl }],
    security: [{ apiKey: [] }],
    tags: [
      {
        name: "Accounts and posts",
        description: "The plain REST resources; every tool below covers the rest.",
      },
      ...Object.entries(API_SCOPES).map(([name, description]) => ({
        name,
        description: `Tools under the **${name}** permission: ${description.toLowerCase()}.`,
      })),
    ],
    paths: {
      "/api/v1/accounts": {
        get: {
          operationId: "listAccountsRest",
          summary: "List connected channels",
          description: `The channels this key can post to, with what each platform supports. ${permission("read")}`,
          tags: ["Accounts and posts"],
          responses: {
            "200": ok("The connected channels.", {
              type: "object",
              properties: { accounts: { type: "array", items: ref("Account") } },
              required: ["accounts"],
            }),
            ...ERRORS,
          },
        },
      },
      "/api/v1/posts": {
        get: {
          operationId: "listPostsRest",
          summary: "List posts",
          description: `Posts, newest scheduled first, a page at a time; pass \`nextCursor\` back as \`cursor\` for the next page. ${permission("read")}`,
          tags: ["Accounts and posts"],
          parameters: [
            {
              name: "accountId",
              in: "query",
              description: "Comma-separated account ids: only posts on these accounts",
              schema: { type: "string" },
            },
            {
              name: "provider",
              in: "query",
              description: "Comma-separated platforms, e.g. `youtube,instagram`",
              schema: { type: "string" },
            },
            {
              name: "search",
              in: "query",
              description: "Words in the title, caption or description (case-insensitive)",
              schema: { type: "string" },
            },
            {
              name: "cursor",
              in: "query",
              description: "`nextCursor` from the previous page",
              schema: { type: "string" },
            },
            {
              name: "status",
              in: "query",
              description: "Comma-separated statuses, e.g. `scheduled,failed`",
              schema: { type: "string" },
            },
            {
              name: "from",
              in: "query",
              description: "ISO time; scheduled at or after",
              schema: { type: "string", format: "date-time" },
            },
            {
              name: "to",
              in: "query",
              description: "ISO time; scheduled at or before",
              schema: { type: "string", format: "date-time" },
            },
            {
              name: "limit",
              in: "query",
              description: "Default 100, max 500",
              schema: { type: "integer", default: 100, maximum: 500 },
            },
          ],
          responses: {
            "200": ok("A page of posts.", {
              type: "object",
              properties: {
                posts: { type: "array", items: ref("Post") },
                nextCursor: {
                  type: ["string", "null"],
                  description: "Pass as `cursor` for the next page; null on the last",
                },
              },
              required: ["posts", "nextCursor"],
            }),
            ...ERRORS,
          },
        },
        post: {
          operationId: "createPostRest",
          summary: "Schedule a post",
          description: `${findTool("create_post")?.description ?? ""} ${permission("publish")}`,
          tags: ["Accounts and posts"],
          requestBody: { required: true, content: json(inputWithout("create_post")) },
          responses: {
            "201": ok("The scheduled post.", postBody),
            ...ERRORS,
          },
        },
      },
      "/api/v1/posts/{id}": {
        parameters: [withId],
        get: {
          operationId: "getPostRest",
          summary: "Get a post",
          description: `One post and its status. Add \`?insights=1\` for its live platform status and metrics instead. ${permission("read")}`,
          tags: ["Accounts and posts"],
          parameters: [
            {
              name: "insights",
              in: "query",
              description: "Any value: answer with get_post_insights' result instead",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": ok("The post.", postBody),
            ...ERRORS,
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
        patch: {
          operationId: "updatePostRest",
          summary: "Change a scheduled post",
          description: `${findTool("update_post")?.description ?? ""} ${permission("publish")}`,
          tags: ["Accounts and posts"],
          requestBody: { required: true, content: json(inputWithout("update_post", "id")) },
          responses: {
            "200": ok("The changed post.", postBody),
            ...ERRORS,
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
        delete: {
          operationId: "cancelPostRest",
          summary: "Cancel a scheduled post",
          description: `Cancels a post that is still waiting in mixetape. ${permission("publish")}`,
          tags: ["Accounts and posts"],
          responses: {
            "200": ok("The cancelled post.", postBody),
            ...ERRORS,
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
        post: {
          operationId: "retryPostRest",
          summary: "Retry a failed post, or set its thumbnail",
          description: `Without a body, sends a failed post again. With \`{ thumbnailUrl }\`, sets or replaces the thumbnail of a post already on the platform. ${permission("publish")}`,
          tags: ["Accounts and posts"],
          requestBody: {
            required: false,
            content: json({
              type: "object",
              properties: {
                thumbnailUrl: { type: "string", description: "A public image URL or r2:// URL" },
              },
            }),
          },
          responses: {
            "200": ok("The post.", postBody),
            ...ERRORS,
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/api/v1/tools": {
        get: {
          operationId: "listTools",
          summary: "List the tools this key may call",
          description:
            "The same tools the MCP server offers, filtered by the key's permissions, with their input schemas.",
          tags: ["Accounts and posts"],
          responses: {
            "200": ok("The tools.", {
              type: "object",
              properties: {
                tools: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      inputSchema: { type: "object" },
                    },
                  },
                },
              },
            }),
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      ...toolPaths,
    },
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          description: "An API key from the workspace (API keys page), starting with `mxt_`.",
        },
      },
      responses: {
        BadRequest: ok("The request is invalid; `error` says why.", ref("Error")),
        Unauthorized: ok("No valid API key.", ref("Error")),
        Forbidden: ok("The key lacks the permission this needs.", ref("Error")),
        NotFound: ok("Not found, or not yours.", ref("Error")),
      },
      schemas: {
        Error: {
          type: "object",
          properties: { error: { type: "string", description: "What went wrong, in plain words" } },
          required: ["error"],
        },
        Account: {
          type: "object",
          properties: {
            id: { type: "string", description: "mixetape account id, used as accountId" },
            provider: {
              type: "string",
              enum: ["youtube", "facebook", "instagram", "threads", "tiktok", "pinterest"],
            },
            platformAccountId: { type: "string", description: "The platform's own id" },
            name: { type: "string" },
            handle: { type: ["string", "null"] },
            status: {
              type: "string",
              enum: ["active", "reconnect"],
              description: "`reconnect`: connect the channel again before posting to it",
            },
            capabilities: {
              type: "array",
              items: { type: "string" },
              description: "What its platform supports, e.g. comments, analytics",
            },
          },
          required: ["id", "provider", "platformAccountId", "name", "status", "capabilities"],
        },
        Post: {
          type: "object",
          properties: {
            id: { type: "string" },
            accountId: { type: "string" },
            provider: { type: "string" },
            mediaUrl: { type: "string" },
            caption: { type: ["string", "null"] },
            metadata: { type: ["object", "null"], description: "The platform's own fields" },
            scheduledAt: { type: "string", format: "date-time", description: "When it goes live" },
            leadMinutes: {
              type: ["integer", "null"],
              description: "Uploaded or prepared this long before scheduledAt",
            },
            status: {
              type: "string",
              enum: ["scheduled", "publishing", "uploaded", "published", "failed", "cancelled"],
            },
            platformPostId: { type: ["string", "null"] },
            platformUrl: { type: ["string", "null"] },
            error: { type: ["string", "null"], description: "Why it failed, when it did" },
            attempts: { type: "integer" },
            publishedAt: { type: ["string", "null"], format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
          required: ["id", "accountId", "provider", "mediaUrl", "scheduledAt", "status"],
        },
      },
    },
  };
}
