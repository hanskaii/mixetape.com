import { finishFileUpload, startAvatarUpload, startUpload } from "./storage.fn";

/**
 * Uploads a file from the browser: a presigned URL from mixetape, one PUT of the file
 * straight to R2 (so files up to 5 GB never pass through the Worker), then finish, which
 * reads what the file is. Resolves with the indexed file.
 */
export async function uploadFile(
  file: File,
  onProgress?: (fraction: number) => void,
  groupId?: string,
) {
  const { fileId, uploadUrl, headers } = await startUpload({
    data: { fileName: file.name, contentType: file.type || undefined, size: file.size, groupId },
  });
  await put(file, uploadUrl, headers, onProgress);
  return finishFileUpload({ data: { fileId } });
}

/** Uploads an avatar outside the library; resolves with its public URL. */
export async function uploadAvatar(file: File) {
  const { uploadUrl, headers, publicUrl } = await startAvatarUpload({
    data: { fileName: file.name, contentType: file.type || undefined, size: file.size },
  });
  await put(file, uploadUrl, headers);
  return publicUrl;
}

function put(
  file: File,
  uploadUrl: string,
  headers: Record<string, string>,
  onProgress?: (fraction: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    // XHR rather than fetch: fetch cannot report upload progress.
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    request.onload = () =>
      request.status < 300
        ? resolve()
        : reject(new Error(`Storage refused the file (${request.status})`));
    request.onerror = () => reject(new Error("The upload was interrupted"));
    request.send(file);
  });
}
