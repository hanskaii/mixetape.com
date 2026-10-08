import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { File as FileIcon } from "@phosphor-icons/react";
import type { FileView } from "#/modules/storage/files.service";
import { colors } from "../../../../../components/ui/tokens.stylex";
import { imageThumb, videoFrame, type ThumbWidth } from "../-lib/thumbs";

const styles = stylex.create({
  media: { display: "block", height: "100%", objectFit: "cover", width: "100%" },
  icon: {
    alignItems: "center",
    color: colors.mutedForeground,
    display: "flex",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
});

/**
 * A file shown small: a resized image, or a video's frame — both made at the edge, so the
 * grid never downloads originals. If the edge cannot make one (a very large video, an
 * unusual format), the original stands in.
 */
export function MediaImage({
  file,
  width,
  style,
}: {
  file: FileView;
  width: ThumbWidth;
  style?: StyleXStyles;
}) {
  const [fallback, setFallback] = useState(false);
  if (file.kind === "image")
    return (
      <img
        src={fallback ? file.publicUrl : imageThumb(file.publicUrl, width)}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFallback(true)}
        {...stylex.props(styles.media, style)}
      />
    );
  if (file.kind === "video")
    return fallback ? (
      <video
        src={`${file.publicUrl}#t=0.5`}
        preload="metadata"
        muted
        playsInline
        {...stylex.props(styles.media, style)}
      />
    ) : (
      <img
        src={videoFrame(file.publicUrl, width)}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setFallback(true)}
        {...stylex.props(styles.media, style)}
      />
    );
  return (
    <span {...stylex.props(styles.icon, style)}>
      <FileIcon size={22} />
    </span>
  );
}
