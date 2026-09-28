import * as stylex from "@stylexjs/stylex";
import { PlatformLogo } from "./platform-logo";
import { colors } from "./tokens.stylex";

const styles = stylex.create({
  root: { display: "inline-flex", flexShrink: 0, position: "relative" },
  sm: { height: "1.5rem", width: "1.5rem" },
  md: { height: "2rem", width: "2rem" },
  picture: {
    backgroundColor: colors.muted,
    borderRadius: "0.5rem",
    height: "100%",
    objectFit: "cover",
    width: "100%",
  },
  initial: {
    alignItems: "center",
    color: colors.mutedForeground,
    display: "flex",
    fontSize: "0.75rem",
    fontWeight: 600,
    justifyContent: "center",
  },
  // The platform's mark in the corner, cut out of the surface the avatar sits on.
  badge: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: "0.3125rem",
    bottom: "-0.3125rem",
    display: "flex",
    justifyContent: "center",
    lineHeight: 0,
    padding: "1px",
    position: "absolute",
    right: "-0.3125rem",
  },
});

/**
 * A connected channel's picture with its platform's mark in the corner — the one way a
 * channel is shown across the workspace. Falls back to the name's initial without a picture.
 */
export function ChannelAvatar({
  provider,
  avatar,
  name,
  size = "md",
}: {
  provider: string;
  avatar?: string | null;
  name: string;
  size?: "sm" | "md";
}) {
  return (
    <span {...stylex.props(styles.root, styles[size])}>
      {avatar ? (
        <img src={avatar} alt="" {...stylex.props(styles.picture)} />
      ) : (
        <span aria-hidden="true" {...stylex.props(styles.picture, styles.initial)}>
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
      <span aria-hidden="true" {...stylex.props(styles.badge)}>
        <PlatformLogo provider={provider} size="xs" />
      </span>
    </span>
  );
}
