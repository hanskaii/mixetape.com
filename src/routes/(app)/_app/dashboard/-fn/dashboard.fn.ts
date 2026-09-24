import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "#/modules/auth/auth.server";
import { getAnalyticsData } from "#/modules/analytics/analytics.service";
import { deleteOwnedMedia } from "#/modules/storage/storage.service";

export const getAnalyticsMetrics = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  if (!headers) throw new Error("Unauthorized");

  const session = await auth.api.getSession({ headers });
  if (!session?.user) throw new Error("Unauthorized");

  const result = await getAnalyticsData(session.user.id);
  return result.data;
});

export const bulkDeleteMedia = createServerFn({ method: "POST" })
  .validator((data: { keys: string[] }) => data)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    if (!headers) throw new Error("Unauthorized");

    const session = await auth.api.getSession({ headers });
    if (!session?.user) throw new Error("Unauthorized");

    const keys = data.keys || [];
    if (!keys.length) {
      throw new Error("No keys provided to delete");
    }

    const { deleted, refused } = await deleteOwnedMedia(keys, session.user.id);
    return { success: true, count: deleted, refused };
  });
