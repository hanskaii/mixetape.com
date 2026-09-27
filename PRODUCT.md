# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Primary: AI agents acting for a creator or team.** Coding agents, assistants and pipelines (Claude Code routines, scripts, CI jobs) that produce content and need to schedule it: they discover channels, create posts, move or cancel them, tend them once live (details, playlists, captions, comments), and read the analytics to decide what to make next — through MCP or the REST API, without a person clicking through a dashboard.
- **Primary: the people who own the channels.** Solo creators, small studios and operators running several channels, often with more content than time. They connect channels once, set the rules, and use the workspace to see what is queued, what went out, and what needs attention.
- **Secondary: developers building content pipelines** who want a scheduling backend with real guarantees — durable jobs, retries, clear failure reasons — instead of writing platform uploads themselves.

## Product Purpose
mixetape is an agent-first social media scheduler. An agent (or a person) hands it a finished piece of media, a caption and a time; mixetape holds the post, publishes it to the connected channel at that time, and reports back — the way Buffer does for people, built so that agents are first-class users rather than an afterthought.

## Positioning
The scheduling layer for AI-made and pipeline-made content. Where other schedulers are dashboards with an API bolted on, mixetape is an API and MCP server with a dashboard for supervision: every action a person can take in the workspace, an agent can take with the same meaning, and every post stays visible, editable and cancellable until it goes out.

## Operating Context
- **Today:** YouTube (long videos and Shorts), through the user's own Google OAuth app, so the quota and the approval belong to them.
- **Roadmap** (not yet available — never shown as supported): Twitter/X, Instagram, LinkedIn, Facebook, TikTok, Bluesky, Threads, Pinterest and Google Business Profile. Each arrives as a provider behind the same post model, API and MCP tools, so agents do not change how they work when a platform is added.
- **How work arrives:** mostly from agents and scripts on a schedule (e.g. a weekly content routine that renders a video and queues its long form plus four Shorts); occasionally a person schedules or fixes something by hand.
- **Buffer-like holding:** a post waits in mixetape — still editable, movable and cancellable — until shortly before its time (`leadMinutes`, 30 by default for YouTube), then goes up private with a publish time, so the platform finishes processing HD before it goes live.
- **Runs at the edge:** a Cloudflare Worker; each post is a durable Workflow that can sleep for days, survive deploys and retry on its own.

## Capabilities and Constraints
- **Agent interfaces:** one tool registry served two ways — the MCP server at `/mcp` (Streamable HTTP, API-key auth) and REST at `/api/v1/tools/:name` — plus plain REST for accounts and posts. 21 tools in five permission groups: **read** (accounts, posts, insights, playlists, captions), **publish** (create, update, cancel, retry, thumbnail), **manage** (edit a live post, playlists, captions), **comments** (read, post, reply, moderate), **analytics** (per post: totals, retention, traffic sources; per channel: daily, top posts). A key sees only the tools its permissions allow.
- **Publishing:** media by public URL or upload (R2, multipart); YouTube title, description, category, tags, privacy, made-for-kids, language and localizations, custom thumbnail, playlists and captions applied right after upload, and a first comment posted once the video is public; post now or at a time; status `scheduled → publishing → uploaded → published`, or `failed` with the reason; retry and cancel.
- **Channels:** bring-your-own OAuth credentials (stored encrypted); connect a channel from a modal that opens the consent screen in a new tab and waits for it; tokens refresh on their own and a revoked channel is flagged for reconnection.
- **People:** sign-in with Google, GitHub or an email code; API keys (hashed, shown once) with per-key permissions; a workspace for Publish, Channels and API keys.
- **Stack:** TanStack Start (React 19) on Cloudflare Workers; D1 (Drizzle), R2, KV, Workflows; Base UI primitives styled with StyleX; Better Auth.
- **Providers:** each platform is a module of optional capabilities (status, thumbnails, editing, collections, captions, comments, analytics); mixetape offers exactly what a provider implements, so a new platform brings its features to the UI, REST and MCP at once.
- **Constraints:** platform quotas belong to the user's own app (YouTube: 10,000 Data API units a day per Google project — an upload is 1,600, a caption 400); YouTube's API cannot pin comments or set a Short's related video; one platform live today; no analytics warehouse — numbers come live from YouTube Analytics and lag two to three days.

## Brand Commitments
- **Name:** mixetape, always lowercase.
- **Voice:** calm, exact and quietly confident — the tone of a reliable piece of infrastructure. Speaks to agents and to the people supervising them. Plain words over buzzwords; say what happens, when, and what to do if it didn't.
- **Aesthetic baseline:** "a publishing desk with a pulse" (see DESIGN.md) — warm paper, clear ink typography, one yellow signal for the next action; Figtree, Instrument Serif accents, Geist Mono for times, keys and code.
- **Honesty:** only claim what works in this repository. Roadmap platforms are labelled as coming, never presented as live destinations.

## Evidence on Hand
- Routes: `/` (landing), `/publish`, `/channels`, `/api-keys`, `/settings/*`, `/connect/done`; API `/api/v1/accounts`, `/api/v1/posts`, `/api/v1/posts/:id`, `/api/connect/:provider`, `/api/media/upload`; MCP `/mcp`.
- Domain code: `src/modules/social/` — `social.service.ts`, `publish.workflow.ts`, `timing.ts`, `mcp.ts`, `providers/` (YouTube today; the provider interface is what new platforms implement).
- Schema: `src/database/schema.ts` — provider credentials, social accounts, social posts, API keys, users and sessions.
- Real use: three YouTube channels (Hans Explainer, Now Where, Memoria) scheduled weekly by agent routines through the MCP server and API, including custom thumbnails.

## Product Principles
1. **Agents are first-class users.** Anything the workspace can do, the API and MCP can do, with the same names, rules and errors. Responses say exactly what happened and what the agent can do next.
2. **People stay in control.** Nothing is sent early: posts are held until shortly before their time, remain editable and cancellable, and their status is always visible with a plain reason when something fails.
3. **Durable by default.** Every post is a job that survives restarts, retries transient errors on its own, never publishes twice, and ends in a clear state.
4. **Your credentials, your quota.** Channels connect through the user's own OAuth apps; mixetape never shares one app's quota or approval across customers.
5. **One model, many platforms.** A post, a schedule and a status mean the same thing on every platform; adding a platform adds a provider, not a new way of working.
6. **Honest surface.** The interface and the copy show what is real today and label what is coming.
