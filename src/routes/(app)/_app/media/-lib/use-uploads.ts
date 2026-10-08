import { createElement, useCallback, useRef } from "react";
import { toast } from "sonner";
import { uploadFile } from "#/modules/storage/browser-upload";
import type { FileView } from "#/modules/storage/files.service";
import { UploadFailures, UploadProgress } from "../-components/upload-progress";

const AT_ONCE = 3;
const TOAST = "library-uploads";

type Batch = {
  total: number;
  done: number;
  failed: { name: string; error: string }[];
  /** Bytes sent and to send, for one progress bar over the whole batch. */
  sent: Map<string, number>;
  bytes: number;
  current: string;
};

/**
 * Browser uploads, three at a time, reported in one toast that follows the batch —
 * "Uploading 2 of 5" with a progress bar — and says how it ended. Files go into a group
 * when one is given. `onUploaded` gets each file as it is ready; `onIdle` runs once the
 * queue is empty.
 */
export function useUploads(onUploaded: (file: FileView) => void, onIdle: () => void) {
  const waiting = useRef<{ id: string; file: File; groupId?: string }[]>([]);
  const running = useRef(0);
  const batch = useRef<Batch | null>(null);
  const frame = useRef(0);

  // Progress events come many times a second; the toast is redrawn once a frame at most.
  const report = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const state = batch.current;
      if (!state) return;
      const sent = [...state.sent.values()].reduce((sum, value) => sum + value, 0);
      toast.loading(`Uploading ${Math.min(state.done + 1, state.total)} of ${state.total}`, {
        id: TOAST,
        description: createElement(UploadProgress, {
          name: state.current,
          progress: state.bytes ? sent / state.bytes : 0,
        }),
      });
    });
  }, []);

  const finish = useCallback(() => {
    const state = batch.current;
    batch.current = null;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    if (!state) return;
    const ok = state.total - state.failed.length;
    if (!state.failed.length)
      toast.success(`${ok} file${ok === 1 ? "" : "s"} uploaded`, { id: TOAST, description: null });
    else
      toast.error(
        ok
          ? `${ok} uploaded, ${state.failed.length} failed`
          : `Upload failed${state.failed.length > 1 ? ` (${state.failed.length} files)` : ""}`,
        {
          id: TOAST,
          description: createElement(UploadFailures, { failures: state.failed }),
          duration: 10_000,
        },
      );
  }, []);

  const next = useCallback(() => {
    while (running.current < AT_ONCE && waiting.current.length) {
      const { id, file, groupId } = waiting.current.shift()!;
      running.current++;
      const state = batch.current!;
      state.current = file.name;
      report();
      uploadFile(
        file,
        (fraction) => {
          state.sent.set(id, fraction * file.size);
          report();
        },
        groupId,
      )
        .then((uploaded) => onUploaded(uploaded))
        .catch((error: unknown) =>
          state.failed.push({
            name: file.name,
            error: error instanceof Error ? error.message : "Upload failed",
          }),
        )
        .finally(() => {
          state.sent.set(id, file.size);
          state.done++;
          running.current--;
          if (!running.current && !waiting.current.length) {
            finish();
            onIdle();
          } else report();
          next();
        });
    }
  }, [onUploaded, onIdle, report, finish]);

  return useCallback(
    (files: File[], groupId?: string) => {
      if (!files.length) return;
      const state = (batch.current ??= {
        total: 0,
        done: 0,
        failed: [],
        sent: new Map(),
        bytes: 0,
        current: "",
      });
      state.total += files.length;
      state.bytes += files.reduce((sum, file) => sum + file.size, 0);
      waiting.current.push(...files.map((file) => ({ id: crypto.randomUUID(), file, groupId })));
      next();
    },
    [next],
  );
}
