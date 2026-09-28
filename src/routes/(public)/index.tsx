import { createFileRoute } from "@tanstack/react-router";
import { Route as RootRoute } from "#/routes/__root";
import { siteConfig } from "#/config/site";
import { ForAgents } from "./-components/for-agents";
import { Hero } from "./-components/hero";
import { HowItWorks } from "./-components/how-it-works";
import { Platforms } from "./-components/platforms";
import { WorkspacePreview } from "./-components/workspace-preview";

export const Route = createFileRoute("/(public)/")({
  head: () => ({
    meta: [
      { title: siteConfig.title },
      { name: "description", content: siteConfig.description },
      { property: "og:title", content: siteConfig.title },
      { property: "og:description", content: siteConfig.description },
      { property: "og:type", content: "website" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const signedIn = Boolean(RootRoute.useRouteContext().session?.user);
  return (
    // Sections sit straight in the layout's <main>, which spaces them.
    <>
      <Hero signedIn={signedIn} />
      <Platforms />
      <WorkspacePreview />
      <HowItWorks />
      <ForAgents />
    </>
  );
}
