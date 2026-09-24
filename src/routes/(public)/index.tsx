import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import dayjs from "dayjs";
import { desc, eq } from "drizzle-orm";
import {
  ArrowUpRight,
  EnvelopeSimple,
  GithubLogo,
  XLogo,
  LinkedinLogo,
} from "@phosphor-icons/react";
import { db } from "#/database/index";
import { posts } from "#/database/schema";
import { Button } from "#/components/ui/button";
import { siteConfig } from "#/config/site";

export const getHomeData = createServerFn({ method: "GET" }).handler(async () => {
  const recentPosts = await db.query.posts.findMany({
    where: eq(posts.status, "published"),
    orderBy: [desc(posts.createdAt)],
    limit: 10,
  });
  return { recentPosts };
});

export const Route = createFileRoute("/(public)/")({
  loader: async () => await getHomeData(),
  head: () => ({
    meta: [
      { title: siteConfig.title },
      {
        name: "description",
        content: siteConfig.description,
      },
      { property: "og:title", content: siteConfig.title },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content: `/api/og?title=${encodeURIComponent(siteConfig.name)}&tags=Fullstack,Cloudflare,TanStack&author=${encodeURIComponent(siteConfig.author.name)}`,
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { recentPosts } = Route.useLoaderData();

  return (
    <main className="space-y-8 px-4 py-6 md:py-8">
      {/* 1. Hero Sky Banner Card */}
      <section className="relative w-full">
        <div className="relative w-full h-44 sm:h-48 md:h-52 overflow-hidden rounded-[24px] border border-border/70 shadow-xs">
          {/* Light Sky Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-sky-400/40 via-sky-200/30 to-sky-100/10 dark:opacity-0 transition-opacity duration-700" />
          {/* Light Mode Fluffy Cloud Accents */}
          <div className="absolute -bottom-8 -left-6 size-36 rounded-full bg-white/70 blur-2xl dark:hidden pointer-events-none" />
          <div className="absolute -bottom-6 right-8 size-44 rounded-full bg-white/80 blur-2xl dark:hidden pointer-events-none" />
          <div className="absolute top-6 left-1/3 size-28 rounded-full bg-white/40 blur-xl dark:hidden pointer-events-none" />
          <div className="absolute top-10 right-1/4 size-32 rounded-full bg-sky-200/50 blur-xl dark:hidden pointer-events-none" />

          {/* Dark Sky Background */}
          <div className="absolute inset-0 opacity-0 dark:opacity-100 bg-[#02000a] [background-image:radial-gradient(circle_at_top_right,rgba(121,68,154,0.3),transparent_70%),radial-gradient(circle_at_20%_80%,rgba(41,196,255,0.18),transparent_70%)] transition-opacity duration-700 pointer-events-none" />

          {/* Dark Mode Ambient Stars */}
          <div className="absolute inset-0 opacity-0 dark:opacity-100 transition-opacity duration-700 pointer-events-none">
            <span className="absolute top-6 left-[15%] size-1 rounded-full bg-white/80 shadow-[0_0_6px_#fff]" />
            <span className="absolute top-12 left-[28%] size-0.5 rounded-full bg-white/60" />
            <span className="absolute top-8 right-[22%] size-1 rounded-full bg-cyan-200/90 shadow-[0_0_8px_#38bdf8]" />
            <span className="absolute top-16 right-[38%] size-0.5 rounded-full bg-white/70" />
            <span className="absolute top-24 left-[45%] size-1 rounded-full bg-purple-200/80 shadow-[0_0_6px_#c084fc]" />
            <span className="absolute top-10 left-[75%] size-0.5 rounded-full bg-white/50" />
            <span className="absolute top-28 right-[12%] size-1 rounded-full bg-white/90 shadow-[0_0_5px_#fff]" />
            <span className="absolute top-32 left-[18%] size-0.5 rounded-full bg-white/60" />
            <span className="absolute top-20 right-[60%] size-0.5 rounded-full bg-white/50" />
          </div>
        </div>

        {/* Avatar and Status Badge Row */}
        <div className="flex items-end justify-between px-3 -mt-9 sm:-mt-10 relative z-10">
          <div className="size-18 sm:size-20 rounded-full bg-stone-950 border-4 border-background shadow-md flex items-center justify-center p-3.5 shrink-0">
            <img
              src={siteConfig.author.avatar}
              alt={`${siteConfig.name} logo`}
              className="size-full object-contain"
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 shadow-xs mb-1">
            <span className="size-1.5 rounded-full bg-primary" />
            <span>Available for work</span>
          </div>
        </div>

        {/* Profile Info & Bio */}
        <div className="px-2 pt-3 space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-baseline gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {siteConfig.author.name}
              </h1>
              <span className="text-xs font-mono text-muted-foreground">
                @{siteConfig.author.handle}
              </span>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>{siteConfig.author.bio}</p>
            </div>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-2 pt-0.5">
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
      </section>

      {/* 2. Articles Section */}
      <section className="space-y-4 border-t pt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Articles ({recentPosts.length})
          </h2>
          <Button
            render={
              <Link to="/blog" className="inline-flex items-center gap-1">
                <span>View all</span>
                <ArrowUpRight className="size-3" />
              </Link>
            }
            size="xs"
            variant="ghost"
          />
        </div>

        {recentPosts.length === 0 ? (
          <div className="p-6 text-center border rounded-lg border-dashed text-xs text-muted-foreground">
            No articles published yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recentPosts.map((post) => {
              const tagList = (post.tags || "General")
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
              const formattedDate = dayjs(post.createdAt).format("MMM D, YYYY");
              const ogThumb = `/api/og?title=${encodeURIComponent(
                post.title,
              )}&tags=${encodeURIComponent(tagList.join(","))}&author=${encodeURIComponent(
                post.author,
              )}&date=${encodeURIComponent(formattedDate)}`;

              return (
                <article
                  key={post.id}
                  className="rounded-2xl ring-1 ring-foreground/10 bg-card overflow-hidden flex flex-col justify-between group hover:ring-foreground/25 transition-[box-shadow,ring-color] duration-200"
                >
                  <Link
                    to="/blog/$slug"
                    params={{ slug: post.slug }}
                    className="block overflow-hidden aspect-[1200/630] border-b border-border/80 bg-muted/40 relative"
                  >
                    <img
                      src={ogThumb}
                      alt={post.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </Link>

                  <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs font-mono text-muted-foreground">
                        <span>{formattedDate}</span>
                        <span>@{post.authorUsername || post.author}</span>
                      </div>

                      <h3 className="text-sm font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                        <Link to="/blog/$slug" params={{ slug: post.slug }}>
                          {post.title}
                        </Link>
                      </h3>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {post.excerpt ||
                          post.content.replace(/<[^>]+>/g, " ").slice(0, 110) + "..."}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-border/60 flex items-center justify-between gap-1 text-xs">
                      <div className="flex items-center gap-1 flex-wrap overflow-hidden">
                        {tagList.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="bg-muted px-2 py-0.5 rounded-full text-[11px] text-muted-foreground font-mono"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>

                      <Button
                        render={
                          <Link to="/blog/$slug" params={{ slug: post.slug }}>
                            Read &rarr;
                          </Link>
                        }
                        size="xs"
                        variant="ghost"
                        className="rounded-full text-xs"
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
