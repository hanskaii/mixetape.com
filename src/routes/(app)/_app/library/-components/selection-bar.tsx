import * as stylex from "@stylexjs/stylex";
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
import { colors } from "../../../../../components/ui/tokens.stylex";
import { selectionSummary } from "../-lib/format";
import { FloatingBar } from "./floating-bar";

const styles = stylex.create({
  menu: { maxHeight: "18rem", minWidth: "13rem" },
  summary: { flexShrink: 0, marginInline: "0.5rem 0.25rem" },
  count: { fontSize: "0.8125rem", fontWeight: 600, lineHeight: 1.2, margin: 0 },
  what: { color: colors.mutedForeground, fontSize: "0.6875rem", lineHeight: 1.2, margin: 0 },
  groupName: {
    maxWidth: "12rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  groupCount: { color: colors.mutedForeground, fontSize: "0.75rem", marginInlineStart: "auto" },
});

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
    <FloatingBar label="Selected files">
      <div {...stylex.props(styles.summary)}>
        <p {...stylex.props(styles.count)}>{files.length} selected</p>
        <p {...stylex.props(styles.what)}>{selectionSummary(files)}</p>
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
          <DropdownMenuContent align="center" side="top" style={styles.menu}>
            {groups.map((group) => (
              <DropdownMenuItem key={group.id} onClick={() => onMove(group.id)}>
                <Stack />
                <span {...stylex.props(styles.groupName)}>
                  {group.title || group.caption || "Untitled group"}
                </span>
                <span {...stylex.props(styles.groupCount)}>{group.files.length}</span>
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
    </FloatingBar>
  );
}
