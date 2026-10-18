import * as stylex from "@stylexjs/stylex";
import { Butterfly } from "@phosphor-icons/react/Butterfly";
import { FacebookLogo } from "@phosphor-icons/react/FacebookLogo";
import { InstagramLogo } from "@phosphor-icons/react/InstagramLogo";
import { MastodonLogo } from "@phosphor-icons/react/MastodonLogo";
import { PinterestLogo } from "@phosphor-icons/react/PinterestLogo";
import { ThreadsLogo } from "@phosphor-icons/react/ThreadsLogo";
import { TiktokLogo } from "@phosphor-icons/react/TiktokLogo";
import { YoutubeLogo } from "@phosphor-icons/react/YoutubeLogo";
import { colors } from "./tokens.stylex";

const styles = stylex.create({
  logo: { flexShrink: 0 },
  xs: { fontSize: "0.8125rem" },
  sm: { fontSize: "1.125rem" },
  md: { fontSize: "1.5rem" },
  lg: { fontSize: "2rem" },
  youtube: { color: "#ef4444" },
  facebook: { color: "#1877f2" },
  instagram: { color: "#d62976" },
  pinterest: { color: "#e60023" },
  bluesky: { color: "#1185fe" },
  mastodon: { color: "#6364ff" },
  ink: { color: colors.foreground },
});

/** A platform's mark: beside its name, or standing in for a channel with no picture. */
export function PlatformLogo({
  provider,
  size = "lg",
}: {
  provider: string;
  size?: "xs" | "sm" | "md" | "lg";
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
    case "bluesky":
      return <Butterfly weight="fill" aria-hidden {...props(styles.bluesky)} />;
    case "mastodon":
      return <MastodonLogo weight="fill" aria-hidden {...props(styles.mastodon)} />;
    default:
      return <YoutubeLogo weight="fill" aria-hidden {...props(styles.youtube)} />;
  }
}
