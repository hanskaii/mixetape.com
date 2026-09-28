import { useRef } from "react";
import { CalendarCheck, Check, File as FileIcon, Hourglass, Play } from "@phosphor-icons/react";
import type { FileView } from "#/modules/storage/files.service";
import { daysLeft, formatDuration } from "../-lib/format";

/**
 * A file in the masonry: the picture itself, a video that plays silently on hover, and just
 * enough on top of it — its length, whether it is scheduled, when storage lets it go.
 */
export function FileCard({
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
  onToggle: (event: React.MouseEvent | React.KeyboardEvent) => void;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const left = daysLeft(file.expiresAt);

  return (
    <div
      role="checkbox"
      aria-checked={selected}
      aria-label={file.name}
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onToggle(event);
        }
      }}
      onMouseEnter={() => void video.current?.play().catch(() => {})}
      onMouseLeave={() => {
        if (!video.current) return;
        video.current.pause();
        video.current.currentTime = 0.5;
      }}
      className={`group relative size-full cursor-pointer overflow-hidden rounded-2xl bg-muted outline-none transition-[box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] ${selected ? "ring-[3px] ring-primary" : "ring-1 ring-border"}`}
    >
      {file.kind === "image" ? (
        <img
          src={file.publicUrl}
          alt=""
          loading="lazy"
          draggable={false}
          className="size-full object-cover"
        />
      ) : file.kind === "video" ? (
        <video
          ref={video}
          src={`${file.publicUrl}#t=0.5`}
          preload="metadata"
          muted
          loop
          playsInline
          className="size-full object-cover"
        />
      ) : (
        <span className="grid size-full place-items-center text-muted-foreground">
          <FileIcon size={28} />
        </span>
      )}

      {/* The checkbox: always there once something is selected, else on hover. */}
      <span
        aria-hidden
        className={`absolute left-2 top-2 grid size-6 place-items-center rounded-full border-2 transition-opacity ${selected ? "border-primary bg-primary text-primary-foreground opacity-100" : `border-white/90 bg-black/25 text-transparent ${selecting ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}`}
      >
        {order > 0 ? (
          <span className="text-[11px] font-bold tabular-nums">{order}</span>
        ) : (
          <Check size={13} weight="bold" />
        )}
      </span>

      <span className="absolute right-2 top-2 flex flex-col items-end gap-1">
        {scheduled > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
            <CalendarCheck size={12} weight="bold" /> Scheduled
          </span>
        )}
        {left <= 7 && (
          <span
            title={`Storage deletes it in ${left} day${left === 1 ? "" : "s"}`}
            className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm"
          >
            <Hourglass size={12} /> {left}d
          </span>
        )}
      </span>

      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent px-2.5 pb-2 pt-8 text-white">
        <span className="min-w-0 truncate text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
          {file.name}
        </span>
        {file.kind === "video" && file.durationMs ? (
          <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] tabular-nums">
            <Play size={10} weight="fill" /> {formatDuration(file.durationMs)}
          </span>
        ) : null}
      </span>
    </div>
  );
}
