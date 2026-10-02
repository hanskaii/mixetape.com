import { libraryEndpoints } from "#/modules/library/library.rest";
import { socialEndpoints } from "#/modules/social/social.rest";
import { storageEndpoints } from "#/modules/storage/storage.rest";
import { webhookEndpoints } from "#/modules/webhooks/webhooks.rest";
import type { Endpoint } from "./rest";

/** Every REST endpoint, in the order the reference lists them. */
export const ENDPOINTS: Endpoint[] = [
  ...socialEndpoints,
  ...libraryEndpoints,
  ...storageEndpoints,
  ...webhookEndpoints,
];
