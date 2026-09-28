import type { FileView } from "#/modules/storage/files.service";

export function formatDuration(ms: number) {
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

type Facts = Pick<FileView, "kind" | "width" | "height" | "durationMs">;

const shape = (file: Facts) =>
  file.width && file.height
    ? file.width === file.height
      ? "Square"
      : file.height > file.width
        ? "Vertical"
        : "Landscape"
    : null;

/** What a selection is, as a person would say it: "Carousel · 4 images", "Vertical video · 0:42". */
export function selectionSummary(files: Facts[]) {
  if (!files.length) return "";
  if (files.length > 1) {
    const images = files.filter((file) => file.kind === "image").length;
    const videos = files.filter((file) => file.kind === "video").length;
    const parts = [
      images && `${images} image${images > 1 ? "s" : ""}`,
      videos && `${videos} video${videos > 1 ? "s" : ""}`,
    ].filter(Boolean);
    return `Carousel · ${parts.join(" + ")}`;
  }
  const [file] = files;
  const kind = file.kind === "video" ? "video" : file.kind === "image" ? "image" : "file";
  const what = [shape(file), kind].filter(Boolean).join(" ");
  const label = what.charAt(0).toUpperCase() + what.slice(1);
  return file.durationMs ? `${label} · ${formatDuration(file.durationMs)}` : label;
}

/** Days until storage lets go of a file. */
export const daysLeft = (expiresAt: Date | string) =>
  Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
