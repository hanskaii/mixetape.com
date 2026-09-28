import type { FileView } from "#/modules/storage/files.service";
import { imageThumb, videoFrame } from "./thumbs";

const SIZE = 96;

/**
 * What the pointer carries when several files are dragged: a small fanned stack of them
 * (the grabbed one on top) with how many there are, instead of the one card the browser
 * would show. The thumbnails are the grid's own, so they are already in the cache.
 */
export function setStackDragImage(event: React.DragEvent, files: FileView[]) {
  if (files.length < 2) return;
  const stack = document.createElement("div");
  Object.assign(stack.style, {
    height: `${SIZE + 24}px`,
    left: "-1000px",
    pointerEvents: "none",
    position: "fixed",
    top: "-1000px",
    width: `${SIZE + 32}px`,
  });
  const shown = files.slice(0, 3);
  // Drawn back to front, so the grabbed file ends on top.
  [...shown].reverse().forEach((file, back) => {
    const depth = shown.length - 1 - back;
    const card = document.createElement(
      file.kind === "image" || file.kind === "video" ? "img" : "div",
    );
    if (card instanceof HTMLImageElement)
      card.src =
        file.kind === "image" ? imageThumb(file.publicUrl, 480) : videoFrame(file.publicUrl, 480);
    Object.assign(card.style, {
      background: "var(--muted)",
      border: "2px solid var(--card)",
      borderRadius: "12px",
      boxShadow: "0 6px 16px rgb(0 0 0 / 0.25)",
      height: `${SIZE}px`,
      left: `${4 + depth * 9}px`,
      objectFit: "cover",
      position: "absolute",
      top: `${4 + depth * 5}px`,
      transform: `rotate(${depth * 6}deg)`,
      width: `${SIZE}px`,
    });
    stack.appendChild(card);
  });
  const count = document.createElement("span");
  count.textContent = String(files.length);
  Object.assign(count.style, {
    background: "var(--primary)",
    borderRadius: "999px",
    color: "var(--primary-foreground)",
    font: "600 12px/22px 'Geist Variable', system-ui, sans-serif",
    minWidth: "22px",
    padding: "0 6px",
    position: "absolute",
    right: "0",
    textAlign: "center",
    top: "0",
  });
  stack.appendChild(count);
  document.body.appendChild(stack);
  event.dataTransfer.setDragImage(stack, SIZE / 2, SIZE / 2);
  // The browser has its picture once the event is over.
  requestAnimationFrame(() => stack.remove());
}
