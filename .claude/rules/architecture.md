# Architecture & Modularity Rules

## 1. Directory Structure Standards

```
src/
├── database/                  # D1 schema, client connection, migrations
│   ├── schema.ts
│   └── index.ts
├── modules/<feature>/         # Domain features & Cloudflare primitives
│   ├── auth/                  # auth.server.ts, auth-client.ts, auth.fn.ts
│   ├── analytics/             # analytics.service.ts
│   ├── counter/               # counter.object.ts
│   ├── sample/                # sample.workflow.ts
│   └── cron/                  # audit.scheduled.ts
├── routes/                    # Web UI (TanStack Start file-routing)
│   ├── (public)/              # Public-facing routes (marketing, blog, landing)
│   │   ├── blog/
│   │   │   ├── -components/
│   │   │   ├── -fn/
│   │   │   ├── -lib/
│   │   │   ├── $slug.tsx
│   │   │   └── index.tsx
│   │   ├── about.tsx
│   │   └── index.tsx
│   ├── (app)/                 # Authenticated / workspace application routes
│   │   └── _app/
│   │       ├── dashboard/
│   │       │   ├── -components/   # Used only by this subtree
│   │       │   ├── -fn/           # Server functions (createServerFn)
│   │       │   ├── -lib/          # Local utils & configs
│   │       │   └── index.tsx
│   │       └── settings/
│   │           ├── -components/
│   │           ├── -fn/
│   │           └── index.tsx
│   └── api/                   # HTTP REST endpoints
├── components/
│   ├── layouts/               # App shell (header, sidebar, navigation primitives)
│   └── ui/                    # Shared design system primitives + utils.ts (cn)
└── server.ts                  # Root Cloudflare Worker entrypoint
```

## 2. Cloudflare Primitives Placement

Every Cloudflare Worker primitive MUST live inside its domain feature folder under `src/modules/<feature>/`:

| Primitive       | File Pattern             | Export / Shape                       |
| --------------- | ------------------------ | ------------------------------------ |
| Durable Object  | `<feature>.object.ts`    | `class X extends DurableObject`      |
| Workflow        | `<feature>.workflow.ts`  | `class X extends WorkflowEntrypoint` |
| Cron Trigger    | `<feature>.scheduled.ts` | `async (event, env, ctx) => ...`     |
| Queue Consumer  | `<feature>.consumer.ts`  | `async (batch, env, ctx) => ...`     |
| Service / Logic | `<feature>.service.ts`   | Pure functions / storage calls       |

Root `src/server.ts` only re-exports and wires handlers:

```ts
export { CounterDO } from "./modules/counter/counter.object";
export { SampleWorkflow } from "./modules/sample/sample.workflow";
```

## 3. Web UI & File Co-location (`-` Prefix = Non-Route)

Route-specific code is co-located, not dumped in top-level `components/` or `lib/`:

```
routes/(app)/_app/posts/
├── -components/   # UI components used only by this subtree
├── -fn/           # Server functions (createServerFn) used only by this subtree
├── -lib/          # Utils, types, column defs used only by this subtree
└── index.tsx      # Thin route entrypoint
```

- `-components/`: Private React components rendered exclusively within that route branch.
- `-fn/`: TanStack `createServerFn` actions and queries scoped to that route.
- `-lib/`: View-specific utilities, table column definitions, formatters.
- Top-level `src/components/ui/` is strictly for shared atomic design primitives (Button, Input, Dialog, Card, Map).

## 4. Top-Level `src/components/` Organization

- `src/components/layouts/`: The single app shell layout (header, sidebar, navigation primitives).
- `src/components/ui/`: Atomic UI components (Button, Modal, Input, Card, Map, utils.ts).

## 5. Anti-Patterns & Prohibitions

1. **No generic `src/lib/` or `src/utils/` folder at root**: Put domain logic in `src/modules/<feature>/` and UI utils in `src/components/ui/utils.ts`.
2. **No root `src/db/`**: Use `src/database/` exclusively.
3. **No bloated single-file pages**: Keep route files thin by delegating server actions to `-fn/` and UI tabs/dialogs to `-components/`.
