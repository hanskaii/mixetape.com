import { createServerFn } from "@tanstack/react-start";
import { currentUserId } from "#/modules/social/social.fn";
import * as files from "./files.service";

/**
 * Server functions for the workspace's uploads: the browser PUTs a file straight to R2 on
 * the presigned URL (see browser-upload.ts), then finishes it here — the same two steps as
 * the create_upload and finish_upload tools.
 */

export const startUpload = createServerFn({ method: "POST" })
  .validator((data: { fileName: string; contentType?: string; size: number }) => data)
  .handler(async ({ data }) => {
    const upload = await files.createFileUpload(await currentUserId(), data);
    return { fileId: upload.fileId, uploadUrl: upload.uploadUrl, headers: upload.headers };
  });

export const finishFileUpload = createServerFn({ method: "POST" })
  .validator((data: { fileId: string }) => data)
  .handler(async ({ data }) => files.finishUpload(await currentUserId(), data.fileId));

export const removeFile = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => files.deleteFile(await currentUserId(), data.id));
