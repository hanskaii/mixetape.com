import { CheckCircle, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Panel } from "#/components/layouts/workspace-page";
import type { Upload } from "../-lib/use-uploads";

const LABEL: Record<Upload["status"], string> = {
  waiting: "Waiting",
  uploading: "Uploading",
  reading: "Reading the file",
  done: "Ready",
  failed: "Failed",
};

/** The uploads of this visit, each with a progress bar, until they are cleared. */
export function UploadTray({ uploads, onClear }: { uploads: Upload[]; onClear: () => void }) {
  if (!uploads.length) return null;
  const busy = uploads.filter((upload) => upload.status !== "done" && upload.status !== "failed");
  return (
    <Panel
      title={busy.length ? `Uploading ${busy.length} of ${uploads.length}` : "Uploads"}
      actions={
        busy.length < uploads.length && (
          <Button size="xs" variant="ghost" onClick={onClear}>
            Clear finished
          </Button>
        )
      }
    >
      <ul className="divide-y divide-border">
        {uploads.map((upload) => (
          <li key={upload.id} className="grid gap-1.5 px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-[13px]">
              {upload.status === "done" ? (
                <CheckCircle weight="fill" className="shrink-0 text-emerald-600" />
              ) : upload.status === "failed" ? (
                <WarningCircle weight="fill" className="shrink-0 text-destructive" />
              ) : (
                <SpinnerGap className="shrink-0 animate-spin text-muted-foreground" />
              )}
              <span className="min-w-0 flex-1 truncate font-medium">{upload.name}</span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                {upload.status === "uploading"
                  ? `${Math.round(upload.progress * 100)}%`
                  : LABEL[upload.status]}
              </span>
            </div>
            {upload.error ? (
              <p className="text-xs text-destructive">{upload.error}</p>
            ) : (
              upload.status !== "done" && (
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200"
                    style={{ width: `${Math.max(upload.progress * 100, 2)}%` }}
                  />
                </div>
              )
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
