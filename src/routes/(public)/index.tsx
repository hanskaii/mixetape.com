import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, Key, PlugsConnected, YoutubeLogo } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { useModal } from "#/components/providers/modal-providers";
import { Route as RootRoute } from "#/routes/__root";
import { siteConfig } from "#/config/site";

export const Route = createFileRoute("/(public)/")({
  head: () => ({
    meta: [
      { title: siteConfig.title },
      { name: "description", content: siteConfig.description },
      { property: "og:title", content: siteConfig.title },
      { property: "og:type", content: "website" },
    ],
  }),
  component: HomePage,
});

const FEATURES = [
  {
    icon: PlugsConnected,
    title: "Your own credentials",
    text: "Connect channels through your own OAuth app, so the quota and the approval stay yours.",
  },
  {
    icon: CalendarCheck,
    title: "Scheduled, then forgotten",
    text: "Each post runs as a durable job: it waits for its time, retries on its own, and tells you if it failed.",
  },
  {
    icon: Key,
    title: "An API for pipelines",
    text: "Schedule from scripts with an API key — the same thing the dashboard does, one POST away.",
  },
];

function HomePage() {
  const { session } = RootRoute.useRouteContext();
  const { openLogin } = useModal();

  return (
    <main className="space-y-12 px-4 py-12 md:py-20">
      <section className="max-w-2xl space-y-5">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
          <YoutubeLogo className="size-3.5 text-red-500" /> YouTube today — more platforms next
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Schedule your videos, and let them post themselves.
        </h1>
        <p className="text-base text-muted-foreground">{siteConfig.description}</p>
        {session?.user ? (
          <Button size="lg" render={<Link to="/publish" />}>
            Open Publish
          </Button>
        ) : (
          <Button size="lg" onClick={() => openLogin()}>
            Sign in to start
          </Button>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="space-y-2 rounded-2xl p-5 ring-1 ring-foreground/10">
            <Icon className="size-5" />
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
