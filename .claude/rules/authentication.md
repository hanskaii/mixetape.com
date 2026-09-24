# Authentication & Authorization Rules

## 1. Authentication Architecture (How It Works)

Authentication is powered by **Better-Auth** running on Cloudflare Workers with SQLite session persistence on Cloudflare D1.

```
Browser (auth-client.ts) ──► TanStack Start (/api/auth/*) ──► Better-Auth (auth.server.ts) ──► D1 Database
           │                                                                                     │
           └─── Isomorphic Loader Query (auth.fn.ts) ◄────────────────────────────────────────────┘
```

- **Server Instance (`src/modules/auth/auth.server.ts`)**: Configures Better-Auth with Drizzle D1 adapter, Email OTP / social plugins, and secret keys.
- **Client Instance (`src/modules/auth/auth-client.ts`)**: Browser client created via `createAuthClient` for `signIn`, `signOut`, and client-side hooks.
- **Server Function Bridge (`src/modules/auth/auth.fn.ts`)**: Exported `getAuthSession = createServerFn()` extracting cookies via `getRequestHeaders()` for isomorphic SSR/client loaders.
- **Root Context Injection (`src/routes/__root.tsx`)**: `beforeLoad` fetches session once at root level and provides `{ session, user }` to the entire route tree via router context.

---

## 2. Route Protection (`beforeLoad`)

Protect authenticated routes (`src/routes/(app)/_app/*`) at route boundary using TanStack Router's `beforeLoad`:

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/(app)/_app/settings/profile")({
  beforeLoad: ({ context }) => {
    if (!context.session?.user) {
      throw redirect({
        to: "/",
        search: { redirect: "/settings/profile" },
      });
    }
  },
  component: ProfilePage,
});
```

---

## 3. Server Function Protection (`createServerFn`)

Never trust client state. Validate sessions inside all server functions performing mutations or private queries:

```ts
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "#/modules/auth/auth.server";

export const updateUserData = createServerFn({ method: "POST" })
  .validator((data: UpdatePayload) => data)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    if (!headers) throw new Error("Unauthorized");

    const session = await auth.api.getSession({ headers });
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    // Proceed with authorized user: session.user.id
  });
```

---

## 4. API Route Protection (`src/routes/api/*`)

For raw HTTP API endpoints, inspect request headers directly:

```ts
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "#/modules/auth/auth.server";

export const Route = createFileRoute("/api/user/profile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        if (!session?.user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        return Response.json({ user: session.user });
      },
    },
  },
});
```

---

## 5. Authorization & Multi-Tenancy (RBAC)

Authentication confirms identity (`who you are`); Authorization enforces access (`what you can touch`):

- **Ownership Check**: Verify resource `userId === session.user.id` before mutating posts, profiles, or keys.
- **Organization / Team Role Check**: For multi-member organizations, query `member` table to verify active membership and role (`admin` vs `member`):
  ```ts
  const membership = await db.query.member.findFirst({
    where: and(eq(member.organizationId, organizationId), eq(member.userId, session.user.id)),
  });
  if (!membership || (requiredAdmin && membership.role !== "admin")) {
    throw new Error("Forbidden");
  }
  ```

---

## 6. Import Isolation Rules (Vite / Rolldown Build Protection)

- Never import `auth.server.ts` into client-rendered UI files.
- Never name client-safe files `*.server.ts` or `*.client.ts` (use `auth-client.ts`, not `auth.client.ts`).
- Route loaders must use `auth.fn.ts` (`createServerFn`) to fetch session data safely across SSR and client navigation.
