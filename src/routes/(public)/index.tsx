import { createFileRoute } from "@tanstack/react-router";
import { Route as RootRoute } from "#/routes/__root";
import { siteConfig } from "#/config/site";
import { publicHead } from "./-lib/head";
import { ForAgents } from "./-components/for-agents";
import { Hero } from "./-components/hero";
import { HowItWorks } from "./-components/how-it-works";
import { Platforms } from "./-components/platforms";
import { WorkspacePreview } from "./-components/workspace-preview";

export const Route = createFileRoute("/(public)/")({
  head: () => ({
    ...publicHead({ path: "/", title: siteConfig.title, description: siteConfig.description }),
    scripts: [{ type: "application/ld+json", children: JSON.stringify(structuredData) }],
  }),
  component: HomePage,
});

// What the product is, for search engines: the app, and who makes it.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: siteConfig.name,
      url: `${siteConfig.url}/`,
      description: siteConfig.description,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      image: `${siteConfig.url}${siteConfig.ogImage}`,
      publisher: { "@id": `${siteConfig.url}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${siteConfig.url}/#organization`,
      name: siteConfig.name,
      url: `${siteConfig.url}/`,
      logo: `${siteConfig.url}/favicon.svg`,
      email: siteConfig.contactEmail,
    },
  ],
};

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
