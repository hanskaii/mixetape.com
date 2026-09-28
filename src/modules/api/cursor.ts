import { sql, type SQLWrapper } from "drizzle-orm";
import { ServiceError } from "./errors";

/**
 * Opaque page cursors for lists ordered newest first by (time, id): a page ends at a row and
 * the next starts after it, so pages never skip or repeat a row even when several share a
 * time. The cursor is only a marker, never trusted beyond its shape.
 */

export function encodeCursor(at: Date, id: string): string {
  return btoa(JSON.stringify([at.getTime(), id]));
}

export function decodeCursor(cursor: string): { at: Date; id: string } {
  try {
    const [at, id] = JSON.parse(atob(cursor)) as [number, string];
    if (typeof at !== "number" || typeof id !== "string") throw new Error();
    return { at: new Date(at), id };
  } catch {
    throw new ServiceError("cursor is not one this API gave out — use nextCursor as it came");
  }
}

/**
 * Whether a text column holds `text` anywhere, ignoring case. instr rather than LIKE: D1
 * refuses LIKE patterns over 50 bytes, which a long search easily passes.
 */
export const contains = (column: SQLWrapper, text: string) =>
  sql`instr(lower(coalesce(${column}, '')), ${text.toLowerCase()}) > 0`;

/** A page of `limit` from rows fetched with `limit + 1`, and the cursor to the next one. */
export function page<T>(rows: T[], limit: number, marker: (row: T) => { at: Date; id: string }) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const next = rows.length > limit && last ? marker(last) : null;
  return { items, nextCursor: next ? encodeCursor(next.at, next.id) : null };
}
