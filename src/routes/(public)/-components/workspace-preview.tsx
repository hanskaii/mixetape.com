import * as stylex from "@stylexjs/stylex";
import { CalendarBlank, Key, PlugsConnected } from "@phosphor-icons/react";
import { colors } from "../../../components/ui/tokens.stylex";

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

type Status = "Scheduled" | "Published" | "Uploaded" | "Failed";

const ROWS: { title: string; channel: string; time: string; status: Status; by: string }[] = [
  {
    title: "Episode 12 — long video",
    channel: "YouTube",
    time: "Fri, 17:30",
    status: "Scheduled",
    by: "Agent",
  },
  {
    title: "Episode 12 — Short 1",
    channel: "YouTube",
    time: "Sat, 11:30",
    status: "Scheduled",
    by: "Agent",
  },
  {
    title: "Episode 11 — long video",
    channel: "YouTube",
    time: "Fri, 17:30",
    status: "Published",
    by: "Agent",
  },
  {
    title: "Channel trailer",
    channel: "YouTube",
    time: "Thu, 12:00",
    status: "Uploaded",
    by: "You",
  },
  {
    title: "Episode 11 — Short 4",
    channel: "YouTube",
    time: "Sun, 19:30",
    status: "Failed",
    by: "Agent",
  },
];

const styles = stylex.create({
  frame: {
    backgroundColor: colors.card,
    borderColor: "#e7dcc8",
    borderRadius: "22px",
    borderStyle: "solid",
    borderWidth: "1px",
    boxShadow: "0 18px 48px -40px rgba(35, 25, 8, 0.35)",
    marginInlineStart: { default: 0, "@media (min-width: 1024px)": "1rem" },
    overflow: "hidden",
    padding: "0.5rem",
  },
  inner: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: "16px",
    borderStyle: "solid",
    borderWidth: "1px",
    display: "grid",
    gridTemplateColumns: { default: "1fr", "@media (min-width: 768px)": "215px minmax(0, 1fr)" },
    minHeight: "390px",
    overflow: "hidden",
  },
  aside: {
    borderInlineEndColor: colors.border,
    borderInlineEndStyle: "solid",
    borderInlineEndWidth: "1px",
    display: { default: "none", "@media (min-width: 768px)": "flex" },
    flexDirection: "column",
    paddingBlock: "1.25rem",
    paddingInline: "1rem",
  },
  brand: {
    fontSize: "1.25rem",
    fontWeight: 700,
    letterSpacing: "-0.06em",
    marginBlock: 0,
    paddingInline: "0.5rem",
  },
  nav: { display: "grid", fontSize: "0.875rem", gap: "0.25rem", marginBlockStart: "1.75rem" },
  navItem: {
    alignItems: "center",
    borderRadius: "8px",
    color: colors.mutedForeground,
    display: "flex",
    gap: "0.5rem",
    paddingBlock: "0.5rem",
    paddingInline: "0.75rem",
  },
  navActive: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 20%, transparent)`,
    color: colors.foreground,
    fontWeight: 600,
  },
  navIcon: { height: "1rem", width: "1rem" },
  asideFoot: {
    color: colors.mutedForeground,
    fontFamily: MONO,
    fontSize: "0.625rem",
    letterSpacing: "0.16em",
    marginBlockEnd: 0,
    marginBlockStart: "auto",
    paddingInline: "0.5rem",
    textTransform: "uppercase",
  },
  main: {
    minWidth: 0,
    paddingBlock: "1.25rem",
    paddingInline: { default: "1.25rem", "@media (min-width: 640px)": "1.75rem" },
  },
  head: {
    alignItems: "flex-start",
    display: "flex",
    flexWrap: "wrap",
    gap: "1rem",
    justifyContent: "space-between",
  },
  kicker: {
    color: colors.mutedForeground,
    fontFamily: MONO,
    fontSize: "0.625rem",
    letterSpacing: "0.14em",
    marginBlock: 0,
    textTransform: "uppercase",
  },
  title: {
    fontSize: { default: "1.5rem", "@media (min-width: 640px)": "1.75rem" },
    fontWeight: 600,
    letterSpacing: "-0.055em",
    marginBlockEnd: 0,
    marginBlockStart: "0.25rem",
  },
  sub: { color: colors.mutedForeground, fontSize: "0.875rem", marginBlock: 0 },
  button: {
    backgroundColor: "#11110f",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "0.75rem",
    fontWeight: 600,
    paddingBlock: "0.5rem",
    paddingInline: "1rem",
  },
  tableWrap: { marginBlockStart: "0.75rem", overflowX: "auto" },
  table: {
    borderCollapse: "collapse",
    fontSize: "0.8125rem",
    minWidth: "640px",
    textAlign: "left",
    width: "100%",
  },
  th: {
    borderBlockEndColor: colors.border,
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: "1px",
    color: colors.mutedForeground,
    fontSize: "0.75rem",
    fontWeight: 400,
    paddingBlockEnd: "0.5rem",
  },
  tr: {
    borderBlockEndColor: { default: colors.border, ":last-child": "transparent" },
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: "1px",
  },
  td: { paddingBlock: "0.9rem" },
  tdTitle: { fontWeight: 600 },
  tdMuted: { color: colors.mutedForeground },
  tdTime: { fontFamily: MONO, fontSize: "0.75rem" },
  by: {
    backgroundColor: colors.muted,
    borderRadius: "6px",
    color: colors.mutedForeground,
    fontFamily: MONO,
    fontSize: "0.65rem",
    paddingBlock: "0.15rem",
    paddingInline: "0.4rem",
  },
  status: {
    alignItems: "center",
    backgroundColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
    borderRadius: "6px",
    display: "inline-flex",
    fontSize: "0.75rem",
    fontWeight: 500,
    gap: "0.4rem",
    paddingBlock: "0.25rem",
    paddingInline: "0.5rem",
  },
  statusFailed: {
    backgroundColor: `color-mix(in oklab, ${colors.destructive} 10%, transparent)`,
    color: colors.destructive,
  },
  statusPublished: { backgroundColor: "rgba(5, 150, 105, 0.1)", color: "#065f46" },
  swatch: {
    backgroundColor: colors.primary,
    borderRadius: "9999px",
    height: "0.5rem",
    width: "0.5rem",
  },
  swatchFailed: { backgroundColor: colors.destructive },
  swatchPublished: { backgroundColor: "#059669" },
  note: {
    color: colors.mutedForeground,
    fontSize: "0.75rem",
    marginBlockEnd: 0,
    marginBlockStart: "1.25rem",
  },
});

export function WorkspacePreview() {
  return (
    <section {...stylex.props(styles.frame)} aria-label="Illustrative workspace preview">
      <div {...stylex.props(styles.inner)}>
        <aside {...stylex.props(styles.aside)}>
          <p {...stylex.props(styles.brand)}>mixetape</p>
          <div {...stylex.props(styles.nav)}>
            <span {...stylex.props(styles.navItem, styles.navActive)}>
              <CalendarBlank {...stylex.props(styles.navIcon)} /> Publish
            </span>
            <span {...stylex.props(styles.navItem)}>
              <PlugsConnected {...stylex.props(styles.navIcon)} /> Channels
            </span>
            <span {...stylex.props(styles.navItem)}>
              <Key {...stylex.props(styles.navIcon)} /> API keys
            </span>
          </div>
          <p {...stylex.props(styles.asideFoot)}>YouTube today</p>
        </aside>

        <div {...stylex.props(styles.main)}>
          <div {...stylex.props(styles.head)}>
            <div>
              <p {...stylex.props(styles.kicker)}>Illustrative workspace</p>
              <h2 {...stylex.props(styles.title)}>Content queue</h2>
              <p {...stylex.props(styles.sub)}>
                Everything your agents and your team scheduled, in one place.
              </p>
            </div>
            <span {...stylex.props(styles.button)}>+ Schedule</span>
          </div>

          <div {...stylex.props(styles.tableWrap)}>
            <table {...stylex.props(styles.table)}>
              <thead>
                <tr>
                  <th {...stylex.props(styles.th)}>Post</th>
                  <th {...stylex.props(styles.th)}>Channel</th>
                  <th {...stylex.props(styles.th)}>By</th>
                  <th {...stylex.props(styles.th)}>Go live</th>
                  <th {...stylex.props(styles.th)}>Status</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.title} {...stylex.props(styles.tr)}>
                    <td {...stylex.props(styles.td, styles.tdTitle)}>{row.title}</td>
                    <td {...stylex.props(styles.td, styles.tdMuted)}>{row.channel}</td>
                    <td {...stylex.props(styles.td)}>
                      <span {...stylex.props(styles.by)}>{row.by}</span>
                    </td>
                    <td {...stylex.props(styles.td, styles.tdTime)}>{row.time}</td>
                    <td {...stylex.props(styles.td)}>
                      <span
                        {...stylex.props(
                          styles.status,
                          row.status === "Failed" && styles.statusFailed,
                          row.status === "Published" && styles.statusPublished,
                        )}
                      >
                        <span
                          {...stylex.props(
                            styles.swatch,
                            row.status === "Failed" && styles.swatchFailed,
                            row.status === "Published" && styles.swatchPublished,
                          )}
                        />
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p {...stylex.props(styles.note)}>
            Example data. Your own queue shows live post status and the actions available.
          </p>
        </div>
      </div>
    </section>
  );
}
