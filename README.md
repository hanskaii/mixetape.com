# Kit — Modern Cloudflare Edge Starter

> Production-ready fullstack starter kit powered by **TanStack Start**, **Cloudflare Workers**, **Cloudflare D1 (SQLite)**, **Drizzle ORM**, **Better-Auth**, and **Tailwind CSS v4**.

Designed to run **100% on Cloudflare's Free Tier** with zero complex external pipelines or paid plan locks.

---

## ⚡ Tech Stack & Architecture

- **Framework**: [TanStack Start](https://tanstack.com/start) with full isomorphic SSR and file-based routing via TanStack Router.
- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/) (Workerd edge runtime with `nodejs_compat`).
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (Serverless distributed SQLite at the edge).
- **ORM & Migrations**: [Drizzle ORM](https://orm.drizzle.team/) with Drizzle Kit.
- **Authentication**: [Better-Auth](https://www.better-auth.com/) with email OTP (passwordless), two-factor authentication (2FA), and GitHub OAuth.
- **Cache & Telemetry**: Cloudflare KV for high-speed edge session caching and lightweight article view tracking.
- **Object Storage**: Cloudflare R2 for user-uploaded media and article assets.
- **Editor**: [TipTap](https://tiptap.dev/) WYSIWYG editor with syntax highlighting, Markdown support, and table formatting.
- **Dynamic OG Cards**: Real-time server-rendered social share images powered by `@takumi-js/response` WASM.
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with semantic theme tokens and zero-FOUC theme switching.
- **AI & MCP Protocol**: Native [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server at `/api/posts/mcp` for agentic content publishing and in-editor AI writing assistant.

---

## 📁 Project Structure

```
kit/
├── src/
│   ├── components/            # UI components
│   │   ├── layouts/           # App header, footer, user menus
│   │   ├── providers/         # Modals and query client providers
│   │   └── ui/                # Shared design primitives (Button, Input, Modal, etc.)
│   ├── config/
│   │   └── site.ts            # Centralized site branding & metadata
│   ├── database/
│   │   ├── schema.ts          # Drizzle D1 SQLite table definitions
│   │   ├── index.ts           # D1 client proxy
│   │   └── migrations/        # SQL migration files
│   ├── modules/               # Domain feature modules
│   │   ├── analytics/         # Post view tracking & dashboard telemetry
│   │   ├── auth/              # Better-Auth server, client, and session loaders
│   │   ├── og/                # Clean default social card generator (@takumi-js/response)
│   │   ├── posts/             # Post creation, slugify, markdown/HTML parsers
│   │   └── storage/           # R2 media asset uploads and management
│   ├── routes/                # TanStack Start file-based routes
│   │   ├── (public)/          # Public routes: landing page, blog, about
│   │   ├── (app)/             # Authenticated workspace: dashboard, settings
│   │   ├── api/               # Endpoints: auth, og image, MCP server, ai chat
│   │   └── __root.tsx         # Root document & router context
│   └── server.ts              # Worker entrypoint & fetch handler
├── .dev.vars.example          # Local environment secrets template
├── package.json               # Scripts & dependencies
├── vite.config.ts             # Vite + Cloudflare + TanStack Start configuration
└── wrangler.jsonc             # Cloudflare bindings: D1, KV, R2, Email
```

---

## 🚀 Quickstart

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Local Environment

Copy the example development variables:

```bash
cp .dev.vars.example .dev.vars
```

Update `.dev.vars` with your own values (or use the defaults for local testing).

### 3. Initialize Local D1 Database

Generate and apply database migrations to your local Miniflare instance:

```bash
pnpm db:migrate
```

### 4. Start Development Server

```bash
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## 🎨 Rebranding & Customization

All site branding, metadata, navigation, and author details are centralized in a single file:

```ts
// src/config/site.ts
export const siteConfig = {
  name: "Kit",
  title: "Kit | Modern Cloudflare Edge Starter",
  description: "Production-ready fullstack starter powered by TanStack Start and Cloudflare Workers.",
  url: process.env.SITE_URL || "http://localhost:3001",
  author: {
    name: "Admin",
    handle: "admin",
    bio: "Fullstack developer and systems builder.",
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
```

Updating this configuration automatically updates the landing page, navigation header, footer, SEO metadata, JSON-LD schemas, and dynamic OG images.

---

## 🔑 Authentication (Better-Auth)

Kit uses [Better-Auth](https://www.better-auth.com/) configured with the Drizzle D1 adapter:

- **Passwordless Email OTP**: In local development, verification codes are logged directly to the server terminal. In production, configure Cloudflare Email Routing or a transactional email provider.
- **GitHub OAuth**: Provide `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.dev.vars` (or as secrets in Cloudflare) to enable one-click social login.
- **Two-Factor Authentication (2FA)**: Built-in TOTP authenticator app support with QR codes and recovery keys.

---

## 🤖 Model Context Protocol (MCP) Server

Kit includes a built-in MCP server at `/api/posts/mcp` allowing AI agents (like Claude Desktop or autonomous pipelines) to query and publish articles programmatically:

1. Configure `MCP_API_KEY` in your `.dev.vars` or Cloudflare Worker secrets.
2. In Claude Desktop or your MCP client, configure the HTTP SSE endpoint:
   ```json
   {
     "mcpServers": {
       "kit-blog": {
         "type": "http",
         "url": "https://your-worker-domain.workers.dev/api/posts/mcp",
         "headers": {
           "Authorization": "Bearer your-mcp-api-key"
         }
       }
     }
  }
   ```
3. Your agent will now have access to tools: `list_articles`, `get_article`, and `create_post`.

---

## 🚢 Deployment to Cloudflare Workers

### 1. Provision Cloudflare D1 Database

```bash
npx wrangler d1 create kit-db
```

Copy the generated `database_id` into `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DATABASE",
    "database_name": "kit-db",
    "database_id": "<YOUR_D1_DATABASE_ID>",
    "migrations_dir": "src/database/migrations"
  }
]
```

### 2. Apply Migrations to Remote D1

```bash
npx wrangler d1 migrations apply kit-db --remote
```

### 3. Set Production Secrets

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
npx wrangler secret put SITE_URL
npx wrangler secret put MCP_API_KEY
```

### 4. Build and Deploy

```bash
pnpm run deploy
```

---

## 🛠️ CLI Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start local Vite development server with Cloudflare proxy |
| `pnpm build` | Compile client and SSR edge bundles for production |
| `pnpm check` | Run TypeScript type checks (`tsc --noEmit`), oxlint, and oxfmt format check |
| `pnpm fix` | Automatically fix linting and formatting issues |
| `pnpm test` | Run Vitest unit tests |
| `pnpm db:generate` | Generate new SQL migration files from Drizzle schema |
| `pnpm db:migrate` | Apply pending Drizzle migrations |
| `pnpm cf-typegen` | Regenerate typesafe Cloudflare Worker binding types |

---

## 📄 License

MIT. Use this starter kit freely for personal and commercial projects.
