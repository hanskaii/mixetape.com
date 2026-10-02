import { getAuth } from "#/modules/auth/auth.server";
import {
  ALL_SCOPES,
  callerForApiKey,
  requireScope,
  type ApiScope,
  type Caller,
} from "./api-keys.service";
import { errorBody, ServiceError } from "#/modules/api/errors";
import { callerForOAuthToken } from "#/modules/oauth/oauth.service";

async function sessionUserId(request: Request): Promise<string | null> {
  const session = await (
    await getAuth()
  ).api
    .getSession({ headers: request.headers })
    .catch(() => null);
  return session?.user.id ?? null;
}

/**
 * The caller behind an `Authorization: Bearer` header: an API key (mxt_…) or an OAuth
 * access token a connected app was given (mxo_…), each with its permissions; else null.
 */
export async function callerForBearer(request: Request): Promise<Caller | null> {
  const fromKey = await callerForApiKey(request);
  if (fromKey) return fromKey;
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? callerForOAuthToken(header.slice(7).trim()) : null;
}

/**
 * The caller of an API route: an API key or a connected app's token with its permissions
 * (callerForBearer), or a signed-in browser session, which may do everything.
 */
export async function requireCaller(request: Request): Promise<Caller> {
  const fromBearer = await callerForBearer(request);
  if (fromBearer) return fromBearer;
  const userId = await sessionUserId(request);
  if (userId) return { userId, scopes: ALL_SCOPES };
  throw new ServiceError("Unauthorized", 401);
}

/** The calling user, once they are known to hold `scope`. */
export async function requireUser(request: Request, scope: ApiScope): Promise<string> {
  const caller = await requireCaller(request);
  requireScope(caller, scope);
  return caller.userId;
}

/** The signed-in person, for routes an API key must never reach (e.g. connecting). */
export async function requireSession(request: Request): Promise<string> {
  const userId = await sessionUserId(request);
  if (!userId) throw new ServiceError("Unauthorized", 401);
  return userId;
}

/** Runs a handler and turns a ServiceError into its status; anything else is a 500. */
export async function respond(handler: () => Promise<unknown>, status = 200): Promise<Response> {
  try {
    return Response.json(await handler(), { status });
  } catch (error) {
    if (error instanceof ServiceError)
      return Response.json(errorBody(error), { status: error.status });
    console.error("[api]", error);
    return Response.json(errorBody(new ServiceError("Internal server error", 500)), {
      status: 500,
    });
  }
}
