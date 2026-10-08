import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { ArrowRight, Check, Copy } from "@phosphor-icons/react";
import { siteConfig } from "#/config/site";
import { colors } from "../../../components/ui/tokens.stylex";

// Shown on the copy button; each agent's guide is in the docs (connect-an-agent/<slug>).
// Icons: public/icons/agents/<icon>-{light,dark}.svg.
const AGENT_ICONS = ["claude", "codex", "cursor", "opencode"];

// Pasted into any agent: it reads the setup page (Markdown, for agents) and does the rest.
const PROMPT = `Set up mixetape for me. Read ${siteConfig.docsUrl}/connect-an-agent/mcp/index.md, then add the mixetape MCP server (https://mixetape.com/mcp) to this agent. Ask me for my API key — I can create one at https://mixetape.com/api-keys. Once it is connected, call list_accounts and show me my channels.`;

const AGENTS_GUIDE = `${siteConfig.docsUrl}/connect-an-agent/mcp`;

const styles = stylex.create({
  section: {
    display: "flex",
    flexDirection: "column",
    paddingBlock: { default: "3.5rem", "@media (min-width: 768px)": "5rem" },
    scrollMarginTop: "5rem",
  },
  title: {
    color: colors.foreground,
    fontSize: "clamp(2.5rem, 5vw, 4rem)",
    fontWeight: 600,
    letterSpacing: "-0.04em",
    lineHeight: 1.02,
    margin: 0,
  },
  lede: {
    color: colors.mutedForeground,
    fontSize: "1.0625rem",
    lineHeight: 1.6,
    marginBlockEnd: 0,
    marginBlockStart: "1rem",
    maxWidth: "36rem",
  },
  actions: {
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    gap: "0.75rem",
    marginBlockStart: "2rem",
  },
  copy: {
    alignItems: "center",
    backgroundColor: { default: "transparent", ":hover": colors.muted },
    borderColor: colors.border,
    borderRadius: "9999px",
    borderStyle: "solid",
    borderWidth: "1px",
    color: colors.foreground,
    cursor: "pointer",
    display: "inline-flex",
    fontFamily: "inherit",
    fontSize: "0.9375rem",
    fontWeight: 600,
    gap: "0.625rem",
    height: "2.75rem",
    paddingInline: "1rem",
    transitionDuration: "150ms",
    transitionProperty: "background-color",
  },
  stack: { alignItems: "center", display: "flex", gap: "0.25rem" },
  browse: {
    alignItems: "center",
    backgroundColor: {
      default: colors.primary,
      ":hover": `color-mix(in oklab, ${colors.primary} 85%, transparent)`,
    },
    borderRadius: "9999px",
    color: colors.primaryForeground,
    display: "inline-flex",
    fontSize: "0.9375rem",
    fontWeight: 600,
    gap: "0.5rem",
    height: "2.75rem",
    paddingInline: "1.125rem",
    textDecoration: "none",
    transitionDuration: "150ms",
    transitionProperty: "background-color",
  },
});

/** An agent's mark, in the variant that reads on the current theme. */
function AgentIcon({ icon, size }: { icon: string; size: number }) {
  return (
    <>
      <img
        src={`/icons/agents/${icon}-light.svg`}
        alt=""
        width={size}
        height={size}
        className="block dark:hidden"
      />
      <img
        src={`/icons/agents/${icon}-dark.svg`}
        alt=""
        width={size}
        height={size}
        className="hidden dark:block"
      />
    </>
  );
}

export function ForAgents() {
  const [copied, setCopied] = useState(false);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section id="agents" {...stylex.props(styles.section)}>
      <h2 {...stylex.props(styles.title)}>Connect your agent</h2>
      <p {...stylex.props(styles.lede)}>
        Give Claude Code, Codex, Cursor, OpenCode or any MCP client a mixetape key, and it
        schedules, reschedules and reports on your posts from the terminal or the editor. Scripts
        get the same actions over REST.
      </p>
      <div {...stylex.props(styles.actions)}>
        <button
          type="button"
          onClick={copyPrompt}
          title="A setup prompt to paste into any agent"
          {...stylex.props(styles.copy)}
        >
          <span aria-hidden="true" {...stylex.props(styles.stack)}>
            {AGENT_ICONS.map((icon) => (
              <AgentIcon key={icon} icon={icon} size={18} />
            ))}
          </span>
          {copied ? (
            <>
              <Check weight="bold" /> Copied
            </>
          ) : (
            <>
              <Copy weight="bold" /> Copy prompt
            </>
          )}
        </button>
        <a href={AGENTS_GUIDE} {...stylex.props(styles.browse)}>
          Browse agents <ArrowRight weight="bold" />
        </a>
      </div>
    </section>
  );
}
