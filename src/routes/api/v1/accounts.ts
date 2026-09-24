import { createFileRoute } from "@tanstack/react-router";
import { requireUser, respond } from "#/modules/social/http";
import { listAccounts } from "#/modules/social/social.service";

// GET /api/v1/accounts — the connected channels the caller can post to.
export const Route = createFileRoute("/api/v1/accounts")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        respond(async () => {
          const userId = await requireUser(request);
          const accounts = await listAccounts(userId);
          return {
            accounts: accounts.map((account) => ({
              id: account.id,
              provider: account.provider,
              platformAccountId: account.platformAccountId,
              name: account.name,
              handle: account.handle,
              status: account.status,
            })),
          };
        }),
    },
  },
});
