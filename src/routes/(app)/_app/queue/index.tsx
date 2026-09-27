import { createFileRoute } from "@tanstack/react-router";
import { getQueueData } from "#/modules/social/social.fn";
import { siteConfig } from "#/config/site";
import { QueueView } from "./-components/queue-view";

export const Route = createFileRoute("/(app)/_app/queue/")({
  loader: () => getQueueData(),
  head: () => ({ meta: [{ title: `Queue | ${siteConfig.name}` }] }),
  component: QueuePage,
});

function QueuePage() {
  return <QueueView {...Route.useLoaderData()} />;
}
