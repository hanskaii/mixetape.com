export const siteConfig = {
  name: "mixetape",
  title: "mixetape | Schedule videos to your social channels",
  description:
    "Upload once, pick a time, and mixetape posts it to your channels — through your own credentials, with an API for your pipelines.",
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
    { label: "Publish", href: "/publish" },
    { label: "Channels", href: "/channels" },
  ],
};

export type SiteConfig = typeof siteConfig;
