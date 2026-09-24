# Database & D1 Rules

## 1. Directory & Client Standards

- Single database directory: `src/database/` (`schema.ts`, `index.ts`).
- Prohibit creating root `src/db/`.
- Access D1 via `database(d1)` or proxy wrapper `db`.

## 2. Telemetry Isolation (Zero Analytics in D1)

- D1 Database is reserved strictly for transactional state: `user`, `session`, `account`, `organization`, `member`, `posts`, `bookmarks`, `cronLogs`.
- Prohibit storing write-heavy clickstream/view counters in D1 tables.
- Route all telemetry and read events to Cloudflare Pipelines + R2 Iceberg (`default.kit_events`).

## 3. Schema & Migrations

- Use snake_case for database table names, camelCase for TypeScript model identifiers.
- Primary keys: string UUID / nanoid for domain entities, text/integer as appropriate for SQLite.
- Generate migrations via Drizzle Kit (`npx drizzle-kit generate`).
- Run migrations via Wrangler D1 (`npx wrangler d1 migrations apply kit-db --remote`).
