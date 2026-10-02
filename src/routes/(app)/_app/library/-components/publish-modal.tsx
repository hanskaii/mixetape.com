import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import * as stylex from "@stylexjs/stylex";
import { Check, CheckCircle, SpinnerGap, Warning, WarningCircle } from "@phosphor-icons/react";
import { AvatarStack } from "#/components/ui/avatar-stack";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { ChannelAvatar } from "#/components/ui/channel-avatar";
import { Field } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Modal, ModalDescription, ModalHeader, ModalTitle } from "#/components/ui/modal";
import { PlatformLogo } from "#/components/ui/platform-logo";
import { Segmented } from "#/components/ui/segmented";
import { Textarea } from "#/components/ui/textarea";
import type { JsonValue } from "#/database/schema";
import { planSelection, publishSelection } from "#/modules/library/library.fn";
import type { PlanRow } from "#/modules/library/publish.service";
import type { Field as FieldSpec } from "#/modules/social/fields";
import type { FileView } from "#/modules/storage/files.service";
import { colors, radius } from "../../../../../components/ui/tokens.stylex";
import { selectionSummary } from "../-lib/format";
import { PostPreview } from "./post-preview";
import { PublishButton } from "./publish-button";
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
  modal: { maxWidth: "64rem", padding: 0 },
  frame: { display: "flex", flexDirection: "column", maxHeight: "90vh" },
  // The form, and beside it on wide screens the post as it will look.
  main: {
    display: "grid",
    flexGrow: 1,
    gridTemplateColumns: { default: "1fr", "@media (min-width: 900px)": "minmax(0, 1fr) 22rem" },
    minHeight: 0,
    overflowY: { default: "auto", "@media (min-width: 900px)": "hidden" },
  },
  aside: {
    alignContent: "start",
    backgroundColor: `color-mix(in oklab, ${colors.muted} 45%, transparent)`,
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: {
      default: "1px 0 0 0",
      "@media (min-width: 900px)": "0 0 0 1px",
    },
    display: "grid",
    gap: "0.75rem",
    overflowY: { default: "visible", "@media (min-width: 900px)": "auto" },
    padding: "1.25rem",
  },
  asideHead: {
    alignItems: "center",
    display: "flex",
    gap: "0.5rem",
    justifyContent: "space-between",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
    overflowY: { default: "visible", "@media (min-width: 900px)": "auto" },
    padding: "1.5rem",
  },
  keep: { flexShrink: 0 },
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
    alignItems: "center",
    cursor: "pointer",
    display: "inline-flex",
    fontSize: "0.75rem",
    fontWeight: 500,
    gap: "0.5rem",
    height: "2.25rem",
    paddingInline: "0.3125rem 0.875rem",
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
  channelBlocked: {
    backgroundColor: `color-mix(in oklab, ${colors.destructive} 8%, transparent)`,
    borderColor: colors.destructive,
    boxShadow: `0 0 0 1px ${colors.destructive}`,
  },
  flag: { display: "inline-flex", flexShrink: 0 },
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
  problem: { color: colors.destructive },
  warning: { color: colors.editorial },
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
  hint: { color: colors.mutedForeground, fontSize: "0.6875rem", margin: 0 },
  footer: {
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    borderTopColor: colors.border,
    borderTopStyle: "solid",
    borderTopWidth: "1px",
    display: "flex",
    flexShrink: 0,
    gap: "0.5rem",
    paddingBlock: "1rem",
    paddingInline: "1.5rem",
  },
  // Its own line above the control on a phone; beside it on a wide screen.
  status: {
    flexBasis: { default: "100%", "@media (min-width: 640px)": "auto" },
    fontSize: "0.75rem",
    margin: 0,
    marginInlineEnd: { default: 0, "@media (min-width: 640px)": "auto" },
  },
  // A phone closes the dialog by its edge; the footer keeps to the one control.
  cancel: { display: { default: "none", "@media (min-width: 640px)": "inline-flex" } },
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
  onClose,
  onPublished,
  images,
}: {
  files: FileView[];
  groupId?: string;
  draft: PublishDraft;
  accounts: Account[];
  brands: Brand[];
  platforms: Platform[];
  onClose: () => void;
  onPublished: () => void;
  /** The library's images, for choosing a cover. */
  images: FileView[];
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
  const [plan, setPlan] = useState<PlanRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const planned = useRef("");

  const singleVideo = files.length === 1 && files[0].kind === "video";
  // A cover can come from the images being published, then from the rest of the library.
  const coverImages = [
    ...files.filter((file) => file.kind === "image"),
    ...images.filter((image) => !files.some((file) => file.id === image.id)),
  ];
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
  const accountsById = new Map(accounts.map((account) => [account.id, account]));

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
  const blockedRows = chosenRows.filter((row) => !row.ready);
  // A problem a field can fix is said at that field.
  const titleProblem = blockedRows
    .flatMap((row) => row.problems)
    .find((problem) => /\btitle\b/i.test(problem));
  const chosenPlatforms = platforms.filter((platform) =>
    chosenRows.some((row) => row.provider === platform.id),
  );
  // Words the chosen platforms take (or, before any is chosen, the ones that fit).
  const relevant = chosenPlatforms.length
    ? chosenPlatforms
    : platforms.filter((platform) => fitting.some((account) => account.provider === platform.id));
  // Where each of the words goes, so no field is a guess. Facebook takes a title only on a
  // Page video.
  const names = (list: Platform[]) => list.map((platform) => platform.name).join(", ");
  const titleTargets = relevant.filter(
    (platform) => platform.takesTitle && (platform.id !== "facebook" || singleVideo),
  );
  const descriptionTargets = relevant.filter((platform) => platform.takesDescription);
  const captionTargets = relevant.filter((platform) =>
    platform.fields.some((field) => field.caption),
  );
  const showTitle = titleTargets.length > 0;
  const showDescription = descriptionTargets.length > 0;
  const captionHint = [
    captionTargets.length && `The post's text on ${names(captionTargets)}`,
    !description.trim() &&
      descriptionTargets.length &&
      `the description on ${names(descriptionTargets)} while Description is empty`,
  ]
    .filter(Boolean)
    .join(" — and ")
    .replace(/^./, (first) => first.toUpperCase());
  const titleHint = `On ${names(titleTargets)}${
    titleTargets.some((platform) => platform.id === "youtube") ? " · YouTube needs one" : ""
  }`;
  const descriptionHint = `On ${names(descriptionTargets)} · empty uses the caption`;
  const activeTab = chosenPlatforms.find((platform) => platform.id === tab) ?? chosenPlatforms[0];

  // The preview follows the tab: the chosen platforms, or before any is chosen, those that fit.
  const previewPlatforms = chosenPlatforms.length ? chosenPlatforms : relevant;
  const preview = previewPlatforms.find((platform) => platform.id === tab) ?? previewPlatforms[0];
  const previewAccount = preview
    ? (chosenRows.find((row) => row.provider === preview.id) ??
      fitting.map((account) => rows.get(account.id)).find((row) => row?.provider === preview.id))
    : undefined;
  const previewChannel = previewAccount
    ? (accountsById.get(previewAccount.accountId) ?? null)
    : null;
  const previewLabel = previewAccount?.label ?? "";
  const previewText = (() => {
    const own = (preview && overrides[preview.id]) ?? {};
    const text = (key: string | undefined) =>
      key && typeof own[key] === "string" && own[key] ? (own[key] as string) : undefined;
    const captionKey = preview?.fields.find((field) => field.caption)?.key;
    return {
      caption: text(captionKey) ?? caption,
      title: text("title") ?? title,
    };
  })();

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
              The files leave your library once every post is out. Until then each post can be
              changed or cancelled in Publish.
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
        <div {...stylex.props(styles.main)}>
          <div {...stylex.props(styles.body)}>
            <div {...stylex.props(styles.keep)}>
              <ModalHeader>
                <ModalTitle>Publish</ModalTitle>
                <ModalDescription>{selectionSummary(files)}</ModalDescription>
              </ModalHeader>
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
                        chosen.length === fitting.length
                          ? []
                          : fitting.map((account) => account.id),
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
                        <AvatarStack
                          focusable={false}
                          channels={fittingOf(brand).flatMap((id) => accountsById.get(id) ?? [])}
                        />
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
                    const blocked = on && !row.ready;
                    // The card stays one line: what stops it is said by the field that fixes
                    // it and in the footer; the icon's tooltip says it too.
                    return (
                      <button
                        key={account.id}
                        type="button"
                        aria-pressed={on}
                        title={blocked ? row.problems.join("\n") : undefined}
                        onClick={() => toggle(account.id)}
                        {...stylex.props(
                          styles.channel,
                          on && styles.channelOn,
                          blocked && styles.channelBlocked,
                        )}
                      >
                        <span {...stylex.props(styles.channelRow)}>
                          <ChannelAvatar
                            provider={account.provider}
                            avatar={account.avatar}
                            name={account.name}
                            size="sm"
                          />
                          <span {...stylex.props(styles.channelName)}>{account.name}</span>
                          {row.warnings.length > 0 && (
                            <span
                              title={row.warnings.join("\n")}
                              aria-label={row.warnings.join(". ")}
                              {...stylex.props(styles.warning, styles.flag)}
                            >
                              <Warning size={14} />
                            </span>
                          )}
                          <Badge variant="secondary">{row.label}</Badge>
                          {blocked ? (
                            <WarningCircle
                              size={20}
                              weight="fill"
                              aria-label={row.problems.join(". ")}
                              {...stylex.props(styles.problem, styles.flag)}
                            />
                          ) : (
                            <span {...stylex.props(styles.tick, on && styles.tickOn)}>
                              <Check size={11} weight="bold" />
                            </span>
                          )}
                        </span>
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
                <Field
                  label="Title"
                  hint={
                    titleProblem ? (
                      <span {...stylex.props(styles.problem)}>{titleProblem}</span>
                    ) : (
                      titleHint
                    )
                  }
                >
                  <Input
                    value={title}
                    aria-invalid={Boolean(titleProblem)}
                    placeholder="The headline"
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </Field>
              )}
              <Field label="Caption" hint={captionHint || undefined}>
                <Textarea
                  rows={3}
                  value={caption}
                  placeholder="What the post says"
                  onChange={(event) => setCaption(event.target.value)}
                />
              </Field>
              {showDescription && (
                <Field label="Description" hint={descriptionHint}>
                  <Textarea
                    rows={3}
                    value={description}
                    placeholder="The longer text"
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
                  images={coverImages}
                  key={activeTab.id}
                  fields={activeTab.fields.filter((field) => singleVideo || !field.videoOnly)}
                  values={overrides[activeTab.id] ?? {}}
                  caption={caption}
                  onChange={(key, value) => setOverride(activeTab.id, key, value)}
                />
              </section>
            )}
          </div>

          {/* ── preview ─────────────────────────────────────────────────────────── */}
          <aside aria-label="Preview" {...stylex.props(styles.aside)}>
            {preview ? (
              <>
                <div {...stylex.props(styles.asideHead)}>
                  <Heading>Preview</Heading>
                  {previewPlatforms.length > 1 && (
                    <Segmented
                      role="tablist"
                      label="Preview on"
                      value={preview.id}
                      onChange={setTab}
                      options={previewPlatforms.map((platform) => ({
                        value: platform.id,
                        label: <PlatformLogo provider={platform.id} size="xs" />,
                      }))}
                    />
                  )}
                </div>
                <PostPreview
                  key={preview.id}
                  provider={preview.id}
                  label={previewLabel}
                  channel={previewChannel}
                  files={files}
                  caption={previewText.caption}
                  title={previewText.title}
                />
              </>
            ) : (
              <p {...stylex.props(styles.hint)}>
                The preview shows here once a channel can take these files.
              </p>
            )}
          </aside>
        </div>

        <div {...stylex.props(styles.footer)}>
          {error ? (
            <p {...stylex.props(styles.status, styles.problem)}>{error}</p>
          ) : blockedRows.length ? (
            <p {...stylex.props(styles.status, styles.problem)}>
              {blockedRows[0].name} — {blockedRows[0].problems[0]}
              {blockedRows.length > 1 && ` · ${blockedRows.length - 1} more`}
            </p>
          ) : !ready.length ? (
            <p {...stylex.props(styles.status, styles.hint)}>Choose where it goes</p>
          ) : null}
          <Button variant="outline" onClick={onClose} style={styles.cancel}>
            Cancel
          </Button>
          <PublishButton
            when={when}
            at={at}
            onWhen={setWhen}
            onAt={setAt}
            count={ready.length}
            disabled={busy || !ready.length || past}
            busy={busy}
            onSubmit={submit}
          />
        </div>
      </div>
    </Modal>
  );
}
