import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { ArrowDown, ArrowRight, Check, Copy } from "@phosphor-icons/react";
import { siteConfig } from "#/config/site";
import { colors } from "../../../components/ui/tokens.stylex";

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

type Workflow = "Terminal" | "IDE" | "Desktop";

// Each agent's setup lives in the docs (docs/src/content/docs/connect-an-agent/<slug>.mdx).
// Icons: public/icons/agents/<icon>-{light,dark}.svg.
const AGENTS: {
  slug: string;
  icon: string;
  vendor: string;
  name: string;
  text: string;
  workflows: Workflow[];
}[] = [
  {
    slug: "claude-code",
    icon: "claude",
    vendor: "Anthropic",
    name: "Claude Code",
    text: "Anthropic's coding agent, in the terminal, your IDE or the desktop app. mixetape goes in with one command.",
    workflows: ["Terminal", "IDE", "Desktop"],
  },
  {
    slug: "codex",
    icon: "codex",
    vendor: "OpenAI",
    name: "Codex",
    text: "OpenAI's coding agent, as a terminal CLI and a desktop app. mixetape goes in its config.toml.",
    workflows: ["Terminal", "Desktop"],
  },
  {
    slug: "cursor",
    icon: "cursor",
    vendor: "Cursor",
    name: "Cursor",
    text: "The AI-first editor built on VS Code, with agents that edit across files. mixetape goes in its mcp.json.",
    workflows: ["IDE"],
  },
  {
    slug: "opencode",
    icon: "opencode",
    vendor: "Open source",
    name: "OpenCode",
    text: "The open-source coding agent for the terminal, with any model. mixetape goes in its opencode.json.",
    workflows: ["Terminal"],
  },
];

const FILTERS: ("All" | Workflow)[] = ["All", "Terminal", "IDE", "Desktop"];

// Pasted into any agent: it reads the setup page (Markdown, for agents) and does the rest.
const PROMPT = `Set up mixetape for me. Read ${siteConfig.docsUrl}/connect-an-agent/mcp/index.md, then add the mixetape MCP server (https://mixetape.com/mcp) to this agent. Ask me for my API key — I can create one at https://mixetape.com/api-keys. Once it is connected, call list_accounts and show me my channels.`;

const docs = (path: string) => `${siteConfig.docsUrl}${path}`;

const styles = stylex.create({
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "4rem",
    paddingBlock: { default: "3.5rem", "@media (min-width: 768px)": "5rem" },
    scrollMarginTop: "5rem",
  },
  intro: { alignItems: "center", display: "flex", flexDirection: "column", textAlign: "center" },
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
    maxWidth: "34rem",
  },
  actions: {
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    gap: "0.75rem",
    justifyContent: "center",
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
  pick: { display: "flex", flexDirection: "column", gap: "1.75rem", scrollMarginTop: "5rem" },
  pickHead: { textAlign: "center" },
  pickTitle: {
    color: colors.foreground,
    fontSize: "clamp(1.5rem, 3vw, 2rem)",
    fontWeight: 600,
    letterSpacing: "-0.03em",
    margin: 0,
  },
  pickLede: { color: colors.mutedForeground, marginBlockEnd: 0, marginBlockStart: "0.5rem" },
  filters: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" },
  filtersLabel: { color: colors.mutedForeground, fontSize: "0.875rem", marginInlineEnd: "0.25rem" },
  chip: {
    backgroundColor: { default: "transparent", ":hover": colors.muted },
    borderColor: colors.border,
    borderRadius: "9999px",
    borderStyle: "solid",
    borderWidth: "1px",
    color: colors.foreground,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "0.875rem",
    fontWeight: 500,
    height: "2.125rem",
    paddingInline: "0.875rem",
  },
  chipOn: {
    backgroundColor: { default: colors.primary, ":hover": colors.primary },
    borderColor: colors.primary,
    color: colors.primaryForeground,
  },
  // Hairlines between the cards: the grid's background shows through a 1px gap.
  grid: {
    backgroundColor: colors.border,
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: "1px",
    display: "grid",
    gap: "1px",
    gridTemplateColumns: {
      default: "1fr",
      "@media (min-width: 640px)": "repeat(2, 1fr)",
      "@media (min-width: 1024px)": "repeat(4, 1fr)",
    },
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  card: {
    backgroundColor: colors.background,
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    padding: "1.5rem",
  },
  cardHead: { alignItems: "center", display: "flex", gap: "0.875rem" },
  tile: {
    alignItems: "center",
    backgroundColor: colors.muted,
    borderRadius: "0.625rem",
    display: "flex",
    flexShrink: 0,
    height: "2.5rem",
    justifyContent: "center",
    width: "2.5rem",
  },
  vendor: {
    color: colors.editorial,
    fontFamily: MONO,
    fontSize: "0.6875rem",
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  name: { color: colors.foreground, fontSize: "1.125rem", fontWeight: 600, margin: 0 },
  text: {
    color: colors.mutedForeground,
    flexGrow: 1,
    fontSize: "0.9375rem",
    lineHeight: 1.6,
    margin: 0,
  },
  guide: {
    alignItems: "center",
    color: colors.foreground,
    display: "inline-flex",
    fontSize: "0.875rem",
    fontWeight: 600,
    gap: "0.375rem",
    textDecoration: { default: "none", ":hover": "underline" },
    textUnderlineOffset: "4px",
  },
  empty: {
    backgroundColor: colors.background,
    color: colors.mutedForeground,
    gridColumn: "1 / -1",
    padding: "2rem",
    textAlign: "center",
  },
  more: {
    color: colors.mutedForeground,
    fontSize: "0.9375rem",
    margin: 0,
    textAlign: "center",
  },
  link: {
    color: colors.foreground,
    fontWeight: 600,
    textDecoration: "underline",
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
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [copied, setCopied] = useState(false);
  const shown = AGENTS.filter((agent) => filter === "All" || agent.workflows.includes(filter));

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section id="agents" {...stylex.props(styles.section)}>
      <div {...stylex.props(styles.intro)}>
        <h2 {...stylex.props(styles.title)}>Connect your agent</h2>
        <p {...stylex.props(styles.lede)}>
          Give your coding agent a mixetape key, and it schedules, reschedules and reports on your
          posts from the terminal or the editor.
        </p>
        <div {...stylex.props(styles.actions)}>
          <button
            type="button"
            onClick={copyPrompt}
            title="A setup prompt to paste into any agent"
            {...stylex.props(styles.copy)}
          >
            <span aria-hidden="true" {...stylex.props(styles.stack)}>
              {AGENTS.map((agent) => (
                <AgentIcon key={agent.icon} icon={agent.icon} size={18} />
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
          <a href="#pick-agent" {...stylex.props(styles.browse)}>
            Browse agents <ArrowDown weight="bold" />
          </a>
        </div>
      </div>

      <div id="pick-agent" {...stylex.props(styles.pick)}>
        <div {...stylex.props(styles.pickHead)}>
          <h3 {...stylex.props(styles.pickTitle)}>Pick your agent</h3>
          <p {...stylex.props(styles.pickLede)}>
            Each guide takes you from an API key to a first scheduled post.
          </p>
        </div>

        <div role="group" aria-label="Filter by workflow" {...stylex.props(styles.filters)}>
          <span {...stylex.props(styles.filtersLabel)}>Filter by workflow:</span>
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
              {...stylex.props(styles.chip, filter === item && styles.chipOn)}
            >
              {item}
            </button>
          ))}
        </div>

        <ul {...stylex.props(styles.grid)}>
          {shown.map((agent) => (
            <li key={agent.slug} {...stylex.props(styles.card)}>
              <div {...stylex.props(styles.cardHead)}>
                <span aria-hidden="true" {...stylex.props(styles.tile)}>
                  <AgentIcon icon={agent.icon} size={22} />
                </span>
                <div>
                  <div {...stylex.props(styles.vendor)}>{agent.vendor}</div>
                  <h4 {...stylex.props(styles.name)}>{agent.name}</h4>
                </div>
              </div>
              <p {...stylex.props(styles.text)}>{agent.text}</p>
              <a href={docs(`/connect-an-agent/${agent.slug}`)} {...stylex.props(styles.guide)}>
                View guide <ArrowRight weight="bold" />
              </a>
            </li>
          ))}
        </ul>

        <p {...stylex.props(styles.more)}>
          Another MCP client, or a script?{" "}
          <a href={docs("/connect-an-agent/mcp")} {...stylex.props(styles.link)}>
            Any MCP client
          </a>{" "}
          works the same way, and every tool is also a{" "}
          <a href={docs("/connect-an-agent/rest-api")} {...stylex.props(styles.link)}>
            REST endpoint
          </a>
          .
        </p>
      </div>
    </section>
  );
}
