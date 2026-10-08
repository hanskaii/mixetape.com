import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { CalendarBlank, ListBullets } from "@phosphor-icons/react";
import { Segmented } from "#/components/ui/segmented";
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
  mode: z.enum(["month", "week"]).optional(),
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
});

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
