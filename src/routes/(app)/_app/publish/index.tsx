import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { CalendarBlank } from "@phosphor-icons/react/CalendarBlank";
import { ListBullets } from "@phosphor-icons/react/ListBullets";
import { Segmented } from "#/components/ui/segmented";
import { Skeleton } from "#/components/ui/skeleton";
import { Page, PageHeader, Panel, PendingRows } from "#/components/layouts/workspace-page";
import { getQueueData } from "#/modules/social/social.fn";
import { siteConfig } from "#/config/site";
import { calendarPostsQuery, getPublishAccounts } from "./-fn/calendar.fn";
import { dayKey, visibleDays } from "./-lib/calendar";
import { DEFAULT_ZONE } from "./-lib/posts";
import { PublishCalendar } from "./-components/publish-calendar";
import { PublishView } from "./-components/publish-view";

// The view lives in the URL, so a reload or a shared link opens the same days.
const search = z.object({
  view: z.enum(["calendar", "list"]).optional(),
  mode: z.enum(["month", "week", "days"]).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const Route = createFileRoute("/(app)/_app/publish/")({
  validateSearch: search,
  // Only switching List / Calendar reloads; moving through dates is the calendar's query.
  loaderDeps: ({ search }) => ({ view: search.view ?? "calendar" }),
  loader: async ({ deps, context, location }) => {
    if (deps.view === "list") return getQueueData();
    const { mode = "month", date } = location.search as z.infer<typeof search>;
    const [accounts] = await Promise.all([
      getPublishAccounts(),
      // The first view arrives rendered; later ones load as the calendar moves.
      context.queryClient.ensureQueryData(
        calendarPostsQuery(visibleDays(mode, date ?? dayKey(new Date(), DEFAULT_ZONE))),
      ),
    ]);
    return { accounts, posts: [] };
  },
  head: () => ({ meta: [{ title: `Publish | ${siteConfig.name}` }] }),
  component: PublishPage,
  pendingComponent: PublishPending,
});

// The calendar's frame (a month of cells) or the list's rows, before the posts arrive.
function PublishPending() {
  const { view = "calendar" } = Route.useSearch();
  return (
    <Page>
      <PageHeader title="Publish" actions={<Skeleton className="h-8 w-28 rounded-full" />} />
      {view === "list" ? (
        <Panel>
          <PendingRows rows={5} lead />
        </Panel>
      ) : (
        <div role="status" aria-label="Loading" className="flex flex-col gap-3">
          <Skeleton className="h-8 w-56 rounded-full" />
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid grid-cols-7 border-b border-border">
              {Array.from({ length: 7 }, (_, day) => (
                <div
                  key={day}
                  className="flex justify-center border-r border-border py-2.5 last:border-r-0"
                >
                  <Skeleton className="h-3 w-8" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: 35 }, (_, cell) => (
                <div
                  key={cell}
                  className="min-h-24 border-r border-b border-border p-1.5 sm:min-h-32 [&:nth-child(7n)]:border-r-0"
                >
                  <Skeleton className="size-6 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

function PublishPage() {
  const data = Route.useLoaderData();
  const { view = "calendar", mode = "month", date } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const toggle = (
    <Segmented
      label="View"
      value={view}
      onChange={(next) => navigate({ search: (prev) => ({ ...prev, view: next }) })}
      options={[
        {
          value: "list",
          label: (
            <>
              <ListBullets size={15} /> <span className="hidden sm:inline">List</span>
            </>
          ),
        },
        {
          value: "calendar",
          label: (
            <>
              <CalendarBlank size={15} /> <span className="hidden sm:inline">Calendar</span>
            </>
          ),
        },
      ]}
    />
  );

  if (view === "list") return <PublishView {...data} viewToggle={toggle} />;
  return (
    <PublishCalendar
      accounts={data.accounts}
      view={mode}
      date={date}
      viewToggle={toggle}
      onNavigate={(next) =>
        navigate({
          search: (prev) => ({ ...prev, ...next }),
          replace: true,
        })
      }
    />
  );
}
