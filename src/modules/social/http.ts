import { auth } from "#/modules/auth/auth.server";
import { ServiceError, userForApiKey } from "./social.service";

/**
 * The caller of an API route: a signed-in browser session, or — for machines, such as a
 * publishing pipeline — an `Authorization: Bearer mxt_…` API key.
 */
export async function requireUser(request: Request, { allowApiKey = true } = {}): Promise<string> {
  if (allowApiKey) {
    const fromKey = await userForApiKey(request);
    if (fromKey) return fromKey;
  }
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (session?.user) return session.user.id;
  throw new ServiceError("Unauthorized", 401);
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
