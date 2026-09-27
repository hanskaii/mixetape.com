import { createFileRoute } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";
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

const styles = stylex.create({
  main: {
    paddingBlockEnd: "5rem",
    paddingInline: { default: "1rem", "@media (min-width: 640px)": "2rem" },
  },
});

function HomePage() {
  const signedIn = Boolean(RootRoute.useRouteContext().session?.user);
  return (
    <main {...stylex.props(styles.main)}>
      <Hero signedIn={signedIn} />
      <Platforms />
      <WorkspacePreview />
      <HowItWorks />
      <ForAgents signedIn={signedIn} />
    </main>
  );
}
