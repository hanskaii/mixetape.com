import {
  CaretDown,
  FolderSimplePlus,
  PaperPlaneTilt,
  Stack,
  Trash,
  X,
} from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import type { GroupView } from "#/modules/library/groups.service";
import type { FileView } from "#/modules/storage/files.service";
import { selectionSummary } from "../-lib/format";

/** Floats at the bottom while files are selected: what they are, and what to do with them. */
export function SelectionBar({
  files,
  groups,
  onPublish,
  onGroup,
  onMove,
  onDelete,
  onClear,
}: {
  files: FileView[];
  groups: GroupView[];
  onPublish: () => void;
  onGroup: () => void;
  onMove: (groupId: string) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  if (!files.length) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-2xl bg-card p-1.5 pl-3 shadow-xl ring-1 ring-border animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="mr-1 min-w-0 shrink-0">
          <p className="text-[13px] font-semibold leading-tight">{files.length} selected</p>
          <p className="text-[11px] leading-tight text-muted-foreground">
            {selectionSummary(files)}
          </p>
        </div>
        <Button size="sm" onClick={onPublish}>
          <PaperPlaneTilt weight="fill" /> Publish
        </Button>
        <Button size="sm" variant="outline" onClick={onGroup}>
          <FolderSimplePlus /> Group
        </Button>
        {groups.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="sm" variant="outline">
                  <Stack /> Move to <CaretDown size={12} />
                </Button>
              }
            />
            <DropdownMenuContent align="center" side="top" className="max-h-72 min-w-52">
              {groups.map((group) => (
                <DropdownMenuItem key={group.id} onClick={() => onMove(group.id)}>
                  <Stack />
                  <span className="truncate">
                    {group.title || group.caption || "Untitled group"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {group.files.length}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Delete the selected files"
          onClick={onDelete}
        >
          <Trash />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label="Clear the selection" onClick={onClear}>
          <X />
        </Button>
      </div>
    </div>
  );
}
