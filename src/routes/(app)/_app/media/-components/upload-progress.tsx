import * as stylex from "@stylexjs/stylex";
import { colors, radius } from "../../../../../components/ui/tokens.stylex";

const styles = stylex.create({
  root: { display: "grid", gap: "0.375rem", marginTop: "0.25rem", minWidth: "14rem" },
  name: {
    color: colors.mutedForeground,
    fontSize: "0.75rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  track: {
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    height: "0.25rem",
    overflow: "hidden",
  },
  failures: {
    display: "grid",
    gap: "0.25rem",
    listStyle: "none",
    margin: "0.25rem 0 0",
    padding: 0,
  },
  failure: { fontSize: "0.75rem", lineHeight: 1.4 },
  file: { fontWeight: 500 },
  bar: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    height: "100%",
    transformOrigin: "left",
    transitionDuration: "200ms",
    transitionProperty: "transform",
  },
});

/** Under an upload toast: the file on its way, and how far the whole batch is. */
export function UploadProgress({ name, progress }: { name: string; progress: number }) {
  return (
    <span {...stylex.props(styles.root)}>
      <span {...stylex.props(styles.name)}>{name}</span>
      <span {...stylex.props(styles.track)}>
        <span
          {...stylex.props(styles.bar)}
          style={{ transform: `scaleX(${Math.max(progress, 0.02)})` }}
        />
      </span>
    </span>
  );
}

/** Under a failed upload toast: which files did not make it, and why. */
export function UploadFailures({ failures }: { failures: { name: string; error: string }[] }) {
  return (
    <ul {...stylex.props(styles.failures)}>
      {failures.slice(0, 3).map((failure) => (
        <li key={failure.name} {...stylex.props(styles.failure)}>
          <span {...stylex.props(styles.file)}>{failure.name}</span> — {failure.error}
        </li>
      ))}
      {failures.length > 3 && (
        <li {...stylex.props(styles.failure)}>and {failures.length - 3} more</li>
      )}
    </ul>
  );
}
