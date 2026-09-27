import * as stylex from "@stylexjs/stylex";
import {
  FacebookLogo,
  InstagramLogo,
  PinterestLogo,
  ThreadsLogo,
  TiktokLogo,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { colors } from "../../../components/ui/tokens.stylex";

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

// `soon`: mixetape has no app on that platform yet, so it cannot be connected — say so
// rather than present it as live (PRODUCT.md, Honest surface).
const PLATFORMS = [
  { name: "TikTok", Icon: TiktokLogo, color: "bg-[#101010]", soon: true },
  { name: "YouTube", Icon: YoutubeLogo, color: "bg-[#ff0033]", soon: false },
  {
    name: "Instagram",
    Icon: InstagramLogo,
    color: "bg-gradient-to-br from-[#833ab4] via-[#fd1d1d] to-[#fcb045]",
    soon: false,
  },
  { name: "Threads", Icon: ThreadsLogo, color: "bg-[#101010]", soon: true },
  { name: "Facebook", Icon: FacebookLogo, color: "bg-[#1877f2]", soon: false },
  { name: "Pinterest", Icon: PinterestLogo, color: "bg-[#e60023]", soon: true },
] as const;

const styles = stylex.create({
  section: {
    alignItems: { default: "flex-start", "@media (min-width: 1024px)": "center" },
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: "1px",
    display: "flex",
    flexDirection: { default: "column", "@media (min-width: 1024px)": "row" },
    gap: { default: "1rem", "@media (min-width: 1024px)": "1.25rem" },
    marginBlockStart: "2.5rem",
    paddingBlock: "1.5rem",
  },
  heading: {
    color: colors.mutedForeground,
    flexShrink: 0,
    fontFamily: MONO,
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.16em",
    marginBlock: 0,
    textTransform: "uppercase",
    width: { default: "auto", "@media (min-width: 1024px)": "9rem" },
  },
});

/** The providers with publishing workflows; the icons describe the platform, not a navigation action. */
export function Platforms() {
  return (
    <section {...stylex.props(styles.section)} aria-labelledby="platforms-heading">
      <h2 id="platforms-heading" {...stylex.props(styles.heading)}>
        Publishes to
      </h2>
      <ul className="flex flex-wrap items-center gap-2.5" aria-label="Publishing platforms">
        {PLATFORMS.map(({ name, Icon, color, soon }, index) => (
          <li key={name} className="group relative list-none">
            <span
              role="img"
              tabIndex={0}
              aria-label={soon ? `${name}, coming soon` : name}
              className={`flex size-10 cursor-default items-center justify-center rounded-[10px] text-white shadow-[0_4px_10px_rgba(0,0,0,0.24)] ring-1 ring-black/10 outline-none transition-[transform,box-shadow] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background group-hover:-translate-y-1.5 group-hover:scale-110 group-hover:shadow-[0_12px_22px_rgba(0,0,0,0.3)] group-focus-within:-translate-y-1.5 group-focus-within:scale-110 motion-reduce:transform-none motion-reduce:transition-none dark:ring-white/20 ${index % 2 ? "group-hover:rotate-3" : "group-hover:-rotate-3"} ${color}`}
            >
              <Icon size={23} weight="fill" aria-hidden="true" />
            </span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-[calc(100%+11px)] left-1/2 z-10 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg bg-[#161616] px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-[opacity,transform] duration-200 group-hover:-translate-y-1 group-hover:opacity-100 group-focus-within:-translate-y-1 group-focus-within:opacity-100 motion-reduce:transition-none"
            >
              {soon ? `${name} · coming soon` : name}
              <span className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-[#161616]" />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
