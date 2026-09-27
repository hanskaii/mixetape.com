import { createFileRoute } from "@tanstack/react-router";
import { getQueueData } from "#/modules/social/social.fn";
import { siteConfig } from "#/config/site";
import { PublishView } from "./-components/publish-view";

export const Route = createFileRoute("/(app)/_app/publish/")({
  loader: () => getQueueData(),
  head: () => ({ meta: [{ title: `Publish | ${siteConfig.name}` }] }),
  component: PublishPage,
});

function PublishPage() {
  return <PublishView {...Route.useLoaderData()} />;
}
