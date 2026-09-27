import { Link } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";
import { ArrowRight } from "@phosphor-icons/react";
import { useModal } from "#/components/providers/modal-providers";
import { colors } from "../../../components/ui/tokens.stylex";

const styles = stylex.create({
  primary: {
    alignItems: "center",
    backgroundColor: { default: "#ffd337", ":hover": "#ffe16a" },
    borderColor: "#ebc62c",
    borderRadius: "12px",
    borderStyle: "solid",
    borderWidth: "1px",
    color: "#11110f",
    cursor: "pointer",
    display: "inline-flex",
    fontFamily: "inherit",
    fontSize: "1.1rem",
    fontWeight: 700,
    gap: "1.2rem",
    justifyContent: "center",
    letterSpacing: "-0.025em",
    minHeight: "52px",
    outlineColor: colors.ring,
    outlineOffset: "3px",
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: "3px",
    paddingBlock: "0.75rem",
    paddingInline: "1.5rem",
    textDecoration: "none",
    transform: { default: "none", ":hover": "translateY(-1px)" },
    transitionDuration: "180ms",
    transitionProperty: "background-color, transform",
  },
  compact: {
    borderRadius: "12px",
    fontSize: "1rem",
    gap: "0.5rem",
    minHeight: "48px",
    paddingInline: "1.25rem",
  },
  icon: { flexShrink: 0, height: "1.25rem", width: "1.25rem" },
});

/**
 * The landing page's one primary action: into the workspace for someone signed in,
 * otherwise the sign-in modal. `to` picks the workspace page it leads to.
 */
export function LandingCta({
  signedIn,
  signedInLabel,
  signedOutLabel,
  to = "/queue",
  compact = false,
}: {
  signedIn: boolean;
  signedInLabel: string;
  signedOutLabel: string;
  to?: "/queue" | "/api-keys" | "/channels";
  compact?: boolean;
}) {
  const { openLogin } = useModal();
  const look = stylex.props(styles.primary, compact && styles.compact);
  const arrow = <ArrowRight {...stylex.props(styles.icon)} weight="bold" />;

  return signedIn ? (
    <Link to={to} {...look}>
      {signedInLabel} {arrow}
    </Link>
  ) : (
    <button type="button" onClick={() => openLogin()} {...look}>
      {signedOutLabel} {arrow}
    </button>
  );
}
