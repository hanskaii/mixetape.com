import { memo, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { CalendarCheck, Check, Hourglass, Play } from "@phosphor-icons/react";
import { Badge } from "#/components/ui/badge";
import type { FileView } from "#/modules/storage/files.service";
import { colors, radius } from "../../../../../components/ui/tokens.stylex";
import { daysLeft, formatDuration } from "../-lib/format";
import { MediaImage } from "./media-image";

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

const styles = stylex.create({
  card: {
    // Children reveal themselves through this on hover and keyboard focus.
    "--reveal": { default: "0", ":hover": "1", ":focus-visible": "1" },
    backgroundColor: colors.muted,
    borderRadius: radius["2xl"],
    boxShadow: `0 0 0 1px ${colors.border}`,
    cursor: "pointer",
    height: "100%",
    outline: "none",
    overflow: "hidden",
    position: "relative",
    transform: { default: null, ":active": "scale(0.99)" },
    transitionDuration: "150ms",
    transitionProperty: "box-shadow, transform",
    width: "100%",
  },
  focus: { boxShadow: { default: null, ":focus-visible": `0 0 0 2px ${colors.ring}` } },
  selected: { boxShadow: `0 0 0 3px ${colors.primary}` },
  selecting: { "--reveal": "1" },
  video: { height: "100%", inset: 0, objectFit: "cover", position: "absolute", width: "100%" },
  check: {
    alignItems: "center",
    backgroundColor: "rgb(0 0 0 / 0.25)",
    borderColor: "rgb(255 255 255 / 0.9)",
    borderRadius: radius.full,
    borderStyle: "solid",
    borderWidth: "2px",
    color: "transparent",
    display: "flex",
    height: "1.5rem",
    justifyContent: "center",
    left: "0.5rem",
    opacity: "var(--reveal)",
    position: "absolute",
    top: "0.5rem",
    transitionDuration: "150ms",
    transitionProperty: "opacity",
    width: "1.5rem",
  },
  checked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    color: colors.primaryForeground,
    opacity: 1,
  },
  order: { fontSize: "0.6875rem", fontVariantNumeric: "tabular-nums", fontWeight: 700 },
  badges: {
    alignItems: "flex-end",
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    position: "absolute",
    right: "0.5rem",
    top: "0.5rem",
  },
  dark: {
    backdropFilter: "blur(4px)",
    backgroundColor: "rgb(0 0 0 / 0.6)",
    color: "white",
  },
  foot: {
    alignItems: "flex-end",
    backgroundImage: "linear-gradient(to top, rgb(0 0 0 / 0.6), transparent)",
    bottom: 0,
    color: "white",
    display: "flex",
    gap: "0.5rem",
    insetInline: 0,
    justifyContent: "space-between",
    paddingBlock: "2rem 0.5rem",
    paddingInline: "0.625rem",
    pointerEvents: "none",
    position: "absolute",
  },
  name: {
    fontSize: "0.75rem",
    fontWeight: 500,
    minWidth: 0,
    opacity: "var(--reveal)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    transitionDuration: "150ms",
    transitionProperty: "opacity",
    whiteSpace: "nowrap",
  },
  duration: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    fontFamily: MONO,
    fontSize: "0.6875rem",
    fontVariantNumeric: "tabular-nums",
    gap: "0.25rem",
  },
});

/**
 * A file in the masonry: its edge-made thumbnail, a video that plays silently while hovered
 * (fetched only then), and just enough on top — its length, whether it is scheduled, when
 * storage lets it go. Memoized: selecting one card leaves the others alone.
 */
export const FileCard = memo(function FileCard({
  file,
  selected,
  order,
  selecting,
  scheduled,
  onToggle,
  onDragStart,
  onDragEnd,
}: {
  file: FileView;
  selected: boolean;
  /** Its place in a selection of several — the order a carousel gets; 0 when not. */
  order: number;
  /** Something is selected: every card shows its checkbox. */
  selecting: boolean;
  /** Posts not yet out that use this file. */
  scheduled: number;
  onToggle: (file: FileView, event: React.MouseEvent | React.KeyboardEvent) => void;
  onDragStart: (file: FileView, event: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const left = daysLeft(file.expiresAt);

  return (
    <div
      role="checkbox"
      aria-checked={selected}
      aria-label={file.name}
      tabIndex={0}
      draggable
      onDragStart={(event) => onDragStart(file, event)}
      onDragEnd={onDragEnd}
      onClick={(event) => onToggle(file, event)}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onToggle(file, event);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...stylex.props(
        styles.card,
        styles.focus,
        selected && styles.selected,
        selecting && styles.selecting,
      )}
    >
      <MediaImage file={file} width={480} />
      {hovered && file.kind === "video" && (
        <video
          src={file.publicUrl}
          autoPlay
          muted
          loop
          playsInline
          {...stylex.props(styles.video)}
        />
      )}

      <span aria-hidden {...stylex.props(styles.check, selected && styles.checked)}>
        {order > 0 ? (
          <span {...stylex.props(styles.order)}>{order}</span>
        ) : (
          <Check size={13} weight="bold" />
        )}
      </span>

      <span {...stylex.props(styles.badges)}>
        {scheduled > 0 && (
          <Badge>
            <CalendarCheck weight="bold" /> Scheduled
          </Badge>
        )}
        {left <= 7 && (
          <Badge
            style={styles.dark}
            title={`Storage deletes it in ${left} day${left === 1 ? "" : "s"}`}
          >
            <Hourglass /> {left}d
          </Badge>
        )}
      </span>

      <span {...stylex.props(styles.foot)}>
        <span {...stylex.props(styles.name)}>{file.name}</span>
        {file.kind === "video" && file.durationMs ? (
          <span {...stylex.props(styles.duration)}>
            <Play size={10} weight="fill" /> {formatDuration(file.durationMs)}
          </span>
        ) : null}
      </span>
    </div>
  );
});
