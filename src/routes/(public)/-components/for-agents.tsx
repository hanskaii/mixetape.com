import * as stylex from "@stylexjs/stylex";
import { LandingCta } from "./landing-cta";

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

// Every MCP tool (modules/social/tools.ts), in the order agents see them.
const TOOLS = [
  "list_accounts",
  "list_posts",
  "get_post",
  "get_post_insights",
  "list_collections",
  "list_captions",
  "create_post",
  "update_post",
  "cancel_post",
  "retry_post",
  "set_thumbnail",
  "edit_published_post",
  "create_collection",
  "add_to_collection",
  "upload_caption",
  "list_comments",
  "post_comment",
  "reply_to_comment",
  "moderate_comment",
  "connect_channel",
  "get_connection",
  "choose_channels",
  "get_post_analytics",
  "get_account_analytics",
  "create_upload",
  "import_file",
  "list_files",
  "delete_file",
];

const MCP = `claude mcp add --transport http mixetape \\
  https://mixetape.com/mcp \\
  --header "Authorization: Bearer mxt_…"`;

const REST = `curl -X POST https://mixetape.com/api/v1/posts \\
  -H "Authorization: Bearer mxt_…" \\
  -H "Content-Type: application/json" \\
  -d '{"accountId":"…","mediaUrl":"https://…/video.mp4",
       "scheduledAt":"2026-10-02T17:30:00+07:00",
       "metadata":{"title":"Episode 12"}}'`;

const PROMISES = [
  {
    title: "Every action is a tool",
    text: "The same names and rules over MCP and REST, with plain errors an agent can act on.",
  },
  {
    title: "Durable by default",
    text: "Each post is a job that survives restarts, retries on its own and never publishes twice.",
  },
  {
    title: "You stay in control",
    text: "Each API key carries only the permissions you give it, and anything your agent schedules can be edited or cancelled until it goes out.",
  },
];

const styles = stylex.create({
  section: {
    backgroundColor: "#11110f",
    // Defines the panel on the dark theme, where the page is nearly the same black.
    borderColor: "#2e2d29",
    borderRadius: "22px",
    borderStyle: "solid",
    borderWidth: "1px",
    color: "#f8f7f3",
    display: "grid",
    gap: "2.5rem",
    paddingBlock: { default: "2.5rem", "@media (min-width: 640px)": "3.5rem" },
    paddingInline: { default: "1.75rem", "@media (min-width: 640px)": "2.75rem" },
    scrollMarginTop: "6rem",
  },
  top: {
    alignItems: "end",
    display: "grid",
    gap: "2rem",
    gridTemplateColumns: { default: "1fr", "@media (min-width: 900px)": "1fr auto" },
  },
  title: {
    fontSize: "clamp(2.5rem, 4.5vw, 4.5rem)",
    fontWeight: 600,
    letterSpacing: "-0.04em",
    lineHeight: 1.02,
    marginBlock: 0,
    maxWidth: "660px",
  },
  lede: {
    color: "#c3c0b8",
    lineHeight: 1.6,
    marginBlockEnd: 0,
    marginBlockStart: "1.25rem",
    maxWidth: "600px",
  },
  code: {
    display: "grid",
    gap: "1rem",
    gridTemplateColumns: { default: "1fr", "@media (min-width: 900px)": "1fr 1fr" },
  },
  block: {
    backgroundColor: "#1c1c19",
    borderColor: "#2e2d29",
    borderRadius: "16px",
    borderStyle: "solid",
    borderWidth: "1px",
    minWidth: 0,
    paddingBlock: "1rem",
    paddingInline: "1.1rem",
  },
  blockLabel: {
    color: "#a8a59c",
    fontSize: "0.8125rem",
    fontWeight: 600,
    marginBlockEnd: "0.6rem",
    marginBlockStart: 0,
  },
  pre: {
    color: "#e9e6de",
    fontFamily: MONO,
    fontSize: "0.75rem",
    lineHeight: 1.6,
    marginBlock: 0,
    overflowX: "auto",
    whiteSpace: "pre",
  },
  tools: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.4rem",
    listStyle: "none",
    marginBlock: 0,
    paddingInline: 0,
  },
  tool: {
    backgroundColor: "#1c1c19",
    borderColor: "#2e2d29",
    borderRadius: "8px",
    borderStyle: "solid",
    borderWidth: "1px",
    color: "#d8d5cc",
    fontFamily: MONO,
    fontSize: "0.75rem",
    paddingBlock: "0.3rem",
    paddingInline: "0.55rem",
  },
  promises: {
    borderBlockStartColor: "#2e2d29",
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: "1px",
    display: "grid",
    gap: "1.5rem",
    paddingBlockStart: "1.75rem",
    gridTemplateColumns: { default: "1fr", "@media (min-width: 768px)": "repeat(3, 1fr)" },
    listStyle: "none",
    marginBlock: 0,
    paddingInline: 0,
  },
  promiseTitle: {
    fontSize: "1.05rem",
    fontWeight: 600,
    margin: 0,
  },
  promiseText: {
    color: "#aaa69d",
    fontSize: "0.875rem",
    lineHeight: 1.6,
    marginBlockEnd: 0,
    marginBlockStart: "0.35rem",
  },
});

export function ForAgents({ signedIn }: { signedIn: boolean }) {
  return (
    <section id="agents" {...stylex.props(styles.section)}>
      <div {...stylex.props(styles.top)}>
        <div>
          <h2 {...stylex.props(styles.title)}>Agents first. The workspace watches.</h2>
          <p {...stylex.props(styles.lede)}>
            Everything mixetape does is a tool an agent can call: schedule, upload, reschedule,
            cancel and retry posts, manage what is already on YouTube, and read the analytics. The
            workspace is where you check on it.
          </p>
        </div>
        <LandingCta
          signedIn={signedIn}
          to="/api-keys"
          signedInLabel="Create an API key"
          signedOutLabel="Get an API key"
          compact
        />
      </div>

      <div {...stylex.props(styles.code)}>
        <div {...stylex.props(styles.block)}>
          <p {...stylex.props(styles.blockLabel)}>Claude Code, or any MCP client</p>
          <pre {...stylex.props(styles.pre)}>
            <code>{MCP}</code>
          </pre>
        </div>
        <div {...stylex.props(styles.block)}>
          <p {...stylex.props(styles.blockLabel)}>Any script, over REST</p>
          <pre {...stylex.props(styles.pre)}>
            <code>{REST}</code>
          </pre>
        </div>
      </div>

      <ul {...stylex.props(styles.tools)} aria-label="MCP tools">
        {TOOLS.map((tool) => (
          <li key={tool} {...stylex.props(styles.tool)}>
            {tool}
          </li>
        ))}
      </ul>

      <ul {...stylex.props(styles.promises)}>
        {PROMISES.map(({ title, text }) => (
          <li key={title}>
            <h3 {...stylex.props(styles.promiseTitle)}>{title}</h3>
            <p {...stylex.props(styles.promiseText)}>{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
