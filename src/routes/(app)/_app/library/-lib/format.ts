import type { FileView } from "#/modules/storage/files.service";

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

export function formatDuration(ms: number) {
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

/** "Video · 1080×1920 · 0:42 · 12 MB" — what a file is, at a glance. */
export function fileSummary(file: FileView) {
  return [
    file.kind === "video" ? "Video" : file.kind === "image" ? "Image" : "File",
    file.width && file.height ? `${file.width}×${file.height}` : null,
    file.durationMs ? formatDuration(file.durationMs) : null,
    formatBytes(file.size),
  ]
    .filter(Boolean)
    .join(" · ");
}
