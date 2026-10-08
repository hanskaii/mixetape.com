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

/**
 * How long until storage lets go of a file, "5h" / "5 hours"; under an hour, "<1h" — the
 * hourly cleanup takes it on its next run.
 */
export function timeLeft(expiresAt: Date | string) {
  const hours = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 3_600_000);
  if (hours <= 1) return { short: "<1h", long: "less than an hour" };
  if (hours < 48) return { short: `${hours}h`, long: `${hours} hours` };
  const days = Math.ceil(hours / 24);
  return { short: `${days}d`, long: `${days} days` };
}
