export const siteConfig = {
  name: "mixetape",
  title: "mixetape | Agent-first social media scheduling",
  description:
    "Let AI agents and pipelines schedule social posts through MCP or the API. mixetape holds each post, keeps it editable until it goes out, and reports back when it is live. YouTube today; X, Instagram, LinkedIn, TikTok and more coming.",
  url: process.env.SITE_URL || "http://localhost:3000",
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
    { label: "Queue", href: "/queue" },
    { label: "Channels", href: "/channels" },
  ],
};

export type SiteConfig = typeof siteConfig;
