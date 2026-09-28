import { File as FileIcon } from "@phosphor-icons/react";
import type { FileView } from "#/modules/storage/files.service";

const SIZES = { sm: "size-10", md: "size-14" } as const;

/** A small square preview of a stored file: its picture, a video's first frame, or an icon. */
export function FileThumb({ file, size = "sm" }: { file?: FileView; size?: keyof typeof SIZES }) {
  const box = `${SIZES[size]} shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border`;
  if (file?.kind === "image")
    return <img src={file.publicUrl} alt="" loading="lazy" className={`${box} object-cover`} />;
  if (file?.kind === "video")
    return (
      // #t skips a black first frame; metadata is all the browser fetches.
      <video
        src={`${file.publicUrl}#t=0.5`}
        preload="metadata"
        muted
        playsInline
        aria-hidden
        className={`${box} object-cover`}
      />
    );
  return (
    <span className={`${box} grid place-items-center text-muted-foreground`}>
      <FileIcon size={18} />
    </span>
  );
}
