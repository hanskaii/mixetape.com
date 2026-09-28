import { useState } from "react";
import { CalendarCheck, PaperPlaneTilt, Plus, Robot, Stack } from "@phosphor-icons/react";
import type { GroupView } from "#/modules/library/groups.service";
import { selectionSummary } from "../-lib/format";

/** Files dragged inside the page carry their ids under this type. */
export const FILES_TYPE = "application/x-mixetape-files";

/** Whether a drag carries files — from the library, or from the computer. */
const carriesFiles = (event: React.DragEvent) =>
  event.dataTransfer.types.includes(FILES_TYPE) || event.dataTransfer.types.includes("Files");

function Cover({ group }: { group: GroupView }) {
  const shown = group.files.slice(0, 4);
  if (!shown.length)
    return (
      <span className="grid size-full place-items-center text-muted-foreground">
        <Stack size={28} />
      </span>
    );
  return (
    <span className={`grid size-full gap-0.5 ${shown.length > 1 ? "grid-cols-2" : ""}`}>
      {shown.map((file, index) => (
        <span
          key={file.id}
          className={`relative overflow-hidden bg-muted ${shown.length === 3 && index === 0 ? "row-span-2" : ""}`}
        >
          {file.kind === "image" ? (
            <img src={file.publicUrl} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <video
              src={`${file.publicUrl}#t=0.5`}
              preload="metadata"
              muted
              playsInline
              className="size-full object-cover"
            />
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * A group: its first files as the cover, what it is (a carousel of four images), and a drop
 * target — files dragged onto it join it, files from the computer upload into it.
 */
export function GroupCard({
  group,
  onOpen,
  onPublish,
  onDropFiles,
  onDropUploads,
}: {
  group: GroupView;
  onOpen: () => void;
  onPublish: () => void;
  onDropFiles: (fileIds: string[]) => void;
  onDropUploads: (files: File[]) => void;
}) {
  const [over, setOver] = useState(false);
  const pending = group.posts.filter((post) =>
    ["scheduled", "publishing", "uploaded"].includes(post.status),
  ).length;

  return (
    <div
      onDragOver={(event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        event.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOver(false);
        const ids = event.dataTransfer.getData(FILES_TYPE);
        if (ids) onDropFiles(JSON.parse(ids) as string[]);
        else if (event.dataTransfer.files.length) onDropUploads([...event.dataTransfer.files]);
      }}
      className={`group relative flex flex-col overflow-hidden rounded-2xl bg-card transition-[box-shadow,transform] duration-150 ${over ? "scale-[1.02] ring-[3px] ring-primary" : "ring-1 ring-border hover:ring-foreground/20"}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="relative aspect-[4/3] w-full overflow-hidden text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-label={`Open ${group.title || "untitled group"}`}
      >
        <Cover group={group} />
        {over && (
          <span className="absolute inset-0 grid place-items-center bg-primary/80 text-sm font-semibold text-primary-foreground">
            <span className="flex items-center gap-1.5">
              <Plus weight="bold" /> Add to group
            </span>
          </span>
        )}
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
          <Stack size={12} weight="bold" /> {group.files.length}
        </span>
      </button>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p
            className={`truncate text-[13px] font-medium ${group.title ? "" : "text-muted-foreground"}`}
          >
            {group.title || group.caption || "Untitled group"}
          </p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            {group.createdBy === "agent" && <Robot size={12} aria-label="Made by an agent" />}
            {pending > 0 ? (
              <>
                <CalendarCheck size={12} /> Scheduled on {pending}
              </>
            ) : group.files.length ? (
              selectionSummary(group.files)
            ) : (
              "Empty — drop files here"
            )}
          </p>
        </div>
        {group.files.length > 0 && (
          <button
            type="button"
            onClick={onPublish}
            aria-label="Publish this group"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
          >
            <PaperPlaneTilt size={15} weight="fill" />
          </button>
        )}
      </div>
    </div>
  );
}
