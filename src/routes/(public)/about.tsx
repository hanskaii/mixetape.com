import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Cpu,
  Database,
  TerminalWindow,
  Sparkle,
  ArrowUpRight,
  BookOpen,
  EnvelopeSimple,
  GithubLogo,
  XLogo,
  LinkedinLogo,
} from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { siteConfig } from "#/config/site";

const FOCUS_AREAS = [
  {
    title: "Distributed Systems & Architecture",
    desc: "Designing resilient, geo-distributed backend architectures that maintain ultra-low latencies under high concurrency.",
    icon: Cpu,
  },
  {
    title: "Data Pipelines & Storage Engines",
    desc: "Building real-time event pipelines, column-oriented analytics sinks, and relational storage layers built for scale.",
    icon: Database,
  },
  {
    title: "Developer Platforms & Tooling",
    desc: "Crafting intuitive developer APIs, ergonomic workflows, and reliable continuous deployment tooling.",
    icon: TerminalWindow,
  },
  {
    title: "High-Craft Digital Interfaces",
    desc: "Pairing robust backend systems with fast, minimalist, and accessible user interfaces built on strict design systems.",
    icon: Sparkle,
  },
];

export const Route = createFileRoute("/(public)/about")({
  head: () => ({
    meta: [
      { title: `About | ${siteConfig.name}` },
      {
        name: "description",
        content: `About ${siteConfig.name} and ${siteConfig.author.name}: ${siteConfig.author.bio}`,
      },
      { property: "og:title", content: `About | ${siteConfig.name}` },
      {
        property: "og:image",
        content: `/api/og?title=${encodeURIComponent(`About ${siteConfig.name}`)}&category=Overview&author=${encodeURIComponent(siteConfig.author.name)}`,
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <main className="space-y-10 px-4 py-8 md:py-12">
      {/* Intro Header */}
      <div className="space-y-3 border-b border-border/60 pb-8">
        <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
          Engineering &amp; Systems
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          About {siteConfig.author.name}
        </h1>
        <p className="max-w-2xl text-xs sm:text-sm leading-relaxed text-muted-foreground">
          {siteConfig.author.bio}
        </p>

        {/* Quick Social / Contact Row */}
        <div className="flex items-center gap-2 pt-2">
          {siteConfig.author.socials.github && (
            <a
              href={siteConfig.author.socials.github}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Profile"
              className="p-2 rounded-full border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="GitHub"
            >
              <GithubLogo className="size-4" />
            </a>
          )}
          {siteConfig.author.socials.x && (
            <a
              href={siteConfig.author.socials.x}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter) Profile"
              className="p-2 rounded-full border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="X (Twitter)"
            >
              <XLogo className="size-4" />
            </a>
          )}
          {siteConfig.author.socials.linkedin && (
            <a
              href={siteConfig.author.socials.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn Profile"
              className="p-2 rounded-full border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="LinkedIn"
            >
              <LinkedinLogo className="size-4" />
            </a>
          )}
          {siteConfig.author.email && (
            <a
              href={`mailto:${siteConfig.author.email}`}
              aria-label="Send Email"
              className="p-2 rounded-full border border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Email"
            >
              <EnvelopeSimple className="size-4" />
            </a>
          )}
        </div>
      </div>

      {/* Core Focus Areas */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Sparkle className="size-3 text-primary" />
          <span>Core Focus &amp; Specialization</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {FOCUS_AREAS.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-2xl ring-1 ring-foreground/10 bg-card p-5 flex flex-col justify-between space-y-3 hover:ring-foreground/25 transition-[box-shadow,ring-color] duration-200"
              >
                <div className="space-y-2.5">
                  <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="size-4.5" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Publications / Call to Action */}
      <div className="rounded-2xl ring-1 ring-foreground/10 bg-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Explore Articles &amp; Notes</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Read engineering deep dives, design system analyses, and architectural breakdowns.
          </p>
        </div>

        <Button
          render={
            <Link to="/blog">
              <span>Read Articles</span>
              <ArrowUpRight className="size-3.5 ml-1" />
            </Link>
          }
          size="sm"
          className="rounded-full px-4 h-8 text-xs font-medium cursor-pointer shrink-0"
        />
      </div>
    </main>
  );
}
