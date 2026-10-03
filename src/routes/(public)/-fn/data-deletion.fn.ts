import { createServerFn } from "@tanstack/react-start";
import { deletionStatus } from "#/modules/social/access.service";

/** A deletion request by its confirmation code; no sign-in needed, the code is the key. */
export const getDeletionStatus = createServerFn({ method: "GET" })
  .validator((data: { code: string }) => ({ code: String(data.code ?? "").trim() }))
  .handler(async ({ data }) => (data.code ? deletionStatus(data.code) : null));
