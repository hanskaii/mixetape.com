import { createServerFn } from "@tanstack/react-start";
import { currentUserId } from "#/modules/auth/auth.server";
import { deleteUserAccount } from "#/modules/auth/delete-account.service";

/** Deletes the signed-in account; open with or without a plan. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .validator((data: { email: string }) => ({ email: String(data?.email ?? "") }))
  .handler(async ({ data }) => deleteUserAccount(await currentUserId(), data.email));
