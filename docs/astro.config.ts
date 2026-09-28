import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import nimbus, {
  defineConfig as defineNimbusConfig,
} from "@cloudflare/nimbus-docs";
import { tableScroll } from "@cloudflare/nimbus-docs/markdown";

const nimbusConfig = defineNimbusConfig({
  site: "https://docs.mixetape.com",
  title: "mixetape",
  description:
    "Docs for mixetape, the agent-first social scheduler: connect an agent over MCP or REST, schedule posts, and manage them once they are live.",
  locale: "en",
  github: null,
  socialImageAlt: "mixetape documentation",
  // The REST reference, generated from the app's own OpenAPI document
  // (`pnpm openapi:sync` refreshes it from https://mixetape.com/api/v1/openapi.json).
  api: [{ collection: "api", spec: "./src/api/openapi.json", label: "mixetape API" }],
  // The reading order; each group still follows its pages' `sidebar.order`.
  sidebar: {
    items: [
      "introduction",
      "quickstart",
      "tips",
      { label: "Concepts", autogenerate: { directory: "concepts" } },
      { label: "Connect an agent", autogenerate: { directory: "connect-an-agent" } },
      "tools",
      { label: "Platforms", autogenerate: { directory: "platforms" } },
      { label: "API reference", link: "/api", icon: "ph:code" },
    ],
  },
});

export default defineConfig({
  // No landing page: the docs open on their introduction.
  redirects: { "/": "/introduction" },
  // nimbus:adapter
  output: "static",
  // Tailwind v4 via its Vite plugin (the integration Astro recommends for
  // Tailwind v4 — replaces the PostCSS plugin, which doesn't build under
  // Astro 7's Vite 8 bundler).
  vite: {
    plugins: [tailwindcss()],
  },
  // Hover-prefetch link targets so full-page navigations feel instant without
  // a client-side router.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },
  integrations: [
    nimbus(nimbusConfig, {
      // Authoring rules are opt-in by design — your repo, your taste. The
      // two below are the load-bearing pair: frontmatter has to validate
      // against the content schema for the page to render properly, and
      // broken internal links are 404s for your readers. Add the others
      // (heading hierarchy, code-block language, style, etc.) when you're
      // ready to enforce them — see `nimbus-docs lint --help`.
      rules: {
        "nimbus/frontmatter-shape": "error",
        "nimbus/internal-link": "error",
      },
      // Wrap wide tables so they scroll instead of overflowing the page
      // (styled by `.nb-table-scroll` in src/styles/prose.css).
      markdown: {
        hastPlugins: [tableScroll()],
      },
    }),
  ],
});
