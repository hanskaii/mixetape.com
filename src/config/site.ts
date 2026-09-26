export const siteConfig = {
  name: "mixetape",
  title: "mixetape | Schedule YouTube videos on your time",
  description:
    "Queue a YouTube video, choose when it goes live, and track every post. Use your own credentials or connect a scheduling pipeline through the API.",
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
