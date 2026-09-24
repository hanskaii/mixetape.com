# mixetape

Schedule videos to your social channels — a small, Buffer-like publisher on Cloudflare's
edge. YouTube is the first platform; the provider layer is built for more.

Live at **https://mixetape.com**. Built on the [kit](https://github.com/tanshipkit/kit)
starter (TanStack Start, Better-Auth, D1 + Drizzle, R2, Tailwind v4).

## How it works

| Piece | What it is |
|---|---|
| **Credential** | The OAuth app a user brings (their Google client ID + secret). Stored AES-GCM encrypted. The quota and the approval stay with the user. |
| **Channel** | An account connected through a credential. Tokens are encrypted and refreshed on their own; a revoked one is marked *reconnect*. |
| **Post** | Media + caption + per-platform metadata + a time. One row in `social_posts`. |
| **Provider** | `src/modules/social/providers/*` — implements `SocialProvider`. YouTube: resumable chunked upload that resumes from the offset YouTube reports. |
| **Publishing** | One [Cloudflare Workflow](https://developers.cloudflare.com/workflows/) instance per post (`PublishWorkflow`): durable, retried with backoff, sleeps until the scheduled time. Platforms that can hold a post themselves (YouTube `publishAt`) get it uploaded at once, so processing is done before it goes live. |
| **API** | Per-user API keys (`mxt_…`, only the SHA-256 is stored) for `/api/v1/*`. |

Post statuses: `scheduled` → `publishing` → `uploaded` (on the platform, goes live at its
time) or `published`; `failed` (with the reason, retryable) or `cancelled`.

Media is either a public `https://` URL fetched with Range requests (e.g. a public R2
object), or a file uploaded through the app: the browser sends it in 50 MB parts into an R2
multipart upload (`/api/media/upload`), so any size works without a Worker holding it in
memory.

## Pages

- `/publish` — compose and schedule, the queue, cancel / retry
- `/channels` — add an app credential (the redirect URI to register is shown there), connect channels
- `/api-keys` — create keys for scripts, with a curl example

## API

```bash
curl https://mixetape.com/api/v1/accounts -H "Authorization: Bearer mxt_…"

curl -X POST https://mixetape.com/api/v1/posts \
  -H "Authorization: Bearer mxt_…" -H "Content-Type: application/json" \
  -d '{
    "accountId": "…",
    "mediaUrl": "https://…/video.mp4",
    "scheduledAt": "2026-10-01T17:00:00+07:00",
    "metadata": { "title": "…", "description": "…", "category": "27", "privacyStatus": "public" }
  }'
```

`GET /api/v1/posts?status=scheduled,failed&from=&to=`, `GET /api/v1/posts/:id`,
`DELETE /api/v1/posts/:id` (cancel), `POST /api/v1/posts/:id` (retry a failed post).

## YouTube setup (per user)

1. Google Cloud → enable **YouTube Data API v3** → OAuth consent screen.
2. Create an **OAuth client ID**, type *Web application*, with the redirect URI shown on
   `/channels` (`https://mixetape.com/api/connect/youtube/callback`).
3. Save the client ID + secret on `/channels`, then **Connect channel**.

Until Google verifies the OAuth app (and YouTube audits the API project), uploads through
it are locked to **private**. Scheduling works, but videos only go public after that
approval. Each project also has a daily quota (about 6 uploads at the default 10,000 units).

## Adding a platform

1. `providers/<platform>.ts` implementing `SocialProvider` (`upload`, `refreshToken`, `schedulesNatively`).
2. Register it in `providers/index.ts`.
3. Its OAuth flow in `modules/social/oauth/` and a branch in `startConnect` / `completeConnect`.
4. Its metadata type in `providers/types.ts`.

## Develop

```bash
pnpm install
cp .dev.vars.example .dev.vars   # fill BETTER_AUTH_SECRET and CREDENTIALS_KEY
npx wrangler d1 migrations apply mixetape-db --local
pnpm dev                         # http://localhost:3001
pnpm check && pnpm test
```

## Deploy

```bash
npx wrangler d1 migrations apply mixetape-db --remote
pnpm run deploy
```

Bindings (`wrangler.jsonc`): D1 `mixetape-db`, KV (OAuth state), R2 `mixetape-media`,
Workflow `mixetape-publish`, `send_email` for login codes. Secrets: `BETTER_AUTH_SECRET`,
`CREDENTIALS_KEY` (32 random bytes, base64url — rotating it makes stored credentials and
tokens unreadable).
