import { platformsWith } from "#/modules/social/providers";
import { API_SCOPES } from "./api-keys.service";
import { ERROR_CODES } from "./errors";
import { ENDPOINTS } from "./endpoints";
import { BASE, type Endpoint } from "./rest";

/**
 * The REST API as an OpenAPI 3.1 document, built from the same endpoint list the router
 * serves — so it cannot drift from the code. Served at /api/v1/openapi.json; the docs site
 * (docs/) copies it for its API reference. MCP tools are not in it: they are a separate
 * interface, documented on their own.
 */

const json = (schema: unknown) => ({ "application/json": { schema } });

const ERRORS: Record<number, string> = {
  400: "BadRequest",
  401: "Unauthorized",
  403: "Forbidden",
  404: "NotFound",
  409: "Conflict",
  410: "Gone",
  422: "IdempotencyKeyReused",
  429: "TooManyRequests",
  502: "BadGateway",
  503: "Unavailable",
};

/** The reference's sections, in reading order. */
const TAGS = [
  ["Accounts", "Connected channels, their collections and analytics."],
  ["Connections", "Connecting an account: a sign-in link for the person who owns it."],
  ["Brands", "Groups of accounts, to publish to all of them at once."],
  ["Posts", "Scheduling posts, and managing them once they are on the platform."],
  ["Comments", "Reading, posting, replying to and moderating comments."],
  ["Groups", "Library groups: files that go out together, with their drafted words."],
  [
    "Files",
    "mixetape storage: uploads, imports and the files' index; files published without a group.",
  ],
] as const;

const IDEMPOTENCY_KEY = {
  name: "Idempotency-Key",
  in: "header",
  required: false,
  description:
    "Any unique text (e.g. a UUID) for this one request. Repeating the request with the same key — say after a timeout — answers with the first response (header Idempotent-Replayed: true) instead of doing it twice. Kept for 24 hours; the same key with a different request is refused (422).",
  schema: { type: "string", maxLength: 255 },
};

function operation(endpoint: Endpoint) {
  const statuses = [
    ...new Set([
      400,
      401,
      403,
      429,
      ...(endpoint.idempotent ? [409, 422] : []),
      ...(endpoint.errors ?? []),
    ]),
  ].sort();
  const pathParams = [...endpoint.path.matchAll(/\{(\w+)\}/g)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    description: endpoint.params?.[name],
    schema: { type: "string" },
  }));
  const queryParams = Object.entries(endpoint.query ?? {}).map(([name, schema]) => ({
    name,
    in: "query",
    description:
      schema.type === "array"
        ? `${String(schema.description ?? "")} (comma-separated)`.trim()
        : schema.description,
    schema,
    ...(schema.type === "array" && { style: "form", explode: false }),
  }));
  const parameters = [
    ...pathParams,
    ...queryParams,
    ...(endpoint.idempotent ? [IDEMPOTENCY_KEY] : []),
  ];
  const needs = `Needs the **${endpoint.scope}** permission.`;
  return {
    operationId: endpoint.operationId,
    summary: endpoint.summary,
    description: `${endpoint.description}\n\n${needs}`,
    tags: [endpoint.tag],
    ...(endpoint.deprecated && { deprecated: true }),
    "x-permission": endpoint.scope,
    // The platforms it works on; every one unless it needs a capability some lack.
    "x-platforms": platformsWith(endpoint.needs),
    ...(parameters.length && { parameters }),
    ...(endpoint.body && { requestBody: { required: true, content: json(endpoint.body) } }),
    responses: {
      [String(endpoint.status ?? 200)]: {
        description: endpoint.response.description,
        content: json(endpoint.response.schema),
      },
      ...Object.fromEntries(
        statuses.map((status) => [
          String(status),
          { $ref: `#/components/responses/${ERRORS[status]}` },
        ]),
      ),
    },
  };
}

export function openApiDocument(serverUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const endpoint of ENDPOINTS) {
    const path = `${BASE}${endpoint.path}`;
    paths[path] = { ...paths[path], [endpoint.method.toLowerCase()]: operation(endpoint) };
  }

  const error = (description: string) => ({
    description,
    content: json({ $ref: "#/components/schemas/Error" }),
  });

  return {
    openapi: "3.1.0",
    info: {
      title: "mixetape API",
      version: "1.0.0",
      summary: "Schedule and manage posts on connected social accounts.",
      description:
        "The REST API for scripts and integrations: accounts, posts, comments, library groups and files as resources. Every request carries an API key; each endpoint needs one of its permissions. Errors answer { error: { code, message, field? } }; writes that must not happen twice take an Idempotency-Key header; each user may make 120 requests a minute. AI agents use the MCP server at /mcp instead, with the same actions as tools.",
    },
    servers: [{ url: serverUrl }],
    security: [{ apiKey: [] }],
    tags: TAGS.map(([name, description]) => ({ name, description })),
    paths,
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          description: `An API key from the workspace (API keys page), starting with \`mxt_\`. Each endpoint needs one of its permissions: ${Object.keys(API_SCOPES).join(", ")}.`,
          // What each permission allows, for the reference's overview.
          "x-permissions": API_SCOPES,
        },
      },
      responses: {
        BadRequest: error(
          "The request is invalid; error.code says how (invalid_field, missing_field, unknown_field, media_not_supported, …) and error.field which field.",
        ),
        Unauthorized: error("No valid API key."),
        Forbidden: error("The key lacks the permission this needs."),
        NotFound: error("Not found, or not yours."),
        Conflict: error(
          "Not possible in its current state: invalid_post_state, account_needs_reconnect, file_not_ready, idempotency_in_progress, …",
        ),
        IdempotencyKeyReused: error(
          "The Idempotency-Key was already used with a different request (idempotency_key_reused).",
        ),
        TooManyRequests: {
          ...error("Over 120 requests a minute (rate_limited); wait and retry."),
          headers: {
            "Retry-After": {
              description: "Seconds to wait before retrying",
              schema: { type: "integer" },
            },
          },
        },
        Gone: error("The choice expired; connect again."),
        BadGateway: error(
          "Something mixetape depends on failed: the file at a URL could not be fetched (source_unreachable) or the platform refused the call (platform_error).",
        ),
        Unavailable: error("mixetape cannot connect that platform yet."),
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  enum: Object.keys(ERROR_CODES),
                  description: `A stable code to branch on:\n\n${Object.entries(ERROR_CODES)
                    .map(([code, meaning]) => `- \`${code}\`: ${meaning}`)
                    .join("\n")}`,
                },
                message: { type: "string", description: "What went wrong, in plain words" },
                field: { type: "string", description: "The input field it is about, if any" },
              },
              required: ["code", "message"],
            },
          },
          required: ["error"],
        },
      },
    },
  };
}
