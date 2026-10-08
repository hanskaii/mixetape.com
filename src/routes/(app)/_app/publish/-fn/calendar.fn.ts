import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";
import { payingUserId } from "#/modules/auth/auth.server";
import * as social from "#/modules/social/social.service";
import { fetchRange } from "../-lib/calendar";

/** Most posts one calendar view loads; a month past this shows its latest posts. */
const CALENDAR_LIMIT = 500;

/** The posts scheduled between two instants, for the calendar. */
export const getCalendarPosts = createServerFn({ method: "GET" })
  .validator((data: { from: string; to: string }) => {
    const from = new Date(data.from);
    const to = new Date(data.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from)
      throw new Error("Invalid calendar range");
    return { from: from.toISOString(), to: to.toISOString() };
  })
  .handler(async ({ data }) => {
    const { posts } = await social.listPosts(await payingUserId(), {
      from: new Date(data.from),
      to: new Date(data.to),
      limit: CALENDAR_LIMIT,
    });
    return posts;
  });

/** The channels, for the calendar's filter and its posts' details. */
export const getPublishAccounts = createServerFn({ method: "GET" }).handler(async () =>
  social.listAccounts(await payingUserId()),
);

/** Every query the Publish page owns starts with this key, so one call refreshes them all. */
export const PUBLISH_KEY = ["publish"] as const;

/** The posts for a set of visible days; cached per range, so going back is instant. */
export const calendarPostsQuery = (days: string[]) => {
  const range = fetchRange(days);
  return queryOptions({
    queryKey: [...PUBLISH_KEY, "calendar", range.from, range.to],
    queryFn: () => getCalendarPosts({ data: range }),
    staleTime: 30_000,
  });
};
