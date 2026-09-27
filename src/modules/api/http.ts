import { getAuth } from "#/modules/auth/auth.server";
import {
  ALL_SCOPES,
  callerForApiKey,
  requireScope,
  type ApiScope,
  type Caller,
} from "./api-keys.service";
import { ServiceError } from "#/modules/api/errors";

async function sessionUserId(request: Request): Promise<string | null> {
  const session = await (
    await getAuth()
  ).api
    .getSession({ headers: request.headers })
    .catch(() => null);
  return session?.user.id ?? null;
}

/**
 * The caller of an API route: an `Authorization: Bearer mxt_…` API key with its
 * permissions, or a signed-in browser session, which may do everything.
 */
export async function requireCaller(request: Request): Promise<Caller> {
  const fromKey = await callerForApiKey(request);
  if (fromKey) return fromKey;
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
      return Response.json({ error: error.message }, { status: error.status });
    console.error("[api]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
