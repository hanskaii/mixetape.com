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
      { label: "Concepts", autogenerate: { directory: "concepts" } },
      { label: "Agents (MCP)", autogenerate: { directory: "agents" } },
      {
        label: "REST API",
        items: ["rest-api", { label: "API reference", link: "/api" }],
      },
      { label: "Platforms", autogenerate: { directory: "platforms" } },
    ],
  },
});

export default defineConfig({
  // No landing page: the docs open on their introduction.
  redirects: {
    "/": "/introduction",
    // Pages that moved when agents (MCP) and the REST API got their own sections.
    "/tools": "/agents/tools",
    "/tips": "/agents/tips",
    "/connect-an-agent/mcp": "/agents",
    "/connect-an-agent/claude-code": "/agents/claude-code",
    "/connect-an-agent/codex": "/agents/codex",
    "/connect-an-agent/cursor": "/agents/cursor",
    "/connect-an-agent/opencode": "/agents/opencode",
    "/connect-an-agent/rest-api": "/rest-api",
  },
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
