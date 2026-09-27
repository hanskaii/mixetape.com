import * as stylex from "@stylexjs/stylex";
import {
  FacebookLogo,
  InstagramLogo,
  PinterestLogo,
  ThreadsLogo,
  TiktokLogo,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { colors } from "../../../../../components/ui/tokens.stylex";

const styles = stylex.create({
  logo: { flexShrink: 0 },
  sm: { fontSize: "1.125rem" },
  md: { fontSize: "1.5rem" },
  lg: { fontSize: "2rem" },
  youtube: { color: "#ef4444" },
  facebook: { color: "#1877f2" },
  instagram: { color: "#d62976" },
  pinterest: { color: "#e60023" },
  ink: { color: colors.foreground },
});

/** A platform's mark: beside its name, or standing in for a channel with no picture. */
export function PlatformLogo({
  provider,
  size = "lg",
}: {
  provider: string;
  size?: "sm" | "md" | "lg";
}) {
  const props = (tint: stylex.StyleXStyles) => stylex.props(styles.logo, styles[size], tint);
  switch (provider) {
    case "facebook":
      return <FacebookLogo weight="fill" aria-hidden {...props(styles.facebook)} />;
    case "instagram":
      return <InstagramLogo weight="fill" aria-hidden {...props(styles.instagram)} />;
    case "threads":
      return <ThreadsLogo weight="fill" aria-hidden {...props(styles.ink)} />;
    case "tiktok":
      return <TiktokLogo weight="fill" aria-hidden {...props(styles.ink)} />;
    case "pinterest":
      return <PinterestLogo weight="fill" aria-hidden {...props(styles.pinterest)} />;
    default:
      return <YoutubeLogo weight="fill" aria-hidden {...props(styles.youtube)} />;
  }
}
