/**
 * What a stored file is, read from the file itself rather than taken on trust: its kind, and
 * for pictures and videos their size in pixels and a video's duration. Reads only the parts
 * it needs (a header, an MP4's `moov` box) through ranged reads, never the whole file.
 *
 * Understood: JPEG, PNG, GIF and WebP images; MP4/MOV (ISO BMFF) videos. Anything else keeps
 * the kind its content type says, without dimensions.
 */

export type Probe = {
  kind: "video" | "image" | "other";
  width?: number;
  height?: number;
  durationMs?: number;
};

/** Reads `length` bytes at `offset` (fewer at the end of the file). */
export type RangeReader = (offset: number, length: number) => Promise<Uint8Array>;

const MAX_MOOV = 32 * 1024 * 1024; // a moov box larger than this is not worth reading
const text = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

function view(bytes: Uint8Array) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export async function probe(contentType: string, size: number, read: RangeReader): Promise<Probe> {
  const head = await read(0, Math.min(size, 64 * 1024));
  const type = contentType.toLowerCase();

  const image = imageSize(head) ?? (isJpeg(head) ? await jpegSize(read, size) : null);
  if (image) return { kind: "image", ...image };

  if (text(head, 4, 4) === "ftyp") {
    const video = await mp4Info(read, size).catch(() => null);
    return { kind: "video", ...video };
  }
  if (type.startsWith("video/")) return { kind: "video" };
  if (type.startsWith("image/")) return { kind: "image" };
  return { kind: "other" };
}

// ── images ────────────────────────────────────────────────────────────────────

const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8;

/** PNG, GIF and WebP keep their size in the first few dozen bytes. */
function imageSize(b: Uint8Array): { width: number; height: number } | null {
  const v = view(b);
  if (b.length >= 24 && b[0] === 0x89 && text(b, 1, 3) === "PNG") {
    return { width: v.getUint32(16), height: v.getUint32(20) };
  }
  if (b.length >= 10 && text(b, 0, 3) === "GIF") {
    return { width: v.getUint16(6, true), height: v.getUint16(8, true) };
  }
  if (b.length >= 30 && text(b, 0, 4) === "RIFF" && text(b, 8, 4) === "WEBP") {
    const chunk = text(b, 12, 4);
    if (chunk === "VP8 ")
      return { width: v.getUint16(26, true) & 0x3fff, height: v.getUint16(28, true) & 0x3fff };
    if (chunk === "VP8L") {
      const bits = v.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") {
      const w = b[24] | (b[25] << 8) | (b[26] << 16);
      const h = b[27] | (b[28] << 8) | (b[29] << 16);
      return { width: w + 1, height: h + 1 };
    }
  }
  return null;
}

/** A JPEG's size is in its first SOF segment, after any EXIF — walked segment by segment. */
async function jpegSize(read: RangeReader, size: number) {
  let offset = 2;
  for (let i = 0; i < 256 && offset + 9 < size; i++) {
    const seg = await read(offset, 10);
    if (seg[0] !== 0xff) return null;
    const marker = seg[1];
    // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      const v = view(seg);
      return { height: v.getUint16(5), width: v.getUint16(7) };
    }
    offset += 2 + view(seg).getUint16(2);
  }
  return null;
}

// ── MP4 / MOV ─────────────────────────────────────────────────────────────────

type Box = { type: string; start: number; end: number };

/** The boxes directly inside `bytes[start, end)`. */
function* boxes(bytes: Uint8Array, start: number, end: number): Generator<Box> {
  const v = view(bytes);
  let offset = start;
  while (offset + 8 <= end) {
    let length = v.getUint32(offset);
    let header = 8;
    if (length === 1) {
      length = Number(v.getBigUint64(offset + 8));
      header = 16;
    } else if (length === 0) length = end - offset;
    if (length < header) return;
    yield {
      type: text(bytes, offset + 4, 4),
      start: offset + header,
      end: Math.min(offset + length, end),
    };
    offset += length;
  }
}

const child = (bytes: Uint8Array, box: Box, type: string) =>
  [...boxes(bytes, box.start, box.end)].find((b) => b.type === type);

/** Finds the top-level `moov` box (at the start or, often, after `mdat`) and reads it. */
async function mp4Info(read: RangeReader, size: number) {
  let offset = 0;
  for (let i = 0; i < 64 && offset + 8 <= size; i++) {
    const header = await read(offset, 16);
    const v = view(header);
    let length = v.getUint32(0);
    if (length === 1) length = Number(v.getBigUint64(8));
    else if (length === 0) length = size - offset;
    if (length < 8) break;
    if (text(header, 4, 4) === "moov") {
      if (length > MAX_MOOV) return null;
      const moov = await read(offset, length);
      return parseMoov(moov);
    }
    offset += length;
  }
  return null;
}

function parseMoov(bytes: Uint8Array) {
  const [moov] = [...boxes(bytes, 0, bytes.length)];
  if (!moov || moov.type !== "moov") return null;
  const v = view(bytes);
  const result: { width?: number; height?: number; durationMs?: number } = {};

  const mvhd = child(bytes, moov, "mvhd");
  if (mvhd) {
    const version = bytes[mvhd.start];
    const timescale = v.getUint32(mvhd.start + (version === 1 ? 20 : 12));
    const duration =
      version === 1 ? Number(v.getBigUint64(mvhd.start + 24)) : v.getUint32(mvhd.start + 16);
    if (timescale) result.durationMs = Math.round((duration / timescale) * 1000);
  }

  for (const trak of boxes(bytes, moov.start, moov.end)) {
    if (trak.type !== "trak") continue;
    const mdia = child(bytes, trak, "mdia");
    const hdlr = mdia && child(bytes, mdia, "hdlr");
    if (!hdlr || text(bytes, hdlr.start + 8, 4) !== "vide") continue;
    const tkhd = child(bytes, trak, "tkhd");
    if (!tkhd) continue;
    const shift = bytes[tkhd.start] === 1 ? 12 : 0;
    const width = Math.round(v.getUint32(tkhd.start + 76 + shift) / 65536);
    const height = Math.round(v.getUint32(tkhd.start + 80 + shift) / 65536);
    // A track rotated a quarter turn (a phone filming upright) shows the other way round.
    const a = v.getInt32(tkhd.start + 40 + shift);
    const b = v.getInt32(tkhd.start + 44 + shift);
    const quarterTurn = a === 0 && Math.abs(b) === 65536;
    result.width = quarterTurn ? height : width;
    result.height = quarterTurn ? width : height;
    break;
  }
  return result;
}
