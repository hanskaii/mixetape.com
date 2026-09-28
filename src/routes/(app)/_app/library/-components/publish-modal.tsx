import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";
import { Check, CheckCircle, SpinnerGap, Warning, WarningCircle } from "@phosphor-icons/react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { ChannelAvatar } from "#/components/ui/channel-avatar";
import { Field } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Modal, ModalDescription, ModalHeader, ModalTitle } from "#/components/ui/modal";
import { PlatformLogo } from "#/components/ui/platform-logo";
import { Segmented } from "#/components/ui/segmented";
import { Switch } from "#/components/ui/switch";
import { Textarea } from "#/components/ui/textarea";
import type { JsonValue } from "#/database/schema";
import { planSelection, publishSelection } from "#/modules/library/library.fn";
import type { PlanRow } from "#/modules/library/publish.service";
import type { Field as FieldSpec } from "#/modules/social/fields";
import type { FileView } from "#/modules/storage/files.service";
import { colors, radius } from "../../../../../components/ui/tokens.stylex";
import { selectionSummary } from "../-lib/format";
import { FileThumb } from "./file-thumb";
import { PlatformForm } from "./platform-form";

type Values = Record<string, JsonValue>;
type Account = {
  id: string;
  name: string;
  provider: string;
  avatar: string | null;
  status: string;
};
type Brand = { id: string; name: string; accountIds: string[] };
type Platform = {
  id: string;
  name: string;
  fields: FieldSpec[];
  takesTitle: boolean;
  takesDescription: boolean;
};
export type PublishDraft = {
  title?: string | null;
  caption?: string | null;
  description?: string | null;
  metadata?: Values;
};
type Result = Awaited<ReturnType<typeof publishSelection>>;

const isObject = (value: JsonValue | undefined): value is Values =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Tomorrow, on the hour, as a datetime-local value in the reader's time zone. */
function tomorrow() {
  const date = new Date(Date.now() + 24 * 3600_000);
  date.setMinutes(0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`;
}

const turn = stylex.keyframes({ to: { transform: "rotate(360deg)" } });

const styles = stylex.create({
  spin: {
    animationDuration: "900ms",
    animationIterationCount: "infinite",
    animationName: turn,
    animationTimingFunction: "linear",
  },
  modal: { maxWidth: "42rem", padding: 0 },
  frame: { display: "flex", flexDirection: "column", maxHeight: "88vh" },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
    overflowY: "auto",
    padding: "1.5rem",
  },
  keep: { flexShrink: 0 },
  strip: { display: "flex", gap: "0.5rem", marginTop: "-0.25rem", overflowX: "auto" },
  section: { display: "grid", flexShrink: 0, gap: "0.625rem" },
  heading: {
    color: colors.mutedForeground,
    fontSize: "0.6875rem",
    fontWeight: 600,
    letterSpacing: "0.12em",
    margin: 0,
    textTransform: "uppercase",
  },
  headRow: {
    alignItems: "center",
    display: "flex",
    gap: "0.5rem",
    justifyContent: "space-between",
  },
  link: {
    backgroundColor: "transparent",
    borderStyle: "none",
    color: { default: colors.mutedForeground, ":hover": colors.foreground },
    cursor: "pointer",
    fontSize: "0.75rem",
    fontWeight: 500,
    padding: 0,
    textDecoration: { default: "none", ":hover": "underline" },
    textUnderlineOffset: "4px",
  },
  chips: { display: "flex", flexWrap: "wrap", gap: "0.375rem" },
  chip: {
    backgroundColor: { default: "transparent", ":hover": colors.muted },
    borderColor: colors.border,
    borderRadius: radius.full,
    borderStyle: "solid",
    borderWidth: "1px",
    color: colors.foreground,
    cursor: "pointer",
    fontSize: "0.75rem",
    fontWeight: 500,
    height: "2rem",
    paddingInline: "0.875rem",
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    color: colors.primaryForeground,
  },
  channels: {
    display: "grid",
    gap: "0.5rem",
    gridTemplateColumns: { default: "1fr", "@media (min-width: 640px)": "1fr 1fr" },
  },
  channel: {
    backgroundColor: { default: "transparent", ":hover": colors.muted },
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: "1px",
    color: colors.foreground,
    cursor: "pointer",
    display: "grid",
    gap: "0.25rem",
    paddingBlock: "0.625rem",
    paddingInline: "0.75rem",
    textAlign: "start",
  },
  channelOn: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 12%, transparent)`,
    borderColor: colors.primary,
    boxShadow: `0 0 0 1px ${colors.primary}`,
  },
  channelRow: { alignItems: "center", display: "flex", gap: "0.625rem" },
  channelName: {
    flexGrow: 1,
    fontSize: "0.8125rem",
    fontWeight: 500,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tick: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.full,
    borderStyle: "solid",
    borderWidth: "2px",
    color: "transparent",
    display: "flex",
    flexShrink: 0,
    height: "1.25rem",
    justifyContent: "center",
    width: "1.25rem",
  },
  tickOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    color: colors.primaryForeground,
  },
  note: { alignItems: "flex-start", display: "flex", fontSize: "0.6875rem", gap: "0.25rem" },
  problem: { color: colors.destructive },
  warning: { color: colors.editorial },
  noteIcon: { flexShrink: 0, marginTop: "0.125rem" },
  quiet: {
    alignItems: "center",
    color: colors.mutedForeground,
    display: "flex",
    fontSize: "0.75rem",
    gap: "0.5rem",
    margin: 0,
    paddingBlock: "0.75rem",
  },
  callout: {
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    color: colors.mutedForeground,
    fontSize: "0.75rem",
    margin: 0,
    padding: "0.75rem",
  },
  details: { color: colors.mutedForeground, fontSize: "0.75rem" },
  summary: { cursor: "pointer", paddingBlock: "0.25rem", userSelect: "none" },
  unfitList: {
    display: "grid",
    gap: "0.375rem",
    listStyle: "none",
    margin: "0.25rem 0 0",
    padding: 0,
  },
  unfit: { alignItems: "flex-start", display: "flex", gap: "0.5rem", opacity: 0.75 },
  strong: { color: colors.foreground, fontWeight: 500 },
  dot: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    height: "0.375rem",
    width: "0.375rem",
  },
  tab: { alignItems: "center", display: "inline-flex", gap: "0.375rem" },
  when: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" },
  date: { width: "auto" },
  hint: { color: colors.mutedForeground, fontSize: "0.6875rem", margin: 0 },
  clear: {
    alignItems: "center",
    backgroundColor: `color-mix(in oklab, ${colors.muted} 60%, transparent)`,
    borderRadius: radius.xl,
    cursor: "pointer",
    display: "flex",
    gap: "0.75rem",
    justifyContent: "space-between",
    paddingBlock: "0.625rem",
    paddingInline: "0.75rem",
  },
  clearText: { display: "grid", gap: "0.125rem" },
  clearLabel: { fontSize: "0.8125rem", fontWeight: 500 },
  footer: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopStyle: "solid",
    borderTopWidth: "1px",
    display: "flex",
    flexShrink: 0,
    gap: "0.5rem",
    paddingBlock: "1rem",
    paddingInline: "1.5rem",
  },
  status: { fontSize: "0.75rem", margin: 0, marginInlineEnd: "auto" },
  push: { marginInlineStart: "auto" },
  done: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    textAlign: "center",
  },
  doneIcon: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    color: colors.primaryForeground,
    display: "flex",
    height: "3rem",
    justifyContent: "center",
    width: "3rem",
  },
  leftList: {
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    display: "grid",
    fontSize: "0.75rem",
    gap: "0.375rem",
    listStyle: "none",
    margin: 0,
    padding: "0.75rem",
    textAlign: "start",
    width: "100%",
  },
  actions: { display: "flex", gap: "0.5rem" },
});

/**
 * A problem said without the platform's name, which the list already shows:
 * "YouTube takes one file per post" → "takes one file per post".
 */
function reason(problem: string, platform: string) {
  return problem.replace(new RegExp(`(^|: )${platform} `, "g"), "$1");
}

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h3 {...stylex.props(styles.heading)}>{children}</h3>
);

/**
 * Publishing a selection. It knows what the files are, so it shows at once where they fit
 * and as what — a Short, a Reel, a carousel — and leaves the rest dimmed with the reason.
 * The words come from the group's draft when an agent wrote one; each platform can be
 * adjusted on its own tab with real fields.
 */
export function PublishModal({
  files,
  groupId,
  draft,
  accounts,
  brands,
  platforms,
  retentionDays,
  onClose,
  onPublished,
}: {
  files: FileView[];
  groupId?: string;
  draft: PublishDraft;
  accounts: Account[];
  brands: Brand[];
  platforms: Platform[];
  retentionDays: number;
  onClose: () => void;
  onPublished: () => void;
}) {
  // What the dialog opened with; it does not follow later changes to the draft.
  const [start] = useState(() => {
    const { platforms: drafted, ...shared } = draft.metadata ?? {};
    const overrides = isObject(drafted)
      ? Object.fromEntries(
          Object.entries(drafted).filter((entry): entry is [string, Values] => isObject(entry[1])),
        )
      : {};
    return { shared, overrides, fileIds: files.map((file) => file.id) };
  });
  const { fileIds } = start;
  const [caption, setCaption] = useState(draft.caption ?? "");
  const [title, setTitle] = useState(draft.title ?? "");
  const [description, setDescription] = useState(draft.description ?? "");
  const [overrides, setOverrides] = useState<Record<string, Values>>(start.overrides);
  const [chosen, setChosen] = useState<string[]>([]);
  const [tab, setTab] = useState<string | null>(null);
  const [when, setWhen] = useState<"now" | "later">("later");
  const [at, setAt] = useState(tomorrow);
  const [keepFiles, setKeepFiles] = useState(false);
  const [plan, setPlan] = useState<PlanRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const planned = useRef("");

  const singleVideo = files.length === 1 && files[0].kind === "video";
  const metadata = useMemo(
    () => ({ ...start.shared, platforms: overrides }),
    [start.shared, overrides],
  );

  // Every channel is planned, so the fit is known before anything is chosen; the plan follows
  // the words, since a platform can need one (a YouTube title). The first plan goes at once,
  // later ones once typing pauses, and one the last already answered is not sent again.
  const first = plan === null;
  useEffect(() => {
    if (!accounts.length) return;
    const data = {
      fileIds,
      groupId,
      draft: { title, caption, description, metadata },
      brandIds: [],
      accountIds: accounts.map((account) => account.id),
    };
    const key = JSON.stringify(data);
    if (key === planned.current) return;
    let live = true;
    const wait = setTimeout(
      async () => {
        try {
          const result = await planSelection({ data });
          if (!live) return;
          planned.current = key;
          setPlan(result.channels);
        } catch (err) {
          if (live) setError(err instanceof Error ? err.message : "Could not check the channels");
        }
      },
      first ? 0 : 400,
    );
    return () => {
      live = false;
      clearTimeout(wait);
    };
  }, [accounts, fileIds, groupId, title, caption, description, metadata, first]);

  const rows = useMemo(() => new Map(plan?.map((row) => [row.accountId, row])), [plan]);
  const fits = (id: string) => Boolean(rows.get(id)?.fits);
  const fitting = accounts.filter((account) => fits(account.id));
  const unfit = plan ? accounts.filter((account) => !fits(account.id)) : [];
  // What cannot take the files, told once per platform rather than once per channel.
  const unfitPlatforms = [...new Set(unfit.map((account) => account.provider))].map((provider) => {
    const channels = unfit.filter((account) => account.provider === provider);
    const name = rows.get(channels[0].id)?.platform ?? provider;
    const reasons = [
      ...new Set(channels.flatMap((account) => rows.get(account.id)?.problems ?? [])),
    ].map((problem) => reason(problem, name));
    return { provider, name, channels: channels.length, reasons };
  });
  const chosenSet = new Set(chosen);

  const toggle = (id: string) =>
    setChosen((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    );
  const fittingOf = (brand: Brand) => brand.accountIds.filter(fits);
  const brandOn = (brand: Brand) =>
    fittingOf(brand).length > 0 && fittingOf(brand).every((id) => chosenSet.has(id));
  const toggleBrand = (brand: Brand) => {
    const ids = fittingOf(brand);
    setChosen((current) =>
      brandOn(brand)
        ? current.filter((id) => !ids.includes(id))
        : [...new Set([...current, ...ids])],
    );
  };

  const chosenRows = chosen.flatMap((id) => rows.get(id) ?? []);
  const ready = chosenRows.filter((row) => row.ready);
  const chosenPlatforms = platforms.filter((platform) =>
    chosenRows.some((row) => row.provider === platform.id),
  );
  // Words the chosen platforms take (or, before any is chosen, the ones that fit).
  const relevant = chosenPlatforms.length
    ? chosenPlatforms
    : platforms.filter((platform) => fitting.some((account) => account.provider === platform.id));
  const showTitle = relevant.some((platform) => platform.takesTitle);
  const showDescription = relevant.some((platform) => platform.takesDescription);
  const activeTab = chosenPlatforms.find((platform) => platform.id === tab) ?? chosenPlatforms[0];

  const time = new Date(at);
  const past =
    when === "later" && (!at || Number.isNaN(time.getTime()) || time.getTime() < Date.now());

  const setOverride = (provider: string, key: string, value: JsonValue | undefined) =>
    setOverrides((current) => {
      const next = { ...current[provider] };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return { ...current, [provider]: next };
    });

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(
        await publishSelection({
          data: {
            fileIds,
            groupId,
            draft: { title, caption, description, metadata },
            brandIds: [],
            accountIds: ready.map((row) => row.accountId),
            scheduledAt: when === "later" ? time.toISOString() : undefined,
            keepFiles,
          },
        }),
      );
      onPublished();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const left = [
      ...result.skipped.map((row) => ({ ...row, reason: row.problems.join("; ") })),
      ...result.failed.map((row) => ({ ...row, reason: row.error })),
    ];
    return (
      <Modal open onOpenChange={(open) => !open && onClose()}>
        <div {...stylex.props(styles.done)}>
          <span {...stylex.props(styles.doneIcon)}>
            <CheckCircle size={26} weight="fill" />
          </span>
          <ModalHeader>
            <ModalTitle>
              {when === "now" ? "On its way to" : "Scheduled on"} {result.scheduled.length} channel
              {result.scheduled.length === 1 ? "" : "s"}
            </ModalTitle>
            <ModalDescription>
              {keepFiles
                ? "The files stay in your library."
                : "The files leave your library once every post is out."}{" "}
              Until then each post can be changed or cancelled in Publish.
            </ModalDescription>
          </ModalHeader>
          {left.length > 0 && (
            <ul {...stylex.props(styles.leftList)}>
              {left.map((row) => (
                <li key={row.accountId}>
                  <span {...stylex.props(styles.strong)}>{row.name}</span> not posted: {row.reason}
                </li>
              ))}
            </ul>
          )}
          <div {...stylex.props(styles.actions)}>
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
            <Button render={<Link to="/publish" onClick={onClose} />}>View in Publish</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} style={styles.modal}>
      <div {...stylex.props(styles.frame)}>
        <div {...stylex.props(styles.body)}>
          <div {...stylex.props(styles.keep)}>
            <ModalHeader>
              <ModalTitle>Publish</ModalTitle>
              <ModalDescription>{selectionSummary(files)}</ModalDescription>
            </ModalHeader>
          </div>

          <div {...stylex.props(styles.strip, styles.keep)}>
            {files.map((file) => (
              <FileThumb key={file.id} file={file} size="md" />
            ))}
          </div>

          {/* ── where ─────────────────────────────────────────────────────────── */}
          <section {...stylex.props(styles.section)}>
            <div {...stylex.props(styles.headRow)}>
              <Heading>Post to</Heading>
              {fitting.length > 1 && (
                <button
                  type="button"
                  {...stylex.props(styles.link)}
                  onClick={() =>
                    setChosen(
                      chosen.length === fitting.length ? [] : fitting.map((account) => account.id),
                    )
                  }
                >
                  {chosen.length === fitting.length ? "Clear" : `All ${fitting.length} that fit`}
                </button>
              )}
            </div>

            {brands.some((brand) => fittingOf(brand).length) && (
              <div {...stylex.props(styles.chips)}>
                {brands
                  .filter((brand) => fittingOf(brand).length)
                  .map((brand) => (
                    <button
                      key={brand.id}
                      type="button"
                      aria-pressed={brandOn(brand)}
                      onClick={() => toggleBrand(brand)}
                      {...stylex.props(styles.chip, brandOn(brand) && styles.chipOn)}
                    >
                      {brand.name}
                    </button>
                  ))}
              </div>
            )}

            {!plan ? (
              <p {...stylex.props(styles.quiet)}>
                <SpinnerGap {...stylex.props(styles.spin)} /> Checking where this fits…
              </p>
            ) : fitting.length ? (
              <div {...stylex.props(styles.channels)}>
                {fitting.map((account) => {
                  const row = rows.get(account.id)!;
                  const on = chosenSet.has(account.id);
                  return (
                    <button
                      key={account.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(account.id)}
                      {...stylex.props(styles.channel, on && styles.channelOn)}
                    >
                      <span {...stylex.props(styles.channelRow)}>
                        <ChannelAvatar
                          provider={account.provider}
                          avatar={account.avatar}
                          name={account.name}
                          size="sm"
                        />
                        <span {...stylex.props(styles.channelName)}>{account.name}</span>
                        <Badge variant="secondary">{row.label}</Badge>
                        <span {...stylex.props(styles.tick, on && styles.tickOn)}>
                          <Check size={11} weight="bold" />
                        </span>
                      </span>
                      {on &&
                        row.problems.map((problem) => (
                          <span key={problem} {...stylex.props(styles.note, styles.problem)}>
                            <WarningCircle weight="fill" {...stylex.props(styles.noteIcon)} />
                            {problem}
                          </span>
                        ))}
                      {on &&
                        row.warnings.map((warning) => (
                          <span key={warning} {...stylex.props(styles.note, styles.warning)}>
                            <Warning {...stylex.props(styles.noteIcon)} />
                            {warning}
                          </span>
                        ))}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p {...stylex.props(styles.callout)}>
                {accounts.length
                  ? "None of your channels takes this as it is."
                  : "No channel yet — connect one first."}{" "}
                <Link to="/channels">Channels</Link>
              </p>
            )}

            {unfitPlatforms.length > 0 && (
              <details {...stylex.props(styles.details)}>
                <summary {...stylex.props(styles.summary)}>
                  Not for {unfitPlatforms.map((platform) => platform.name).join(", ")}
                </summary>
                <ul {...stylex.props(styles.unfitList)}>
                  {unfitPlatforms.map((platform) => (
                    <li key={platform.provider} {...stylex.props(styles.unfit)}>
                      <PlatformLogo provider={platform.provider} size="xs" />
                      <span>
                        <span {...stylex.props(styles.strong)}>{platform.name}</span>
                        {platform.channels > 1 && ` (${platform.channels} channels)`} —{" "}
                        {platform.reasons.join("; ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          {/* ── words ─────────────────────────────────────────────────────────── */}
          <section {...stylex.props(styles.section)}>
            <Heading>Words</Heading>
            {showTitle && (
              <Field label="Title">
                <Input
                  value={title}
                  placeholder="For YouTube, Facebook videos and Pins"
                  onChange={(event) => setTitle(event.target.value)}
                />
              </Field>
            )}
            <Field label="Caption">
              <Textarea
                rows={3}
                value={caption}
                placeholder="What the post says — every platform starts from this"
                onChange={(event) => setCaption(event.target.value)}
              />
            </Field>
            {showDescription && (
              <Field label="Description">
                <Textarea
                  rows={3}
                  value={description}
                  placeholder="The longer text, where the platform has one"
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>
            )}
          </section>

          {/* ── per platform ──────────────────────────────────────────────────── */}
          {activeTab && (
            <section {...stylex.props(styles.section)}>
              <Heading>Per platform</Heading>
              <Segmented
                role="tablist"
                label="Platform"
                value={activeTab.id}
                onChange={setTab}
                options={chosenPlatforms.map((platform) => ({
                  value: platform.id,
                  label: (
                    <span {...stylex.props(styles.tab)}>
                      <PlatformLogo provider={platform.id} size="xs" />
                      {platform.name}
                      {Object.keys(overrides[platform.id] ?? {}).length > 0 && (
                        <span aria-label="edited" {...stylex.props(styles.dot)} />
                      )}
                    </span>
                  ),
                }))}
              />
              <PlatformForm
                key={activeTab.id}
                fields={activeTab.fields.filter((field) => singleVideo || !field.videoOnly)}
                values={overrides[activeTab.id] ?? {}}
                caption={caption}
                onChange={(key, value) => setOverride(activeTab.id, key, value)}
              />
            </section>
          )}

          {/* ── when ──────────────────────────────────────────────────────────── */}
          <section {...stylex.props(styles.section)}>
            <Heading>When</Heading>
            <div {...stylex.props(styles.when)}>
              <Segmented
                label="When"
                value={when}
                onChange={setWhen}
                options={[
                  { value: "now", label: "Now" },
                  { value: "later", label: "Schedule" },
                ]}
              />
              {when === "later" && (
                <Input
                  type="datetime-local"
                  value={at}
                  onChange={(event) => setAt(event.target.value)}
                  style={styles.date}
                />
              )}
            </div>
            <p {...stylex.props(styles.hint)}>
              {when === "now"
                ? "Goes out right away and is live as soon as each platform has processed it."
                : `${Intl.DateTimeFormat().resolvedOptions().timeZone} — each platform gets it early enough to be ready on time.`}
            </p>
            <label {...stylex.props(styles.clear)}>
              <span {...stylex.props(styles.clearText)}>
                <span {...stylex.props(styles.clearLabel)}>Clear the files once they're out</span>
                <span {...stylex.props(styles.hint)}>
                  Keeps your library tidy. Anything left goes after {retentionDays} days anyway.
                </span>
              </span>
              <Switch checked={!keepFiles} onCheckedChange={(checked) => setKeepFiles(!checked)} />
            </label>
          </section>
        </div>

        <div {...stylex.props(styles.footer)}>
          {error ? (
            <p {...stylex.props(styles.status, styles.problem)}>{error}</p>
          ) : (
            chosenRows.length > ready.length && (
              <p {...stylex.props(styles.status, styles.hint)}>
                {chosenRows.length - ready.length} need
                {chosenRows.length - ready.length === 1 ? "s" : ""} something first
              </p>
            )
          )}
          <Button variant="outline" onClick={onClose} style={styles.push}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !ready.length || past}>
            {busy && <SpinnerGap {...stylex.props(styles.spin)} />}
            {ready.length
              ? `${when === "now" ? "Publish" : "Schedule"} on ${ready.length} channel${ready.length === 1 ? "" : "s"}`
              : "Choose channels"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
