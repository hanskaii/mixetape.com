# Cloudflare Edge & Runtime Rules

## 1. Cloudflare Pipelines & Telemetry

- Stream telemetry events directly to Cloudflare Pipelines binding (`env.EVENT_STREAM` / `env.KIT_ANALYTICS_STREAM`).
- Use the 16-field edge geo schema (`timestamp`, `event_type`, `slug`, `visitor_id`, `url`, `out`, `link_text`, `user_agent`, `referer`, `country`, `city`, `region`, `colo`, `latitude`, `longitude`, `timezone`).
- Destination sink: Apache Iceberg table on R2 Data Catalog (`r2-data-catalog` sink).
- Query serverless analytics via R2 SQL Engine REST API (`https://api.sql.cloudflarestorage.com/api/v1/accounts/${ACCOUNT_ID}/r2-sql/query/${BUCKET}`).

## 2. Typesafe Bindings (`cf-typegen`) & Local Secrets

- Strict typesafe bindings: Prohibit manual type assertions (`as unknown as Env`, `env as any`).
- Always run `npm run cf-typegen` (`wrangler types`) after updating `wrangler.jsonc` or `.dev.vars` to generate `worker-configuration.d.ts`.
- Local development secrets and variables MUST use `.dev.vars` (Wrangler standard), NOT `.env`.
- Access bindings directly via `import { env } from 'cloudflare:workers'` (e.g. `env.DATABASE`, `env.BUCKET`, `env.BETTER_AUTH_SECRET`).

## 3. Worker Primitives Placement

- All Cloudflare runtime primitives MUST reside within `src/modules/<feature>/`:
  - Durable Objects: `<feature>.object.ts` (subclass `DurableObject`).
  - Workflows: `<feature>.workflow.ts` (subclass `WorkflowEntrypoint`).
  - Cron Triggers: `<feature>.scheduled.ts` (handler function).
  - Queues: `<feature>.consumer.ts` (batch consumer).
- Re-export all classes and entrypoints from root `src/server.ts`.

## 4. Edge Runtime Constraints

- Use Web Standard APIs (`fetch`, `Request`, `Response`, `crypto.subtle`, `navigator.sendBeacon`).
- Avoid native Node.js modules unsupported by `nodejs_compat`.
