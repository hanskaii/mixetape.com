import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, CheckCircle, SpinnerGap, Warning, WarningCircle } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { ChannelAvatar } from "#/components/ui/channel-avatar";
import { Input } from "#/components/ui/input";
import { Modal, ModalDescription, ModalHeader, ModalTitle } from "#/components/ui/modal";
import { PlatformLogo } from "#/components/ui/platform-logo";
import { Textarea } from "#/components/ui/textarea";
import type { JsonValue } from "#/database/schema";
import { planSelection, publishSelection } from "#/modules/library/library.fn";
import type { PlanRow } from "#/modules/library/publish.service";
import type { Field } from "#/modules/social/fields";
import type { FileView } from "#/modules/storage/files.service";
import { FileThumb } from "./file-thumb";
import { PlatformForm } from "./platform-form";
import { selectionSummary } from "../-lib/format";

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
  fields: Field[];
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

const section = "grid gap-2.5";
const heading = "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";

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
  const { platforms: draftPlatforms, ...draftShared } = draft.metadata ?? {};
  const [caption, setCaption] = useState(draft.caption ?? "");
  const [title, setTitle] = useState(draft.title ?? "");
  const [description, setDescription] = useState(draft.description ?? "");
  const [overrides, setOverrides] = useState<Record<string, Values>>(() =>
    isObject(draftPlatforms)
      ? Object.fromEntries(
          Object.entries(draftPlatforms).filter((entry): entry is [string, Values] =>
            isObject(entry[1]),
          ),
        )
      : {},
  );
  const [chosen, setChosen] = useState<string[]>([]);
  const [tab, setTab] = useState<string | null>(null);
  const [when, setWhen] = useState<"now" | "later">("later");
  const [at, setAt] = useState(tomorrow);
  const [keepFiles, setKeepFiles] = useState(false);
  const [plan, setPlan] = useState<PlanRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const fileIds = files.map((file) => file.id);
  const singleVideo = files.length === 1 && files[0].kind === "video";
  const metadata = useMemo(
    () => ({ ...draftShared, platforms: overrides }),
    // draftShared is derived from the draft, which does not change while the dialog is open.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [overrides],
  );

  // Every channel is planned, so the fit is known before anything is chosen; the plan follows
  // the words, since a platform can need one (a YouTube title).
  useEffect(() => {
    if (!accounts.length) return;
    let live = true;
    const wait = setTimeout(async () => {
      try {
        const planned = await planSelection({
          data: {
            fileIds,
            groupId,
            draft: { title, caption, description, metadata },
            brandIds: [],
            accountIds: accounts.map((account) => account.id),
          },
        });
        if (live) setPlan(planned.channels);
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Could not check the channels");
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(wait);
    };
    // fileIds are fixed for the dialog's life.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, groupId, title, caption, description, metadata]);

  const rowOf = (id: string) => plan?.find((row) => row.accountId === id);
  const fits = (id: string) => Boolean(rowOf(id)?.fits);
  const fitting = accounts.filter((account) => fits(account.id));
  const unfit = plan ? accounts.filter((account) => !fits(account.id)) : [];

  const toggle = (id: string) =>
    setChosen((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    );
  const brandOn = (brand: Brand) =>
    brand.accountIds.filter(fits).length > 0 &&
    brand.accountIds.filter(fits).every((id) => chosen.includes(id));
  const toggleBrand = (brand: Brand) => {
    const ids = brand.accountIds.filter(fits);
    setChosen((current) =>
      brandOn(brand)
        ? current.filter((id) => !ids.includes(id))
        : [...new Set([...current, ...ids])],
    );
  };

  const chosenRows = chosen.map(rowOf).filter((row): row is PlanRow => Boolean(row));
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
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
            <CheckCircle size={26} weight="fill" />
          </span>
          <ModalHeader className="items-center text-center">
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
            <ul className="grid w-full gap-1.5 rounded-xl bg-muted p-3 text-left text-xs">
              {left.map((row) => (
                <li key={row.accountId}>
                  <span className="font-medium">{row.name}</span>{" "}
                  <span className="text-muted-foreground">not posted: {row.reason}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
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
    <Modal open onOpenChange={(open) => !open && onClose()} className="max-w-2xl !p-0">
      <div className="flex max-h-[88vh] flex-col">
        <div className="flex flex-col gap-5 overflow-y-auto p-6 [&>*]:shrink-0">
          <ModalHeader>
            <ModalTitle>Publish</ModalTitle>
            <ModalDescription>{selectionSummary(files)}</ModalDescription>
          </ModalHeader>

          <div className="-mt-1 flex gap-2 overflow-x-auto pb-1">
            {files.map((file) => (
              <FileThumb key={file.id} file={file} size="md" />
            ))}
          </div>

          {/* ── where ───────────────────────────────────────────────────────── */}
          <section className={section}>
            <div className="flex items-center justify-between gap-2">
              <h3 className={heading}>Post to</h3>
              {fitting.length > 1 && (
                <button
                  type="button"
                  className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
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

            {brands.some((brand) => brand.accountIds.some(fits)) && (
              <div className="flex flex-wrap gap-1.5">
                {brands
                  .filter((brand) => brand.accountIds.some(fits))
                  .map((brand) => (
                    <button
                      key={brand.id}
                      type="button"
                      aria-pressed={brandOn(brand)}
                      onClick={() => toggleBrand(brand)}
                      className={`h-8 rounded-full px-3.5 text-xs font-medium ring-1 transition-colors ${brandOn(brand) ? "bg-primary text-primary-foreground ring-primary" : "ring-border hover:bg-muted"}`}
                    >
                      {brand.name}
                    </button>
                  ))}
              </div>
            )}

            {!plan ? (
              <p className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                <SpinnerGap className="animate-spin" /> Checking where this fits…
              </p>
            ) : fitting.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {fitting.map((account) => {
                  const row = rowOf(account.id)!;
                  const on = chosen.includes(account.id);
                  return (
                    <button
                      key={account.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(account.id)}
                      className={`flex flex-col gap-1 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors ${on ? "bg-primary/10 ring-2 ring-primary" : "ring-border hover:bg-muted/60"}`}
                    >
                      <span className="flex items-center gap-2.5">
                        <ChannelAvatar
                          provider={account.provider}
                          avatar={account.avatar}
                          name={account.name}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                          {account.name}
                        </span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                          {row.label}
                        </span>
                        <span
                          className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent"}`}
                        >
                          <Check size={11} weight="bold" />
                        </span>
                      </span>
                      {on &&
                        row.problems.map((problem) => (
                          <span
                            key={problem}
                            className="flex items-start gap-1 text-[11px] text-destructive"
                          >
                            <WarningCircle className="mt-0.5 shrink-0" weight="fill" /> {problem}
                          </span>
                        ))}
                      {on &&
                        row.warnings.map((warning) => (
                          <span
                            key={warning}
                            className="flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-400"
                          >
                            <Warning className="mt-0.5 shrink-0" /> {warning}
                          </span>
                        ))}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl bg-muted px-3 py-3 text-xs text-muted-foreground">
                {accounts.length
                  ? "None of your channels takes this as it is."
                  : "No channel yet — connect one first."}{" "}
                <Link
                  to="/channels"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Channels
                </Link>
              </p>
            )}

            {unfit.length > 0 && (
              <details className="group text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none py-1 hover:text-foreground">
                  {unfit.length} channel{unfit.length === 1 ? "" : "s"} can't take this
                </summary>
                <ul className="mt-1 grid gap-1.5">
                  {unfit.map((account) => (
                    <li key={account.id} className="flex items-start gap-2 opacity-70">
                      <PlatformLogo provider={account.provider} size="xs" />
                      <span>
                        <span className="font-medium text-foreground">{account.name}</span> —{" "}
                        {rowOf(account.id)?.problems[0]}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          {/* ── words ───────────────────────────────────────────────────────── */}
          <section className={section}>
            <h3 className={heading}>Words</h3>
            {showTitle && (
              <label className="grid gap-1.5 text-[13px] font-medium">
                Title
                <Input
                  value={title}
                  placeholder="For YouTube, Facebook videos and Pins"
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
            )}
            <label className="grid gap-1.5 text-[13px] font-medium">
              Caption
              <Textarea
                rows={3}
                value={caption}
                placeholder="What the post says — every platform starts from this"
                onChange={(event) => setCaption(event.target.value)}
              />
            </label>
            {showDescription && (
              <label className="grid gap-1.5 text-[13px] font-medium">
                Description
                <Textarea
                  rows={3}
                  value={description}
                  placeholder="The longer text, where the platform has one"
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
            )}
          </section>

          {/* ── per platform ────────────────────────────────────────────────── */}
          {activeTab && (
            <section className={section}>
              <h3 className={heading}>Per platform</h3>
              <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
                {chosenPlatforms.map((platform) => {
                  const edited = Object.keys(overrides[platform.id] ?? {}).length > 0;
                  return (
                    <button
                      key={platform.id}
                      type="button"
                      role="tab"
                      aria-selected={platform.id === activeTab.id}
                      onClick={() => setTab(platform.id)}
                      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors ${platform.id === activeTab.id ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <PlatformLogo provider={platform.id} size="xs" />
                      {platform.name}
                      {edited && (
                        <span className="size-1.5 rounded-full bg-primary" aria-label="edited" />
                      )}
                    </button>
                  );
                })}
              </div>
              <PlatformForm
                key={activeTab.id}
                fields={activeTab.fields.filter((field) => singleVideo || !field.videoOnly)}
                values={overrides[activeTab.id] ?? {}}
                caption={caption}
                onChange={(key, value) => setOverride(activeTab.id, key, value)}
              />
            </section>
          )}

          {/* ── when ────────────────────────────────────────────────────────── */}
          <section className={section}>
            <h3 className={heading}>When</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div role="radiogroup" className="flex rounded-xl bg-muted p-1">
                {(["now", "later"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={when === option}
                    onClick={() => setWhen(option)}
                    className={`h-8 rounded-lg px-4 text-xs font-medium transition-colors ${when === option ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {option === "now" ? "Now" : "Schedule"}
                  </button>
                ))}
              </div>
              {when === "later" && (
                <Input
                  type="datetime-local"
                  value={at}
                  onChange={(event) => setAt(event.target.value)}
                  className="w-auto"
                />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {when === "now"
                ? "Goes out right away and is live as soon as each platform has processed it."
                : `${Intl.DateTimeFormat().resolvedOptions().timeZone} — each platform gets it early enough to be ready on time.`}
            </p>
            <label className="flex items-start gap-2.5 rounded-xl bg-muted/60 px-3 py-2.5">
              <input
                type="checkbox"
                checked={!keepFiles}
                onChange={(event) => setKeepFiles(!event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="grid gap-0.5">
                <span className="text-[13px] font-medium">Clear the files once they're out</span>
                <span className="text-[11px] text-muted-foreground">
                  Keeps your library tidy. Anything left goes after {retentionDays} days anyway.
                </span>
              </span>
            </label>
          </section>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-6 py-4">
          {error ? (
            <p className="mr-auto text-xs text-destructive">{error}</p>
          ) : (
            chosenRows.length > ready.length && (
              <p className="mr-auto text-xs text-muted-foreground">
                {chosenRows.length - ready.length} need
                {chosenRows.length - ready.length === 1 ? "s" : ""} something first
              </p>
            )
          )}
          <Button variant="outline" onClick={onClose} className="ml-auto">
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !ready.length || past}>
            {busy && <SpinnerGap className="animate-spin" />}
            {ready.length
              ? `${when === "now" ? "Publish" : "Schedule"} on ${ready.length} channel${ready.length === 1 ? "" : "s"}`
              : "Choose channels"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
