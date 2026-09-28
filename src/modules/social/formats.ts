import type { MediaFormats, MediaKind } from "./providers/types";

/**
 * Whether a set of files can go out as one post on a platform, before it is scheduled.
 * `problems` make the post impossible; `warnings` are allowed but probably not what the
 * author wants (a horizontal video as a Reel). What is not known about a file — an https
 * URL mixetape never read — is not held against it.
 */

export type FileFacts = {
  /** "video", "image", or anything else (mixetape storage's "other"). */
  kind: string;
  contentType?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  name?: string;
};

export type FormatCheck = {
  format: "video" | "image" | "carousel" | null;
  problems: string[];
  warnings: string[];
};

const isMedia = (kind: string): kind is MediaKind => kind === "video" || kind === "image";

const seconds = (ms: number) =>
  ms % 60_000 === 0 && ms >= 60_000 ? `${ms / 60_000} min` : `${Math.round(ms / 1000)} s`;

export function checkFormat(
  name: string,
  formats: MediaFormats,
  files: readonly FileFacts[],
): FormatCheck {
  const problems: string[] = [];
  const warnings: string[] = [];
  if (!files.length) return { format: null, problems: ["No file to post"], warnings };

  const label = (file: FileFacts, index: number) =>
    files.length > 1 ? `File ${index + 1}${file.name ? ` (${file.name})` : ""}` : "The file";

  let format: FormatCheck["format"];
  if (files.length > 1) {
    format = "carousel";
    const carousel = formats.carousel;
    if (!carousel) problems.push(`${name} takes one file per post, not ${files.length}`);
    else {
      if (files.length < carousel.min || files.length > carousel.max)
        problems.push(
          `A ${name} carousel takes ${carousel.min}–${carousel.max} files, not ${files.length}`,
        );
      files.forEach((file, index) => {
        if (isMedia(file.kind) && !carousel.kinds.includes(file.kind))
          problems.push(
            `${label(file, index)}: a ${name} carousel takes only ${carousel.kinds.join(" and ")}s`,
          );
      });
    }
  } else format = files[0].kind === "image" ? "image" : "video";

  files.forEach((file, index) => {
    const which = label(file, index);
    if (!isMedia(file.kind)) {
      problems.push(`${which} is neither a video nor an image`);
      return;
    }
    if (file.kind === "video" && !formats.video) problems.push(`${name} does not take videos`);
    if (file.kind === "image" && !formats.image) problems.push(`${name} does not take images`);
    if (
      file.kind === "image" &&
      formats.imageTypes &&
      file.contentType &&
      !formats.imageTypes.includes(file.contentType) &&
      !formats.convertsImages?.includes(file.contentType)
    )
      problems.push(
        `${which}: ${name} takes ${formats.imageTypes.map((type) => type.replace("image/", "").toUpperCase()).join(" or ")} images, not ${file.contentType.replace("image/", "").toUpperCase()}`,
      );
    if (
      file.kind === "image" &&
      file.contentType &&
      formats.convertsImages?.includes(file.contentType)
    )
      warnings.push(
        `${which} goes to ${name} as JPEG (${name} takes no ${file.contentType.replace("image/", "").toUpperCase()})`,
      );
    if (file.kind === "video" && file.durationMs) {
      if (formats.minVideoMs && file.durationMs < formats.minVideoMs)
        problems.push(`${which} is shorter than the ${seconds(formats.minVideoMs)} ${name} needs`);
      if (formats.maxVideoMs && file.durationMs > formats.maxVideoMs)
        problems.push(`${which} is longer than the ${seconds(formats.maxVideoMs)} ${name} takes`);
    }
    if (formats.vertical && file.width && file.height && file.width > file.height)
      warnings.push(`${which} is horizontal; ${name} shows upright (9:16) media best`);
  });

  return { format, problems: [...new Set(problems)], warnings: [...new Set(warnings)] };
}

/** A file's kind from its name or URL, for media mixetape has not read (an https URL). */
export function kindFromUrl(url: string): MediaKind {
  return /\.(jpe?g|png|webp|gif|heic|bmp|tiff?)(\?|#|$)/i.test(url) ? "image" : "video";
}
