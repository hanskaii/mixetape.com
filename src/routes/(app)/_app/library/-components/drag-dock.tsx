import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { FolderSimplePlus } from "@phosphor-icons/react";
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
        // The page would take a drop from a group as "take it out".
        event.stopPropagation();
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
 * While files are dragged: one target at the bottom to make a new carousel of them. To put
 * them in a carousel that exists, drop them onto it in the grid.
 */
export function DragDock({ onNewCarousel }: { onNewCarousel: (fileIds: string[]) => void }) {
  return (
    <FloatingBar label="Make a carousel">
      <Target onDrop={onNewCarousel}>
        <FolderSimplePlus size={16} /> New carousel
      </Target>
    </FloatingBar>
  );
}
