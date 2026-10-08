import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { ArrowRight, Check, Copy } from "@phosphor-icons/react";
import { siteConfig } from "#/config/site";
import { colors } from "../../../components/ui/tokens.stylex";

// Each agent's guide is in the docs (connect-an-agent/<slug>).
// Icons: public/icons/agents/<icon>-{light,dark}.svg.
const AGENTS = [
  { icon: "claude", name: "Claude Code" },
  { icon: "codex", name: "Codex" },
  { icon: "cursor", name: "Cursor" },
  { icon: "opencode", name: "OpenCode" },
];

// Pasted into any agent: it reads the setup page (Markdown, for agents) and does the rest.
const PROMPT = `Set up mixetape for me. Read ${siteConfig.docsUrl}/connect-an-agent/mcp/index.md, then add the mixetape MCP server (https://mixetape.com/mcp) to this agent. Ask me for my API key — I can create one at https://mixetape.com/api-keys. Once it is connected, call list_accounts and show me my channels.`;

const AGENTS_GUIDE = `${siteConfig.docsUrl}/connect-an-agent/mcp`;

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

// The landing's section pattern (how-it-works, FAQ): a rule on top, the heading on the
// left, the substance on the right.
const styles = stylex.create({
  section: {
    alignItems: "start",
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: "1px",
    display: "grid",
    gap: "2.25rem",
    gridTemplateColumns: { default: "1fr", "@media (min-width: 768px)": "0.8fr 1.2fr" },
    paddingBlock: "5rem",
    scrollMarginTop: "6rem",
  },
  title: {
    color: colors.foreground,
    fontSize: "clamp(2.7rem, 5vw, 4.7rem)",
    fontWeight: 600,
    letterSpacing: "-0.04em",
    lineHeight: 1,
    margin: 0,
  },
  serif: {
    color: colors.editorial,
    fontFamily: "var(--font-editorial)",
    fontWeight: 400,
    letterSpacing: "-0.025em",
  },
  lede: {
    color: colors.mutedForeground,
    fontSize: "1.0625rem",
    lineHeight: 1.6,
    marginBlockEnd: 0,
    marginBlockStart: "1.25rem",
    maxWidth: "28rem",
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: "22px",
    borderStyle: "solid",
    borderWidth: "1px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  cardHead: {
    alignItems: "center",
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: "1px",
    display: "flex",
    gap: "1rem",
    justifyContent: "space-between",
    paddingBlock: "0.75rem",
    paddingInline: { default: "1rem", "@media (min-width: 640px)": "1.5rem" },
  },
  label: {
    color: colors.mutedForeground,
    fontFamily: MONO,
    fontSize: "0.7rem",
    fontWeight: 600,
    letterSpacing: "0.16em",
    margin: 0,
    textTransform: "uppercase",
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
    fontSize: "0.875rem",
    fontWeight: 600,
    gap: "0.5rem",
    height: "2.25rem",
    paddingInline: "0.875rem",
    transitionDuration: "150ms",
    transitionProperty: "background-color",
  },
  prompt: {
    color: colors.foreground,
    fontFamily: MONO,
    fontSize: "0.8125rem",
    lineHeight: 1.7,
    margin: 0,
    paddingBlock: "1.25rem",
    paddingInline: { default: "1rem", "@media (min-width: 640px)": "1.5rem" },
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  cardFoot: {
    alignItems: "center",
    backgroundColor: colors.muted,
    display: "flex",
    flexWrap: "wrap",
    gap: "1rem",
    justifyContent: "space-between",
    paddingBlock: "1rem",
    paddingInline: { default: "1rem", "@media (min-width: 640px)": "1.5rem" },
  },
  agents: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem 1rem",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  agent: {
    alignItems: "center",
    color: colors.foreground,
    display: "inline-flex",
    fontSize: "0.875rem",
    fontWeight: 500,
    gap: "0.4rem",
  },
  browse: {
    alignItems: "center",
    color: colors.foreground,
    display: "inline-flex",
    fontSize: "0.875rem",
    fontWeight: 600,
    gap: "0.375rem",
    textDecoration: { default: "none", ":hover": "underline" },
    textUnderlineOffset: "4px",
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
      <div>
        <h2 {...stylex.props(styles.title)}>
          Connect your <em {...stylex.props(styles.serif)}>agent</em>
        </h2>
        <p {...stylex.props(styles.lede)}>
          Give Claude Code, Codex, Cursor, OpenCode or any MCP client a mixetape key, and it
          schedules, reschedules and reports on your posts from the terminal or the editor. Scripts
          get the same actions over REST.
        </p>
      </div>

      <div {...stylex.props(styles.card)}>
        <div {...stylex.props(styles.cardHead)}>
          <p {...stylex.props(styles.label)}>Paste into your agent</p>
          <button type="button" onClick={copyPrompt} {...stylex.props(styles.copy)}>
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
        </div>
        <p {...stylex.props(styles.prompt)}>{PROMPT}</p>
        <div {...stylex.props(styles.cardFoot)}>
          <ul aria-label="Works with" {...stylex.props(styles.agents)}>
            {AGENTS.map((agent) => (
              <li key={agent.icon} {...stylex.props(styles.agent)}>
                <AgentIcon icon={agent.icon} size={16} />
                {agent.name}
              </li>
            ))}
          </ul>
          <a href={AGENTS_GUIDE} {...stylex.props(styles.browse)}>
            Browse agents <ArrowRight weight="bold" />
          </a>
        </div>
      </div>
    </section>
  );
}
