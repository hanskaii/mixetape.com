import * as stylex from "@stylexjs/stylex";
import { ChannelAvatar } from "./channel-avatar";
import { PlatformLogo } from "./platform-logo";
import { colors, radius } from "./tokens.stylex";

type Channel = { id: string; name: string; provider: string; avatar: string | null };

const styles = stylex.create({
  stack: { alignItems: "center", display: "inline-flex", flexShrink: 0 },
  // Each avatar tucks under the one before it; its tooltip shows on hover or focus.
  item: {
    "--tip": { default: "0", ":hover": "1", ":focus-visible": "1" },
    borderRadius: radius.lg,
    boxShadow: `0 0 0 2px ${colors.card}`,
    display: "inline-flex",
    marginInlineStart: { default: "-0.375rem", ":first-child": 0 },
    outline: "none",
    position: "relative",
    transform: {
      default: "none",
      ":hover": {
        default: "translateY(-3px) scale(1.12) rotate(-3deg)",
        "@media (prefers-reduced-motion: reduce)": "none",
      },
      ":focus-visible": {
        default: "translateY(-3px) scale(1.12) rotate(-3deg)",
        "@media (prefers-reduced-motion: reduce)": "none",
      },
    },
    transitionDuration: "180ms",
    transitionProperty: "transform",
    transitionTimingFunction: "ease-out",
    zIndex: { default: "auto", ":hover": 2, ":focus-visible": 2 },
  },
  tip: {
    alignItems: "center",
    backgroundColor: "#161616",
    borderRadius: radius.lg,
    bottom: "calc(100% + 8px)",
    boxShadow: "0 8px 20px rgb(0 0 0 / 0.3)",
    color: "white",
    display: "flex",
    fontSize: "0.75rem",
    fontWeight: 500,
    gap: "0.375rem",
    left: "50%",
    opacity: "var(--tip)",
    paddingBlock: "0.375rem",
    paddingInline: "0.625rem",
    pointerEvents: "none",
    position: "absolute",
    transform: "translate(-50%, calc((1 - var(--tip)) * 4px))",
    transitionDuration: "180ms",
    transitionProperty: "opacity, transform",
    whiteSpace: "nowrap",
    zIndex: 10,
  },
  arrow: {
    backgroundColor: "#161616",
    bottom: "-0.25rem",
    height: "0.5rem",
    left: "50%",
    position: "absolute",
    transform: "translateX(-50%) rotate(45deg)",
    width: "0.5rem",
  },
  more: {
    alignItems: "center",
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    boxShadow: `0 0 0 2px ${colors.card}`,
    color: colors.mutedForeground,
    display: "inline-flex",
    fontSize: "0.6875rem",
    fontWeight: 600,
    justifyContent: "center",
    marginInlineStart: "-0.375rem",
    position: "relative",
  },
  sm: { height: "1.5rem", minWidth: "1.5rem" },
  md: { height: "2rem", minWidth: "2rem" },
});

/**
 * A few channels as overlapping avatars; each lifts on hover and names itself with its
 * platform, the way the landing page's platform icons do.
 */
export function AvatarStack({
  channels,
  size = "sm",
  max = 5,
  focusable = true,
}: {
  channels: Channel[];
  size?: "sm" | "md";
  max?: number;
  /** Off inside a control (a button), which is the one thing to focus there. */
  focusable?: boolean;
}) {
  const shown = channels.slice(0, max);
  const rest = channels.length - shown.length;
  return (
    <span {...stylex.props(styles.stack)}>
      {shown.map((channel) => (
        <span
          key={channel.id}
          tabIndex={focusable ? 0 : undefined}
          aria-label={focusable ? channel.name : undefined}
          {...stylex.props(styles.item)}
        >
          <ChannelAvatar
            provider={channel.provider}
            avatar={channel.avatar}
            name={channel.name}
            size={size}
            badge={false}
          />
          <span aria-hidden="true" {...stylex.props(styles.tip)}>
            <PlatformLogo provider={channel.provider} size="xs" />
            {channel.name}
            <span {...stylex.props(styles.arrow)} />
          </span>
        </span>
      ))}
      {rest > 0 && <span {...stylex.props(styles.more, styles[size])}>+{rest}</span>}
    </span>
  );
}
