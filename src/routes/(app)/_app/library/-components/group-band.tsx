import { useEffect, useRef, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import {
  ArrowSquareOut,
  CaretUp,
  DotsThree,
  PaperPlaneTilt,
  PencilSimpleLine,
  Plus,
  Robot,
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
import { saveGroup, ungroupFiles } from "#/modules/library/library.fn";
import type { FileView } from "#/modules/storage/files.service";
import { colors, radius } from "../../../../../components/ui/tokens.stylex";
import { formatDuration, selectionSummary } from "../-lib/format";
import { FILES_TYPE, FROM_GROUP_TYPE } from "./group-card";
import { Masonry } from "./masonry";
import { MediaImage } from "./media-image";

const open = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(-0.25rem)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const styles = stylex.create({
  band: {
    animationDuration: "180ms",
    animationName: open,
    animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    backgroundColor: `color-mix(in oklab, ${colors.primary} 6%, transparent)`,
    borderColor: `color-mix(in oklab, ${colors.primary} 55%, ${colors.border})`,
    borderRadius: radius["2xl"],
    borderStyle: "dashed",
    borderWidth: "2px",
    display: "grid",
    gap: "0.5rem",
    marginTop: "0.75rem",
    paddingBlock: "1.125rem 0.625rem",
    paddingInline: "0.75rem",
    position: "relative",
    scrollMarginBlock: "6rem",
  },
  bandOver: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 14%, transparent)`,
    borderColor: colors.primary,
  },
  // On the top edge, over the dashes: the page's card colour cuts the line behind them.
  legend: {
    alignItems: "center",
    backgroundColor: colors.card,
    color: colors.foreground,
    display: "flex",
    fontSize: "0.75rem",
    gap: "0.375rem",
    height: "1.5rem",
    left: "0.875rem",
    maxWidth: "calc(100% - 16rem)",
    minWidth: 0,
    paddingInline: "0.5rem",
    position: "absolute",
    top: 0,
    transform: "translateY(-50%)",
  },
  icon: { color: colors.mutedForeground, display: "inline-flex", flexShrink: 0 },
  name: {
    backgroundColor: "transparent",
    borderStyle: "none",
    color: colors.foreground,
    cursor: "text",
    fontSize: "0.75rem",
    fontWeight: 600,
    minWidth: 0,
    overflow: "hidden",
    padding: 0,
    textDecoration: { default: "none", ":hover": "underline dotted" },
    textOverflow: "ellipsis",
    textUnderlineOffset: "3px",
    whiteSpace: "nowrap",
  },
  untitled: { color: colors.mutedForeground },
  rename: {
    backgroundColor: "transparent",
    borderColor: colors.ring,
    borderRadius: radius.sm,
    borderStyle: "solid",
    borderWidth: "1px",
    color: colors.foreground,
    fontSize: "0.75rem",
    fontWeight: 600,
    height: "1.375rem",
    outline: "none",
    paddingInline: "0.375rem",
    width: "12rem",
  },
  meta: {
    color: colors.mutedForeground,
    display: { default: "none", "@media (min-width: 640px)": "inline" },
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
  actions: {
    alignItems: "center",
    backgroundColor: colors.card,
    display: "flex",
    gap: "0.25rem",
    paddingInline: "0.25rem",
    position: "absolute",
    right: "0.75rem",
    top: 0,
    transform: "translateY(-50%)",
  },
  item: {
    backgroundColor: colors.muted,
    borderRadius: radius["2xl"],
    boxShadow: `0 0 0 1px ${colors.border}`,
    cursor: { default: "grab", ":active": "grabbing" },
    height: "100%",
    outline: { default: "none", ":focus-visible": `2px solid ${colors.ring}` },
    overflow: "hidden",
    position: "relative",
    transitionDuration: "120ms",
    transitionProperty: "box-shadow, opacity",
    width: "100%",
  },
  picked: { boxShadow: `0 0 0 3px ${colors.primary}` },
  moving: { opacity: 0.35 },
  // A yellow edge where a dropped file would land.
  insert: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    bottom: "0.5rem",
    position: "absolute",
    top: "0.5rem",
    width: "4px",
  },
  insertBefore: { left: "0.25rem" },
  insertAfter: { right: "0.25rem" },
  number: {
    backgroundColor: "rgb(0 0 0 / 0.6)",
    borderRadius: radius.sm,
    color: "white",
    fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
    fontSize: "0.6875rem",
    fontVariantNumeric: "tabular-nums",
    left: "0.375rem",
    paddingInline: "0.3125rem",
    position: "absolute",
    top: "0.375rem",
  },
  length: {
    bottom: "0.375rem",
    color: "white",
    fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
    fontSize: "0.6875rem",
    position: "absolute",
    right: "0.375rem",
    textShadow: "0 1px 2px rgb(0 0 0 / 0.6)",
  },
  add: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: { default: colors.border, ":hover": colors.mutedForeground },
    borderRadius: radius.xl,
    borderStyle: "dashed",
    borderWidth: "2px",
    color: { default: colors.mutedForeground, ":hover": colors.foreground },
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    fontSize: "0.75rem",
    gap: "0.375rem",
    height: "100%",
    justifyContent: "center",
    paddingInline: "1rem",
    width: "100%",
  },
  addOver: { borderColor: colors.primary, color: colors.foreground },
  hint: { color: colors.mutedForeground, fontSize: "0.6875rem", margin: 0 },
  hidden: { display: "none" },
  menu: { minWidth: "14rem" },
});

type BandTile = { type: "file"; file: FileView; index: number } | { type: "add" };

const fileHeight = (file: FileView, column: number) =>
  column * Math.min(Math.max(file.width && file.height ? file.height / file.width : 1, 0.56), 1.78);

/**
 * An open group, laid across the grid where its card was: its files in the order they go
 * out, on a dashed band that says "these belong together". Everything is direct — drag to
 * reorder, drag a file out onto the grid to take it out, drag files in from the grid or the
 * computer, rename in place, publish.
 */
export function GroupBand({
  group,
  onCollapse,
  onPublish,
  onChanged,
  onDragging,
  onUpload,
  onDelete,
}: {
  group: GroupView;
  onCollapse: () => void;
  onPublish: (group: GroupView) => void;
  onChanged: () => void;
  /** A file of this group is being dragged (its id), or no longer (null). */
  onDragging: (groupId: string | null) => void;
  onUpload: (files: File[]) => void;
  onDelete: (deleteFiles: boolean) => void;
}) {
  const [files, setFiles] = useState(group.files);
  const [picked, setPicked] = useState<string[]>([]);
  const [moving, setMoving] = useState<string[]>([]);
  const [target, setTarget] = useState<number | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(group.title ?? "");
  const band = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // The server's order wins once it answers.
  useEffect(() => {
    setFiles(group.files);
  }, [group.files]);
  useEffect(() => {
    setTitle(group.title ?? "");
  }, [group.title]);
  // Braces matter: scrollIntoView returns a promise in newer browsers, not a cleanup.
  useEffect(() => {
    band.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const ids = files.map((file) => file.id);

  /** Puts `moved` at `index` (counted in the current order) and saves the new order. */
  const place = async (moved: string[], index: number) => {
    const before = ids.slice(0, index).filter((id) => !moved.includes(id));
    const after = ids.slice(index).filter((id) => !moved.includes(id));
    const order = [...before, ...moved, ...after];
    if (order.join() === ids.join()) return;
    // Files already here move at once; files from the grid show when the server answers.
    const known = new Map(files.map((file) => [file.id, file]));
    setFiles(order.flatMap((id) => known.get(id) ?? []));
    await saveGroup({ data: { id: group.id, fileIds: order } });
    onChanged();
  };

  const takeOut = async (fileIds: string[]) => {
    setFiles((current) => current.filter((file) => !fileIds.includes(file.id)));
    setPicked([]);
    await ungroupFiles({ data: { fileIds } });
    onChanged();
  };

  const rename = async () => {
    setRenaming(false);
    if (title.trim() === (group.title ?? "")) return;
    await saveGroup({ data: { id: group.id, title: title.trim() || null } });
    onChanged();
  };

  const dropAt = (event: React.DragEvent, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    setTarget(null);
    const carried = event.dataTransfer.getData(FILES_TYPE);
    if (carried) void place(JSON.parse(carried) as string[], index);
    else if (event.dataTransfer.files.length) onUpload([...event.dataTransfer.files]);
  };

  const accepts = (event: React.DragEvent) =>
    event.dataTransfer.types.includes(FILES_TYPE) || event.dataTransfer.types.includes("Files");

  const pickedHere = picked.filter((id) => ids.includes(id));
  const tiles: BandTile[] = [
    ...files.map((file, index) => ({ type: "file" as const, file, index })),
    { type: "add" as const },
  ];

  return (
    <div
      ref={band}
      role="group"
      aria-label={`Carousel: ${group.title || "untitled"}`}
      onDragOver={(event) => {
        if (!accepts(event)) return;
        event.preventDefault();
        event.stopPropagation();
        if (target === null) setTarget(files.length);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTarget(null);
      }}
      onDrop={(event) => dropAt(event, target ?? files.length)}
      {...stylex.props(styles.band, target !== null && styles.bandOver)}
    >
      {/* The name sits on the dashed edge, like a fieldset's legend; the actions opposite. */}
      <div {...stylex.props(styles.legend)}>
        <Stack size={13} weight="bold" {...stylex.props(styles.icon)} />
        {renaming ? (
          <input
            autoFocus
            aria-label="Carousel name"
            value={title}
            placeholder="Untitled carousel"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => void rename()}
            onKeyDown={(event) => {
              if (event.key === "Enter") void rename();
              if (event.key === "Escape") {
                setTitle(group.title ?? "");
                setRenaming(false);
              }
            }}
            {...stylex.props(styles.rename)}
          />
        ) : (
          <button
            type="button"
            title="Rename"
            onClick={() => setRenaming(true)}
            {...stylex.props(styles.name, !group.title && styles.untitled)}
          >
            {group.title || "Untitled carousel"}
          </button>
        )}
        <span {...stylex.props(styles.meta)}>
          · {files.length ? selectionSummary(files) : "empty"}
        </span>
        {group.createdBy === "agent" && (
          <Robot size={12} aria-label="Made by an agent" {...stylex.props(styles.icon)} />
        )}
        {(group.caption || group.description) && (
          <span title="Caption ready — it fills in when you publish" {...stylex.props(styles.icon)}>
            <PencilSimpleLine size={12} aria-label="Caption ready" />
          </span>
        )}
      </div>

      <div {...stylex.props(styles.actions)}>
        {pickedHere.length > 0 && (
          <Button size="xs" variant="outline" onClick={() => void takeOut(pickedHere)}>
            <ArrowSquareOut /> Take out {pickedHere.length}
          </Button>
        )}
        <Button size="xs" disabled={!files.length} onClick={() => onPublish({ ...group, files })}>
          <PaperPlaneTilt weight="fill" /> Publish
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size="icon-xs" variant="ghost" aria-label="More">
                <DotsThree weight="bold" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" style={styles.menu}>
            <DropdownMenuItem onClick={() => onDelete(false)}>
              <X /> Undo the carousel — keep the files
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(true)}>
              <Trash /> Delete the carousel and its files
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Collapse the carousel"
          onClick={onCollapse}
        >
          <CaretUp weight="bold" />
        </Button>
      </div>

      {/* The same masonry as the grid around it, in the carousel's order. */}
      <Masonry
        items={tiles}
        getKey={(tile) => (tile.type === "file" ? tile.file.id : "add")}
        height={(tile, column) =>
          tile.type === "file" ? fileHeight(tile.file, column) : Math.round(column * 0.6)
        }
        render={(tile) => {
          if (tile.type === "add")
            return (
              <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(event) => {
                  if (!accepts(event)) return;
                  event.preventDefault();
                  event.stopPropagation();
                  if (target !== files.length) setTarget(files.length);
                }}
                onDrop={(event) => dropAt(event, files.length)}
                {...stylex.props(styles.add, target === files.length && styles.addOver)}
              >
                <Plus size={18} />
                {files.length ? "Drop or add files" : "Drop files here"}
              </button>
            );
          const { file, index } = tile;
          const on = picked.includes(file.id);
          return (
            <div
              role="checkbox"
              aria-checked={on}
              aria-label={`${index + 1}. ${file.name}`}
              tabIndex={0}
              draggable
              onClick={() =>
                setPicked((current) =>
                  current.includes(file.id)
                    ? current.filter((id) => id !== file.id)
                    : [...current, file.id],
                )
              }
              onKeyDown={(event) => {
                if (event.key !== " " && event.key !== "Enter") return;
                event.preventDefault();
                event.currentTarget.click();
              }}
              onDragStart={(event) => {
                const dragged = on ? picked : [file.id];
                event.dataTransfer.setData(FILES_TYPE, JSON.stringify(dragged));
                event.dataTransfer.setData(FROM_GROUP_TYPE, group.id);
                event.dataTransfer.effectAllowed = "move";
                setMoving(dragged);
                onDragging(group.id);
              }}
              onDragEnd={() => {
                setMoving([]);
                setTarget(null);
                onDragging(null);
              }}
              onDragOver={(event) => {
                if (!accepts(event)) return;
                event.preventDefault();
                event.stopPropagation();
                // Past the middle of a file means after it.
                const box = event.currentTarget.getBoundingClientRect();
                const at = event.clientX > box.left + box.width / 2 ? index + 1 : index;
                if (at !== target) setTarget(at);
              }}
              onDrop={(event) => dropAt(event, target ?? index)}
              {...stylex.props(
                styles.item,
                on && styles.picked,
                moving.includes(file.id) && styles.moving,
              )}
            >
              <MediaImage file={file} width={480} />
              <span {...stylex.props(styles.number)}>{index + 1}</span>
              {file.kind === "video" && file.durationMs ? (
                <span {...stylex.props(styles.length)}>{formatDuration(file.durationMs)}</span>
              ) : null}
              {/* Where a dropped file would land: before this one, or after it. */}
              {target === index && <span {...stylex.props(styles.insert, styles.insertBefore)} />}
              {target === index + 1 && index === files.length - 1 && (
                <span {...stylex.props(styles.insert, styles.insertAfter)} />
              )}
            </div>
          );
        }}
      />
      <input
        ref={input}
        type="file"
        multiple
        accept="video/*,image/*"
        {...stylex.props(styles.hidden)}
        onChange={(event) => {
          if (event.target.files?.length) onUpload([...event.target.files]);
          event.target.value = "";
        }}
      />
      <p {...stylex.props(styles.hint)}>
        Drag to reorder · drag a file out onto the grid to take it out · click files to pick several
      </p>
    </div>
  );
}
