import { useCallback, useRef, useState } from "react";
import { uploadFile } from "#/modules/storage/browser-upload";

export type Upload = {
  id: string;
  name: string;
  progress: number;
  status: "waiting" | "uploading" | "reading" | "done" | "failed";
  error?: string;
};

const AT_ONCE = 3;

/**
 * A queue of browser uploads, three at a time, each with its progress. `onUploaded` runs
 * whenever one finishes, so the page can refresh its list.
 */
export function useUploads(onUploaded: () => void) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const waiting = useRef<{ id: string; file: File }[]>([]);
  const running = useRef(0);

  const patch = (id: string, changes: Partial<Upload>) =>
    setUploads((current) =>
      current.map((upload) => (upload.id === id ? { ...upload, ...changes } : upload)),
    );

  const next = useCallback(() => {
    while (running.current < AT_ONCE && waiting.current.length) {
      const { id, file } = waiting.current.shift()!;
      running.current++;
      patch(id, { status: "uploading" });
      uploadFile(file, (progress) =>
        patch(id, progress < 1 ? { progress } : { progress: 1, status: "reading" }),
      )
        .then(() => {
          patch(id, { status: "done", progress: 1 });
          onUploaded();
        })
        .catch((error: unknown) =>
          patch(id, {
            status: "failed",
            error: error instanceof Error ? error.message : "Upload failed",
          }),
        )
        .finally(() => {
          running.current--;
          next();
        });
    }
  }, [onUploaded]);

  const add = useCallback(
    (files: File[]) => {
      const queued = files.map((file) => ({ id: crypto.randomUUID(), file }));
      setUploads((current) => [
        ...current,
        ...queued.map(({ id, file }) => ({
          id,
          name: file.name,
          progress: 0,
          status: "waiting" as const,
        })),
      ]);
      waiting.current.push(...queued);
      next();
    },
    [next],
  );

  const clearFinished = () =>
    setUploads((current) =>
      current.filter((upload) => upload.status !== "done" && upload.status !== "failed"),
    );

  return { uploads, add, clearFinished };
}
