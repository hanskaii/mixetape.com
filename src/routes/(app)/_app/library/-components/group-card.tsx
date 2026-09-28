import { memo, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { CalendarCheck, PaperPlaneTilt, Plus, Robot, Stack } from "@phosphor-icons/react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import type { GroupView } from "#/modules/library/groups.service";
import { colors, radius } from "../../../../../components/ui/tokens.stylex";
import { selectionSummary } from "../-lib/format";
import { MediaImage } from "./media-image";

/** Files dragged inside the page carry their ids under this type. */
export const FILES_TYPE = "application/x-mixetape-files";

/** The footer's height under the cover, for the masonry to size a group's card. */
export const GROUP_FOOTER = 56;

const carriesFiles = (event: React.DragEvent) =>
  event.dataTransfer.types.includes(FILES_TYPE) || event.dataTransfer.types.includes("Files");

const styles = stylex.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius["2xl"],
    boxShadow: {
      default: `0 0 0 1px ${colors.border}`,
      ":hover": `0 0 0 1px color-mix(in oklab, ${colors.foreground} 22%, transparent)`,
    },
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    position: "relative",
    transitionDuration: "150ms",
    transitionProperty: "box-shadow, transform",
  },
  over: { boxShadow: `0 0 0 3px ${colors.primary}`, transform: "scale(1.02)" },
  cover: {
    backgroundColor: colors.muted,
    borderStyle: "none",
    cursor: "pointer",
    display: "grid",
    flexGrow: 1,
    gap: "2px",
    gridAutoRows: "1fr",
    minHeight: 0,
    outline: { default: "none", ":focus-visible": `2px solid ${colors.ring}` },
    outlineOffset: "-2px",
    overflow: "hidden",
    padding: 0,
    position: "relative",
    width: "100%",
  },
  two: { gridTemplateColumns: "1fr 1fr" },
  tile: { minHeight: 0, overflow: "hidden", position: "relative" },
  tall: { gridRow: "span 2" },
  empty: {
    alignItems: "center",
    color: colors.mutedForeground,
    display: "flex",
    justifyContent: "center",
  },
  count: { left: "0.5rem", position: "absolute", top: "0.5rem" },
  dark: { backdropFilter: "blur(4px)", backgroundColor: "rgb(0 0 0 / 0.6)", color: "white" },
  drop: {
    alignItems: "center",
    backgroundColor: `color-mix(in oklab, ${colors.primary} 85%, transparent)`,
    color: colors.primaryForeground,
    display: "flex",
    fontSize: "0.875rem",
    fontWeight: 600,
    gap: "0.375rem",
    inset: 0,
    justifyContent: "center",
    position: "absolute",
  },
  foot: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    gap: "0.5rem",
    height: `${GROUP_FOOTER}px`,
    paddingInline: "0.75rem 0.5rem",
  },
  text: { flexGrow: 1, minWidth: 0 },
  title: {
    color: colors.foreground,
    fontSize: "0.8125rem",
    fontWeight: 500,
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  untitled: { color: colors.mutedForeground },
  meta: {
    alignItems: "center",
    color: colors.mutedForeground,
    display: "flex",
    fontSize: "0.75rem",
    gap: "0.25rem",
    margin: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
  },
  publish: { borderRadius: radius.full, flexShrink: 0 },
});

function Cover({ group }: { group: GroupView }) {
  const shown = group.files.slice(0, 4);
  if (!shown.length)
    return (
      <span {...stylex.props(styles.tile, styles.empty)}>
        <Stack size={28} />
      </span>
    );
  return shown.map((file, index) => (
    <span
      key={file.id}
      {...stylex.props(styles.tile, shown.length === 3 && index === 0 && styles.tall)}
    >
      <MediaImage file={file} width={shown.length > 1 ? 160 : 480} />
    </span>
  ));
}

/**
 * A group in the grid, among the files: its first files as the cover, what it is (a
 * carousel of four images), and a drop target — files dragged onto it join it, files from
 * the computer upload into it.
 */
export const GroupCard = memo(function GroupCard({
  group,
  onOpen,
  onPublish,
  onDropFiles,
  onDropUploads,
}: {
  group: GroupView;
  onOpen: (group: GroupView) => void;
  onPublish: (group: GroupView) => void;
  onDropFiles: (group: GroupView, fileIds: string[]) => void;
  onDropUploads: (group: GroupView, files: File[]) => void;
}) {
  const [over, setOver] = useState(false);
  const pending = group.posts.filter((post) =>
    ["scheduled", "publishing", "uploaded"].includes(post.status),
  ).length;
  const title = group.title || group.caption;

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
        if (ids) onDropFiles(group, JSON.parse(ids) as string[]);
        else if (event.dataTransfer.files.length)
          onDropUploads(group, [...event.dataTransfer.files]);
      }}
      {...stylex.props(styles.card, over && styles.over)}
    >
      <button
        type="button"
        onClick={() => onOpen(group)}
        aria-label={`Open ${title || "untitled group"}`}
        {...stylex.props(styles.cover, group.files.length > 1 && styles.two)}
      >
        <Cover group={group} />
        <Badge style={[styles.count, styles.dark]}>
          <Stack weight="bold" /> {group.files.length}
        </Badge>
        {over && (
          <span {...stylex.props(styles.drop)}>
            <Plus weight="bold" /> Add to group
          </span>
        )}
      </button>
      <div {...stylex.props(styles.foot)}>
        <div {...stylex.props(styles.text)}>
          <p {...stylex.props(styles.title, !title && styles.untitled)}>
            {title || "Untitled group"}
          </p>
          <p {...stylex.props(styles.meta)}>
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
          <Button
            size="icon-sm"
            aria-label="Publish this group"
            style={styles.publish}
            onClick={() => onPublish(group)}
          >
            <PaperPlaneTilt weight="fill" />
          </Button>
        )}
      </div>
    </div>
  );
});
