export const siteConfig = {
  name: "mixetape",
  title: "mixetape | Agent-first social media scheduling",
  description:
    "Let AI agents schedule posts to YouTube, TikTok, Instagram, Facebook, Threads and Pinterest through MCP or a REST API — editable until they go out.",
  /** The share card (1200×630), served from public/. */
  ogImage: "/og.png",
  url: process.env.SITE_URL || "http://localhost:3000",
  contactEmail: "hanssn@mixetape.com",
  /** The documentation site (its own project, in docs/). */
  docsUrl: "https://docs.mixetape.com",
  /** Bump when the favicon's pixels change, so browsers that cache it by URL fetch the new one. */
  faviconVersion: 2,
  author: {
    name: "Admin",
    handle: "admin",
    bio: "Fullstack developer and systems builder building on modern edge architecture.",
    email: "hello@example.com",
    avatar: "/favicon.svg",
    socials: {
      github: "https://github.com",
      x: "https://x.com",
      linkedin: "https://linkedin.com",
    },
  },
  nav: [
    { label: "Publish", href: "/publish" },
    { label: "Channels", href: "/channels" },
  ],
};

export type SiteConfig = typeof siteConfig;
