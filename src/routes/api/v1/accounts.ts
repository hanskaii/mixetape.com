import { createFileRoute } from "@tanstack/react-router";
import { requireUser, respond } from "#/modules/social/http";
import { PROVIDER_LIST } from "#/modules/social/providers";
import { listAccounts } from "#/modules/social/social.service";

// GET /api/v1/accounts — the connected channels the caller can post to, with what each
// platform supports. Everything else an agent can do is under /api/v1/tools.
export const Route = createFileRoute("/api/v1/accounts")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        respond(async () => {
          const userId = await requireUser(request, "read");
          const accounts = await listAccounts(userId);
          return {
            accounts: accounts.map((account) => ({
              id: account.id,
              provider: account.provider,
              platformAccountId: account.platformAccountId,
              name: account.name,
              handle: account.handle,
              status: account.status,
              capabilities:
                PROVIDER_LIST.find((provider) => provider.id === account.provider)?.capabilities ??
                [],
            })),
          };
        }),
    },
  },
});
