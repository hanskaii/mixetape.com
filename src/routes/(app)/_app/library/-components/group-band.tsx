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
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import type { GroupView } from "#/modules/library/groups.service";
import { saveGroup, ungroupFiles } from "#/modules/library/library.fn";
import type { FileView } from "#/modules/storage/files.service";
import { colors, radius } from "../../../../../components/ui/tokens.stylex";
import { formatDuration, selectionSummary } from "../-lib/format";
import { FILES_TYPE, FROM_GROUP_TYPE } from "./group-card";
import { MediaImage } from "./media-image";

const TILE = 168; // px: the files' height in the band

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
    gap: "0.75rem",
    padding: "0.75rem",
    scrollMarginBlock: "6rem",
  },
  bandOver: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 14%, transparent)`,
    borderColor: colors.primary,
  },
  head: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" },
  who: { alignItems: "center", display: "flex", flexGrow: 1, gap: "0.625rem", minWidth: "12rem" },
  mark: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    color: colors.primaryForeground,
    display: "flex",
    flexShrink: 0,
    height: "2rem",
    justifyContent: "center",
    width: "2rem",
  },
  names: { display: "grid", gap: "0.125rem", minWidth: 0 },
  name: {
    backgroundColor: "transparent",
    borderRadius: radius.sm,
    borderStyle: "none",
    color: colors.foreground,
    cursor: "text",
    fontSize: "0.875rem",
    fontWeight: 600,
    overflow: "hidden",
    padding: 0,
    textAlign: "start",
    textDecoration: { default: "none", ":hover": "underline dotted" },
    textOverflow: "ellipsis",
    textUnderlineOffset: "4px",
    whiteSpace: "nowrap",
  },
  untitled: { color: colors.mutedForeground },
  rename: { height: "2rem", maxWidth: "20rem" },
  meta: {
    alignItems: "center",
    color: colors.mutedForeground,
    display: "flex",
    flexWrap: "wrap",
    fontSize: "0.75rem",
    gap: "0.375rem",
  },
  actions: { alignItems: "center", display: "flex", gap: "0.375rem", marginInlineStart: "auto" },
  strip: {
    alignItems: "stretch",
    display: "flex",
    gap: "0.5rem",
    minHeight: `${TILE}px`,
    overflowX: "auto",
    paddingBlock: "0.125rem 0.375rem",
    scrollbarWidth: "thin",
  },
  item: {
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    boxShadow: `0 0 0 1px ${colors.border}`,
    cursor: { default: "grab", ":active": "grabbing" },
    flexShrink: 0,
    height: `${TILE}px`,
    outline: { default: "none", ":focus-visible": `2px solid ${colors.ring}` },
    overflow: "hidden",
    position: "relative",
    transitionDuration: "120ms",
    transitionProperty: "box-shadow, opacity, margin",
  },
  picked: { boxShadow: `0 0 0 3px ${colors.primary}` },
  moving: { opacity: 0.35 },
  // A gap opens where a dropped file would land.
  before: { marginInlineStart: "1.5rem" },
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
    flexShrink: 0,
    fontSize: "0.75rem",
    gap: "0.375rem",
    height: `${TILE}px`,
    justifyContent: "center",
    paddingInline: "1rem",
    width: "7.5rem",
  },
  addOver: { borderColor: colors.primary, color: colors.foreground },
  hint: { color: colors.mutedForeground, fontSize: "0.6875rem", margin: 0 },
  hidden: { display: "none" },
  menu: { minWidth: "14rem" },
});

const width = (file: FileView) =>
  Math.round(
    TILE * Math.min(Math.max(file.width && file.height ? file.width / file.height : 1, 0.56), 1.78),
  );

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

  return (
    <div
      ref={band}
      role="group"
      aria-label={`Group: ${group.title || "untitled"}`}
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
      <div {...stylex.props(styles.head)}>
        <div {...stylex.props(styles.who)}>
          <span {...stylex.props(styles.mark)}>
            <Stack size={16} weight="bold" />
          </span>
          <div {...stylex.props(styles.names)}>
            {renaming ? (
              <Input
                autoFocus
                aria-label="Group name"
                value={title}
                placeholder="Untitled group"
                style={styles.rename}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => void rename()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void rename();
                  if (event.key === "Escape") {
                    setTitle(group.title ?? "");
                    setRenaming(false);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                title="Rename"
                onClick={() => setRenaming(true)}
                {...stylex.props(styles.name, !group.title && styles.untitled)}
              >
                {group.title || "Untitled group"}
              </button>
            )}
            <span {...stylex.props(styles.meta)}>
              {group.createdBy === "agent" && <Robot size={12} aria-label="Made by an agent" />}
              {files.length ? selectionSummary(files) : "Empty"}
              {(group.caption || group.description) && (
                <Badge variant="secondary">
                  <PencilSimpleLine /> Caption ready
                </Badge>
              )}
            </span>
          </div>
        </div>

        <div {...stylex.props(styles.actions)}>
          {pickedHere.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => void takeOut(pickedHere)}>
              <ArrowSquareOut /> Take out {pickedHere.length}
            </Button>
          )}
          <Button size="sm" disabled={!files.length} onClick={() => onPublish({ ...group, files })}>
            <PaperPlaneTilt weight="fill" /> Publish
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button size="icon-sm" variant="ghost" aria-label="More">
                  <DotsThree weight="bold" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" style={styles.menu}>
              <DropdownMenuItem onClick={() => onDelete(false)}>
                <X /> Ungroup — keep the files
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(true)}>
                <Trash /> Delete the group and its files
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Collapse the group"
            onClick={onCollapse}
          >
            <CaretUp weight="bold" />
          </Button>
        </div>
      </div>

      <div {...stylex.props(styles.strip)}>
        {files.map((file, index) => {
          const on = picked.includes(file.id);
          return (
            <div
              key={file.id}
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
                target === index && styles.before,
              )}
              style={{ width: width(file) }}
            >
              <MediaImage file={file} width={480} />
              <span {...stylex.props(styles.number)}>{index + 1}</span>
              {file.kind === "video" && file.durationMs ? (
                <span {...stylex.props(styles.length)}>{formatDuration(file.durationMs)}</span>
              ) : null}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => input.current?.click()}
          {...stylex.props(styles.add, target === files.length && styles.addOver)}
        >
          <Plus size={18} />
          {files.length ? "Drop or add files" : "Drop files here"}
        </button>
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
      </div>
      <p {...stylex.props(styles.hint)}>
        Drag to reorder · drag a file out onto the grid to take it out · click files to pick several
      </p>
    </div>
  );
}
