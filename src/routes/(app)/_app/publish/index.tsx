import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import * as z from "zod/mini";
import { Skeleton } from "#/components/ui/skeleton";
import { Page } from "#/components/layouts/workspace-page";
import { siteConfig } from "#/config/site";
import { calendarPostsQuery, getPublishAccounts } from "./-fn/calendar.fn";
import { dayKey, monthDays } from "./-lib/calendar";
import { DEFAULT_ZONE } from "./-lib/posts";
import { PublishBoard } from "./-components/publish-board";
import { useViewerZone } from "./-components/publish-filters";

// The day lives in the URL, so a reload or a shared link opens the same month.
const search = z.object({
  date: z.optional(z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/))),
});

export const Route = createFileRoute("/(app)/_app/publish/")({
  validateSearch: search,
  // Moving between months is the board's query; only the first one arrives rendered.
  loaderDeps: () => ({}),
  loader: async ({ context, location }) => {
    const { date } = location.search as z.infer<typeof search>;
    const [accounts] = await Promise.all([
      getPublishAccounts(),
      context.queryClient.ensureQueryData(
        calendarPostsQuery(monthDays(date ?? dayKey(new Date(), DEFAULT_ZONE))),
      ),
    ]);
    return { accounts };
  },
  head: () => ({ meta: [{ title: `Publish | ${siteConfig.name}` }] }),
  component: PublishPage,
  pendingComponent: PublishPending,
});

function PublishPage() {
  const { accounts } = Route.useLoaderData();
  const { date } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [timeZone, setTimeZone] = useViewerZone();
  const {
    data: posts = [],
    isFetching,
    isError,
  } = useQuery({
    ...calendarPostsQuery(monthDays(date ?? dayKey(new Date(), timeZone))),
    placeholderData: keepPreviousData,
  });
  return (
    <PublishBoard
      accounts={accounts}
      posts={posts}
      date={date}
      timeZone={timeZone}
      onZone={setTimeZone}
      loading={isFetching}
      failed={isError}
      onNavigate={(next) => navigate({ search: { date: next }, replace: true })}
    />
  );
}

// The board's frame (toolbar, the month's strip, day columns) before the month arrives.
function PublishPending() {
  return (
    <Page>
      <div role="status" aria-label="Loading" className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="ml-auto h-8 w-48 rounded-lg" />
        </div>
        <div className="flex gap-1 overflow-hidden">
          {Array.from({ length: 31 }, (_, day) => (
            <Skeleton key={day} className="h-14 w-11 shrink-0 rounded-lg" />
          ))}
        </div>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }, (_, column) => (
            <div key={column} className="flex w-[17.5rem] shrink-0 flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-10 rounded-xl" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
              <Skeleton className="h-28 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}
