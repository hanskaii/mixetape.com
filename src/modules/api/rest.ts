import type { Need } from "#/modules/social/providers";
import { requireScope, type ApiScope } from "./api-keys.service";
import { errorBody, ServiceError } from "./errors";
import { requireCaller } from "./http";
import { once } from "./idempotency.service";
import { Input, rejectUnknown } from "./input";
import { countCall, RETRY_AFTER_SECONDS } from "./rate-limit";

/**
 * The REST API: resources under /api/v1, for scripts and integrations. Each module declares
 * its endpoints (*.rest.ts) in this one shape, so the router and the OpenAPI document are
 * built from the same list and cannot drift apart. Endpoints call the same services the MCP
 * tools and the workspace use.
 */

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Schema = Record<string, unknown>;

export type Endpoint = {
  method: Method;
  /** Under /api/v1, with {params}: "/posts/{id}/comments". */
  path: string;
  operationId: string;
  summary: string;
  description: string;
  /** The resource it belongs to, grouping the reference. */
  tag: string;
  scope: ApiScope;
  /** What it needs from the platform; left out, it works on every platform. */
  needs?: Need;
  /** Descriptions of the path's {params}. */
  params?: Record<string, string>;
  /** Query parameters, as JSON Schema properties; arrays are comma-separated. */
  query?: Record<string, Schema>;
  /** The JSON body, as an object schema. */
  body?: Schema;
  status?: 200 | 201;
  response: { description: string; schema: Schema };
  /** Statuses beyond 400/401/403/429 it can answer with, e.g. 404 or 409. */
  errors?: number[];
  /**
   * A write that must not happen twice: it honours an Idempotency-Key header, answering a
   * retry with the first answer.
   */
  idempotent?: boolean;
  /** Still served, but superseded; the reference marks it and says what to use. */
  deprecated?: boolean;
  run: (userId: string, input: Input) => Promise<unknown>;
};

export const BASE = "/api/v1";

const paramNames = (path: string) => [...path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);

/** Paths are lowercase words, slashes and {params}, so a param becomes one segment. */
const pattern = (path: string) => new RegExp(`^${path.replace(/\{\w+\}/g, "([^/]+)")}$`);

type Match = { endpoint: Endpoint; params: Record<string, string> } | { allowed: Method[] } | null;

/**
 * The endpoint for a method and a path under /api/v1, or the methods that path takes. The
 * most literal path wins: /files/uploads is that resource, not the file "uploads".
 */
export function match(endpoints: readonly Endpoint[], method: string, path: string): Match {
  const candidates = endpoints.filter((endpoint) => pattern(endpoint.path).test(path));
  if (!candidates.length) return null;
  const fewest = Math.min(...candidates.map((endpoint) => paramNames(endpoint.path).length));
  const template = candidates.find((endpoint) => paramNames(endpoint.path).length === fewest)!.path;
  const same = candidates.filter((endpoint) => endpoint.path === template);
  const endpoint = same.find((candidate) => candidate.method === method);
  if (!endpoint) return { allowed: same.map((candidate) => candidate.method) };
  const values = pattern(template).exec(path)!.slice(1);
  return {
    endpoint,
    params: Object.fromEntries(
      paramNames(template).map((name, index) => [name, decodeURIComponent(values[index])]),
    ),
  };
}

/** Query strings are text; read each declared parameter as the type its schema says. */
export function fromQuery(search: URLSearchParams, schema: Record<string, Schema> = {}) {
  const args: Record<string, unknown> = {};
  for (const [name, property] of Object.entries(schema)) {
    const value = search.get(name);
    if (value === null) continue;
    const type = property.type;
    if (type === "array")
      args[name] = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    else if (type === "integer" || type === "number")
      args[name] = value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : value;
    else if (type === "boolean")
      args[name] =
        value === "true" || value === "1"
          ? true
          : value === "false" || value === "0"
            ? false
            : value;
    else args[name] = value;
  }
  return args;
}

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ServiceError("The body must be JSON", 400, { code: "invalid_request" });
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new ServiceError("The body must be a JSON object", 400, { code: "invalid_request" });
  return body as Record<string, unknown>;
}

const failure = (error: ServiceError, headers?: HeadersInit) =>
  Response.json(errorBody(error), { status: error.status, headers });

/**
 * Answers one request under /api/v1: route it, check the key and the allowance, refuse
 * fields the endpoint does not take, run it (once, given an Idempotency-Key), report errors
 * as { error: { code, message, field? } }.
 */
export async function handle(request: Request, endpoints: readonly Endpoint[]): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice(BASE.length) || "/";
  const found = match(endpoints, request.method, path.replace(/\/$/, "") || "/");
  if (!found)
    return failure(new ServiceError(`No endpoint at ${request.method} ${url.pathname}`, 404));
  if ("allowed" in found)
    return failure(new ServiceError(`${request.method} is not allowed here`, 405), {
      Allow: found.allowed.join(", "),
    });

  const { endpoint, params } = found;
  try {
    const caller = await requireCaller(request);
    requireScope(caller, endpoint.scope);
    await countCall(caller.userId);
    const body = endpoint.body ? await jsonBody(request) : {};
    // The body takes only the fields its schema names. A path parameter repeated in the
    // body is fine: the path wins.
    if (endpoint.body)
      rejectUnknown(
        body,
        Object.keys((endpoint.body.properties ?? {}) as Record<string, unknown>),
        Object.keys(params),
      );
    const args = { ...fromQuery(url.searchParams, endpoint.query), ...body, ...params };
    const key = endpoint.idempotent
      ? (request.headers.get("Idempotency-Key") ?? undefined)
      : undefined;
    const answer = await once(
      caller.userId,
      key,
      { method: request.method, path, args },
      async () => ({
        status: endpoint.status ?? 200,
        body: await endpoint.run(caller.userId, new Input(args)),
      }),
    );
    return Response.json(answer.body, {
      status: answer.status,
      headers: answer.replayed ? { "Idempotent-Replayed": "true" } : undefined,
    });
  } catch (caught) {
    if (caught instanceof ServiceError)
      return failure(
        caught,
        caught.code === "rate_limited" ? { "Retry-After": String(RETRY_AFTER_SECONDS) } : undefined,
      );
    console.error("[api]", caught);
    return failure(new ServiceError("Internal server error", 500));
  }
}
