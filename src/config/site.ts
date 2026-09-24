export const siteConfig = {
  name: "Kit",
  title: "Kit | Modern Cloudflare Edge Starter",
  description:
    "Production-ready fullstack starter powered by TanStack Start, Better-Auth, Cloudflare D1, Drizzle ORM, and Tailwind CSS v4.",
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
    { label: "Blog", href: "/blog" },
    { label: "About", href: "/about" },
  ],
};

export type SiteConfig = typeof siteConfig;
