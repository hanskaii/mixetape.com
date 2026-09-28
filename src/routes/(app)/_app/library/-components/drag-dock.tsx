import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { FolderSimplePlus, Stack } from "@phosphor-icons/react";
import type { GroupView } from "#/modules/library/groups.service";
import { colors, radius } from "../../../../../components/ui/tokens.stylex";
import { FloatingBar } from "./floating-bar";
import { FILES_TYPE } from "./group-card";

const styles = stylex.create({
  target: {
    alignItems: "center",
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    color: colors.foreground,
    display: "flex",
    flexShrink: 0,
    fontSize: "0.8125rem",
    fontWeight: 500,
    gap: "0.375rem",
    height: "2.75rem",
    paddingInline: "0.875rem",
    transitionDuration: "120ms",
    transitionProperty: "background-color, color",
  },
  over: { backgroundColor: colors.primary, color: colors.primaryForeground },
  name: { maxWidth: "10rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  count: { fontSize: "0.75rem", opacity: 0.6 },
});

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
      {...stylex.props(styles.target, over && styles.over)}
    >
      {children}
    </div>
  );
}

/**
 * While files are dragged: every group at hand along the bottom, and a new one — so a group
 * far away in the grid never needs a scroll to be reached.
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
    <FloatingBar label="Drop into a group">
      <Target onDrop={onNewGroup}>
        <FolderSimplePlus size={16} /> New group
      </Target>
      {groups.map((group) => (
        <Target key={group.id} onDrop={(ids) => onMove(group.id, ids)}>
          <Stack size={16} />
          <span {...stylex.props(styles.name)}>
            {group.title || group.caption || "Untitled group"}
          </span>
          <span {...stylex.props(styles.count)}>{group.files.length}</span>
        </Target>
      ))}
    </FloatingBar>
  );
}
