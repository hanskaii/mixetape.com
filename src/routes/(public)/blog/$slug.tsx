import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { PencilSimple as Edit3, Eye } from "@phosphor-icons/react";
import { db } from "#/database/index";
import { posts, bookmarks, user } from "#/database/schema";
import { eq, and, or } from "drizzle-orm";
import { auth } from "#/modules/auth/auth.server";
import { getPostViews } from "#/modules/analytics/analytics.service";
import { Route as RootRoute } from "#/routes/__root";
import { Button } from "#/components/ui/button";
import { BookmarkButton } from "./-components/bookmark-button";
import { SocialShare } from "./-components/social-share";
import { TableOfContents, extractHeadings } from "./-components/table-of-contents";
import { AuthorCard } from "./-components/author-card";
import { ArticleContent } from "./-components/article-content";
import { siteConfig } from "#/config/site";

export const getBlogPostBySlug = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const headers = getRequestHeaders();

    const post = await db.query.posts.findFirst({
      where: eq(posts.slug, slug),
    });

    if (!post) return null;

    const session = headers ? await auth.api.getSession({ headers }).catch(() => null) : null;

    // Drafts are visible to their owner only. Reported as not-found rather than
    // forbidden so the response does not confirm the slug exists.
    if (post.status !== "published" && post.userId !== session?.user?.id) return null;

    let isBookmarked = false;
    let currentUserId: string | null = null;
    let canEdit = false;

    if (session?.user) {
      currentUserId = session.user.id;
      const existing = await db.query.bookmarks.findFirst({
        where: and(eq(bookmarks.userId, session.user.id), eq(bookmarks.postId, post.id)),
      });
      isBookmarked = !!existing;

      // Ownership only. Display name and authorUsername are presentation fields
      // the user controls, so they are not identity.
      canEdit = post.userId === session.user.id;
    }

    // Fetch author profile and dynamic views in parallel
    const [authorUser, calculatedViews] = await Promise.all([
      db.query.user.findFirst({
        where: or(eq(user.name, post.authorUsername || post.author), eq(user.id, post.userId)),
      }),
      getPostViews(post),
    ]);

    return {
      post: {
        ...post,
        views: calculatedViews,
      },
      isBookmarked,
      currentUserId,
      canEdit,
      authorUser: authorUser || {
        id: post.authorUsername || siteConfig.author.handle,
        name: post.author,
        email: `${post.authorUsername || siteConfig.author.handle}@example.com`,
        bio: siteConfig.author.bio,
        image: null,
      },
    };
  });

export const Route = createFileRoute("/(public)/blog/$slug")({
  loader: async ({ params }) => {
    const data = await getBlogPostBySlug({ data: params.slug });
    if (!data) {
      throw notFound();
    }
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: `Article Not Found | ${siteConfig.name}` }],
      };
    }

    const { post } = loaderData;
    const cleanDesc = (post.excerpt || post.content.replace(/<[^>]+>/g, " ").slice(0, 155)).trim();
    const canonicalUrl = `${siteConfig.url}/blog/${post.slug}`;
    const formattedDate = dayjs(post.createdAt).format("MMM D, YYYY");
    const tagList = (post.tags || "General")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const ogImageUrl = `/api/og?title=${encodeURIComponent(
      post.title,
    )}&tags=${encodeURIComponent(tagList.join(","))}&author=${encodeURIComponent(
      post.author,
    )}&date=${encodeURIComponent(formattedDate)}`;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: cleanDesc,
      image: `${siteConfig.url}${ogImageUrl}`,
      author: {
        "@type": "Person",
        name: post.author,
        url: `${siteConfig.url}/@${post.authorUsername || siteConfig.author.handle}`,
      },
      datePublished: new Date(post.createdAt).toISOString(),
      dateModified: new Date(post.updatedAt).toISOString(),
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalUrl,
      },
    };

    return {
      meta: [
        { title: `${post.title} | ${siteConfig.name}` },
        { name: "description", content: cleanDesc },
        { name: "author", content: post.author },
        {
          name: "robots",
          content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
        },
        // Open Graph
        { property: "og:title", content: post.title },
        { property: "og:description", content: cleanDesc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonicalUrl },
        { property: "og:image", content: ogImageUrl },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:type", content: "image/png" },
        {
          property: "article:published_time",
          content: new Date(post.createdAt).toISOString(),
        },
        { property: "article:author", content: post.author },
        // Twitter
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: post.title },
        { name: "twitter:description", content: cleanDesc },
        { name: "twitter:image", content: ogImageUrl },
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(jsonLd),
        },
      ],
    };
  },
  component: BlogPostDetail,
});

function recordArticleView(postId: number | string, slug: string) {
  try {
    const payload = JSON.stringify({
      slug,
      postId,
      eventType: "view",
      url: typeof window !== "undefined" ? window.location.href : "",
      referer: typeof document !== "undefined" ? document.referrer : "",
    });

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/track", blob);
    }
  } catch {}
}

function BlogPostDetail() {
  const { post, isBookmarked, authorUser, canEdit } = Route.useLoaderData();
  const { session } = RootRoute.useRouteContext();
  const isAuthenticated = !!session?.user;
  const [readingProgress, setReadingProgress] = useState(0);

  // Scroll reading progress calculation
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight <= 0) {
        setReadingProgress(100);
        return;
      }
      const currentScroll = window.scrollY;
      const progress = Math.min(100, Math.max(0, (currentScroll / totalHeight) * 100));
      setReadingProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Telemetry: record article page view
  useEffect(() => {
    recordArticleView(post.id, post.slug);
  }, [post.id, post.slug]);

  const canonicalUrl = `${siteConfig.url}/blog/${post.slug}`;
  const formattedDate = dayjs(post.createdAt).format("MMM D, YYYY");
  const tagList = (post.tags || "General")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const ogImageUrl = `/api/og?title=${encodeURIComponent(
    post.title,
  )}&tags=${encodeURIComponent(tagList.join(","))}&author=${encodeURIComponent(
    post.author,
  )}&date=${encodeURIComponent(formattedDate)}`;

  const { headings, htmlWithIds } = extractHeadings(post.content);

  return (
    <div className="relative w-full">
      {/* Top Edge Reading Progress Indicator */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-transparent pointer-events-none"
      >
        <div
          className="h-full bg-primary transition-[width] duration-150 ease-out"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* Floating TOC on Desktop */}
      {headings.length > 0 && (
        <div className="hidden xl:block absolute top-28 left-[calc(100%+2rem)] h-full">
          <div className="sticky top-24">
            <TableOfContents content={post.content} />
          </div>
        </div>
      )}

      <main className="space-y-6 px-4 py-8 md:py-12">
        {/* Back Navigation & Action Bar */}
        <div className="flex items-center justify-between gap-2">
          <Link
            to="/blog"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium transition-colors"
          >
            &larr; Back to Articles
          </Link>

          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                render={
                  <Link to="/blog/$slug/edit" params={{ slug: post.slug }}>
                    <Edit3 className="size-3 text-muted-foreground" />
                    <span>Edit</span>
                  </Link>
                }
                size="xs"
                variant="outline"
                className="h-7 px-3 rounded-full text-xs gap-1.5 font-medium"
              />
            )}
            <BookmarkButton
              postId={post.id}
              initialBookmarked={isBookmarked}
              isAuthenticated={isAuthenticated}
            />
            <SocialShare title={post.title} url={canonicalUrl} />
          </div>
        </div>

        <article className="space-y-6">
          {/* Header Hero Area */}
          <header className="space-y-3 border-b border-border/60 pb-6">
            {/* Tags Badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {tagList.map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground ring-1 ring-foreground/10"
                >
                  #{tag}
                </span>
              ))}
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
              {post.title}
            </h1>

            {/* Excerpt if present */}
            {post.excerpt && (
              <p className="text-sm text-muted-foreground leading-relaxed italic">
                "{post.excerpt}"
              </p>
            )}

            {/* Author info, date & view metrics */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground font-mono pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <time dateTime={dayjs(post.createdAt).toISOString()}>{formattedDate}</time>
                <span>•</span>
                <span className="text-foreground font-medium">By {post.author}</span>
                <span>•</span>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Eye className="size-3.5" />
                  <span>{post.views || 0} views</span>
                </div>
              </div>
              <span>
                ~{Math.max(1, Math.ceil(post.content.split(/\s+/).length / 200))} min read
              </span>
            </div>
          </header>

          {/* Dynamic Cover Image */}
          <div className="rounded-2xl overflow-hidden ring-1 ring-foreground/10 shadow-xs aspect-[1200/630] bg-muted/40 relative">
            <img src={ogImageUrl} alt={post.title} className="w-full h-full object-cover" />
          </div>

          {/* Mobile Table of Contents */}
          {headings.length > 0 && (
            <div className="xl:hidden">
              <TableOfContents content={post.content} />
            </div>
          )}

          {/* Main Article Content with Rendered Code Highlighting & Copy Buttons */}
          <div className="w-full">
            <ArticleContent html={htmlWithIds} />
          </div>

          {/* Author Bio Footer Card */}
          <div className="pt-6 border-t border-border/60 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              About the Author
            </h3>
            <AuthorCard
              name={authorUser.name || post.author}
              username={post.authorUsername || siteConfig.author.handle}
              avatar={authorUser.image}
              bio={authorUser.bio}
            />
          </div>

          {/* Post Navigation Footer */}
          <footer className="pt-4 border-t border-border/60 flex items-center justify-between">
            <Link
              to="/blog"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <span>&larr; Back to all articles</span>
            </Link>
            <Button
              render={<Link to="/blog">Browse More Articles</Link>}
              variant="outline"
              size="sm"
              className="rounded-full h-8 px-4 text-xs font-medium"
            />
          </footer>
        </article>
      </main>
    </div>
  );
}
