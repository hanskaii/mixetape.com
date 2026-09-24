# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Primary:** Senior engineering peers, technical recruiters, clients, and systems builders evaluating hanssn's technical depth, edge systems projects, and engineering writing.
- **Secondary:** Developers exploring modern, high-performance edge application patterns (TanStack Start + Cloudflare Workers stack).

## Product Purpose
Dual-purpose personal platform serving as hanssn's high-performance edge blog, portfolio, and author dashboard, while cleanly engineered as an edge starter kit.

## Positioning
An edge-native, minimalist, ultra-fast personal platform demonstrating distributed systems, edge SQLite (D1), R2 media storage, WASM OpenGraph rendering, and full-stack TanStack Start architecture in practice.

## Operating Context
- Deployed on Cloudflare Workers edge runtime with minimal latency worldwide.
- Authoring and reading environment: technical essays, systems writeups, interactive code blocks, math/tables, and live telemetry dashboards.
- Content managed directly via an integrated author studio with TipTap editor and R2 media management.

## Capabilities and Constraints
- **Stack & Architecture:** TanStack Start (React 19), TanStack Router, TanStack Query, Tailwind CSS v4, Base UI / Shadcn primitives, Phosphor Icons.
- **Backend & Persistence:** Cloudflare Workers, D1 SQLite (Drizzle ORM), R2 Object Storage, Better Auth (Email OTP).
- **Edge Media & OG:** Takumi WASM-based on-the-fly dynamic OpenGraph image generation.
- **Telemetry:** Real-time visitor analytics, performance metrics, and telemetry dashboard.
- **Constraints:** Fully serverless/edge runtime execution; tight bundle budgets; strict TypeScript, Oxlint, and Oxfmt checks.

## Brand Commitments
- **Name/Handle:** hanssn / `@hanssn`
- **Voice:** Dense, technical, precise, authentic systems builder; concise and substance-focused.
- **Aesthetic baseline:** Clean, high-density, typography-driven with Geist and Geist Mono, understated craft.

## Evidence on Hand
- Live routes: `/(public)` (Home, About, Blog), `/(app)` (Dashboard, OG Generator, Settings/Profile).
- Database schema: `src/database/schema.ts` (Posts, Users, Sessions, Telemetry, Media).
- Configured Cloudflare bindings: `wrangler.jsonc` (D1, R2, KV).

## Product Principles
1. **Edge-First Speed & Simplicity:** Everything renders and serves near-instantaneously at the edge with zero bloat.
2. **Technical Substance Over Hype:** Design, copy, and features reflect genuine systems craftsmanship and high information density.
3. **Seamless Author & Reader Experience:** Distraction-free reading typography paired with functional authoring and telemetry tools.
4. **Production Cleanliness:** Strict typing, fast tooling, robust database migrations, and clean component architecture.
