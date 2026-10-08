import * as stylex from "@stylexjs/stylex";
import type { FileView } from "#/modules/storage/files.service";
import { colors, radius } from "../../../../../components/ui/tokens.stylex";
import { MediaImage } from "./media-image";

const styles = stylex.create({
  box: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    display: "block",
    flexShrink: 0,
    outline: `1px solid ${colors.border}`,
    outlineOffset: "-1px",
    overflow: "hidden",
  },
  sm: { height: "2.5rem", width: "2.5rem" },
  md: { height: "3.5rem", width: "3.5rem" },
});

/** A small square preview of a stored file. */
export function FileThumb({ file, size = "sm" }: { file: FileView; size?: "sm" | "md" }) {
  return (
    <span {...stylex.props(styles.box, styles[size])}>
      <MediaImage file={file} width={160} />
    </span>
  );
}
