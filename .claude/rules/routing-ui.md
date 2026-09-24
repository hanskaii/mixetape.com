# Routing & UI Standards (TanStack Start)

## 1. Route Layout Separation

Organize routes by access boundaries:

```
src/routes/
├── (public)/              # Public-facing subtree (no session required)
│   ├── blog/
│   │   ├── -components/   # UI used only in blog
│   │   ├── -fn/           # Server functions for blog
│   │   ├── -lib/          # Types & formatters for blog
│   │   ├── $slug.tsx
│   │   └── index.tsx
│   ├── about.tsx
│   └── index.tsx
├── (app)/                 # Authenticated application subtree
│   └── _app/
│       ├── dashboard/
│       │   ├── -components/
│       │   ├── -fn/
│       │   ├── -lib/
│       │   └── index.tsx
│       └── settings/
│           ├── -components/
│           ├── -fn/
│           └── index.tsx
└── api/                   # REST endpoints & webhooks
```

## 2. File Co-location (`-` Prefix = Non-Route)

Route-specific code is co-located, not dumped in top-level `components/` or `lib/`:

- `-components/`: Private React UI components (dialogs, tables, cards, filters).
- `-fn/`: Domain-scoped `createServerFn` queries and mutations.
- `-lib/`: View-specific helpers, formatters, table configs.
- Top-level `src/components/ui/` is strictly for shared atomic design primitives (Button, Input, Modal, Card, Map).

## 3. Top-Level `src/components/` Layout & UI

Structure shared components cleanly:

```
src/components/
├── layouts/               # The single app shell (header, sidebar, nav primitives)
└── ui/                    # Shared design system primitives + utils.ts (cn)
```

## 4. TanStack Start Data Loading & Caching Strategies

- **Thin Route Entrypoints**: `index.tsx` / `$slug.tsx` handle loader wiring, head tags, and high-level layout composition only.
- **Loader Queries via `createServerFn`**: Fetch only data needed for initial render.
- **Parallel Fetching**: Use `Promise.all` inside server functions for independent data dependencies.
- **Granular Streaming / Defer**: Defer non-critical data using `defer()` from `@tanstack/react-router` when loading expensive telemetry or third-party stats.
- **Type-Safe Search Params**: Validate URL search parameters using `validateSearch` with Zod or primitive parsers at route definition.

## 5. Server Functions (`createServerFn`) vs API Endpoints (`src/routes/api/*`)

Latensi `createServerFn` sama persis dengan `api/` (keduanya jalan sebagai HTTP handler di Cloudflare Worker edge). Beda peruntukan:

1. **`createServerFn` (Internal App RPC)**:
   - Khusus UI app internal.
   - Loader route, SSR hydration, form mutation.
   - Type-safe otomatis end-to-end tanpa nulis fetcher/DTO manual.
2. **`api/*` (External & Raw HTTP Protocol)**:
   - External consumer & auth webhook (Better-Auth handler, cron worker).
   - Response non-JSON / streaming binary (OG image WASM/PNG, RSS XML, sitemap).
   - Telemetry beacon (`navigator.sendBeacon` buat analytics).
   - Public REST & MCP endpoint.

**Aturan**: Data fetching & action komponen UI wajib pakai `createServerFn`. Protokol raw / integrasi luar pakai `api/*`.

## 6. Server Functions (`createServerFn`) Discipline

- Never declare `createServerFn` inside React component render bodies.
- Always declare server functions at module level inside `-fn/` or dedicated feature services.
- Validate input payloads explicitly: `.validator((data: unknown) => ...)`
- Extract and validate auth sessions on server:
  ```ts
  import { auth } from "#/modules/auth/auth.server";
  import { getRequestHeaders } from "@tanstack/react-start/server";

  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) throw new Error("Unauthorized");
  ```

## 7. UI & Design System

- Shared design primitives live in `src/components/ui/` (Button, Input, Modal, Map, Card).
- UI utility helpers (`cn`) live directly in `src/components/ui/utils.ts`.
- Tailwind CSS v4 styling: use semantic theme tokens (`bg-card`, `text-foreground`, `border-border`, `bg-primary`).
- Avoid raw HTML/script string injection; use React hooks (`useEffect`) and `navigator.sendBeacon` for client beacons.
