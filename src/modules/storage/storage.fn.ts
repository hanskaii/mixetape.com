import { createServerFn } from "@tanstack/react-start";
import { currentUserId } from "#/modules/auth/auth.server";
import * as files from "./files.service";
import * as uploads from "./upload.service";

/**
 * Server functions for the workspace's uploads: the browser PUTs a file straight to R2 on
 * the presigned URL (see browser-upload.ts), then finishes it here — the same two steps as
 * the create_upload and finish_upload tools.
 */

export const startUpload = createServerFn({ method: "POST" })
  .validator(
    (data: { fileName: string; contentType?: string; size: number; groupId?: string }) => data,
  )
  .handler(async ({ data }) => {
    const upload = await files.createFileUpload(await currentUserId(), data);
    return { fileId: upload.fileId, uploadUrl: upload.uploadUrl, headers: upload.headers };
  });

/** An avatar goes to avatars/, outside the library: never listed there, never expired. */
export const startAvatarUpload = createServerFn({ method: "POST" })
  .validator((data: { fileName: string; contentType?: string; size: number }) => data)
  .handler(async ({ data }) => {
    if (!data.contentType?.startsWith("image/")) throw new Error("Choose an image for your avatar");
    if (data.size > 5 * 1024 * 1024) throw new Error("An avatar is limited to 5 MB");
    const upload = await uploads.createUpload(await currentUserId(), data, "avatars/");
    return { uploadUrl: upload.uploadUrl, headers: upload.headers, publicUrl: upload.publicUrl };
  });

export const finishFileUpload = createServerFn({ method: "POST" })
  .validator((data: { fileId: string }) => data)
  .handler(async ({ data }) => files.finishUpload(await currentUserId(), data.fileId));

/** Deletes files; any a post not yet sent still needs are kept and named. */
export const removeFiles = createServerFn({ method: "POST" })
  .validator((data: { ids: string[] }) => data)
  .handler(async ({ data }) => {
    const userId = await currentUserId();
    const kept: string[] = [];
    for (const id of data.ids)
      await files.deleteFile(userId, id).catch((error: unknown) => {
        kept.push(error instanceof Error ? error.message : String(error));
      });
    return { deleted: data.ids.length - kept.length, kept };
  });
