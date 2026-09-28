import { useState } from "react";
import { FolderSimplePlus, Stack } from "@phosphor-icons/react";
import type { GroupView } from "#/modules/library/groups.service";
import { FILES_TYPE } from "./group-card";

function Target({
  children,
  onDrop,
}: {
  children: React.ReactNode;
  onDrop: (fileIds: string[]) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const ids = event.dataTransfer.getData(FILES_TYPE);
        if (ids) onDrop(JSON.parse(ids) as string[]);
      }}
      className={`flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-[13px] font-medium transition-colors ${over ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
    >
      {children}
    </div>
  );
}

/**
 * While files are dragged: every group at hand along the bottom, and a new one — so a file
 * far down the page never needs a scroll back up to be grouped.
 */
export function DragDock({
  groups,
  onNewGroup,
  onMove,
}: {
  groups: GroupView[];
  onNewGroup: (fileIds: string[]) => void;
  onMove: (groupId: string, fileIds: string[]) => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl bg-card p-2 shadow-2xl ring-1 ring-border animate-in fade-in slide-in-from-bottom-3 duration-150">
        <Target onDrop={onNewGroup}>
          <FolderSimplePlus size={16} /> New group
        </Target>
        {groups.map((group) => (
          <Target key={group.id} onDrop={(ids) => onMove(group.id, ids)}>
            <Stack size={16} />
            <span className="max-w-40 truncate">
              {group.title || group.caption || "Untitled group"}
            </span>
            <span className="text-xs opacity-60">{group.files.length}</span>
          </Target>
        ))}
      </div>
    </div>
  );
}
