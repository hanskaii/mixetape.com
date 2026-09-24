import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "./auth.server";
import { db, schema } from "#/database/index";
import { eq, and } from "drizzle-orm";

export const getAuthSession = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const headers = getRequestHeaders();
    if (!headers) return null;

    const session = await auth.api.getSession({
      headers,
    });
    return session;
  } catch (error) {
    console.error("Failed to get auth session on server:", error);
    return null;
  }
});

export const getUserLinkedAccounts = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const headers = getRequestHeaders();
    if (!headers) return [];

    const session = await auth.api.getSession({ headers });
    if (!session?.user) return [];

    const accounts = await db.query.account.findMany({
      where: eq(schema.account.userId, session.user.id),
    });

    return accounts.map((acc) => ({
      id: acc.id,
      providerId: acc.providerId,
      accountId: acc.accountId,
      createdAt: acc.createdAt,
    }));
  } catch (error) {
    console.error("Failed to get linked accounts on server:", error);
    return [];
  }
});

export const unlinkUserAccount = createServerFn({ method: "POST" })
  .validator((data: { providerId: string }) => data)
  .handler(async ({ data: { providerId } }) => {
    const headers = getRequestHeaders();
    if (!headers) throw new Error("Unauthorized");

    const session = await auth.api.getSession({ headers });
    if (!session?.user) throw new Error("Unauthorized");

    await db
      .delete(schema.account)
      .where(
        and(eq(schema.account.userId, session.user.id), eq(schema.account.providerId, providerId)),
      );

    return { success: true };
  });
