import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, SpinnerGap, Warning, WarningCircle } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { ChannelAvatar } from "#/components/ui/channel-avatar";
import { Input } from "#/components/ui/input";
import { Modal, ModalDescription, ModalHeader, ModalTitle } from "#/components/ui/modal";
import type { ItemView } from "#/modules/library/library.service";
import { planContent, scheduleContent } from "#/modules/library/library.fn";
import type { PlanRow } from "#/modules/library/schedule.service";

type Account = {
  id: string;
  name: string;
  provider: string;
  avatar: string | null;
  status: string;
};
type Brand = { id: string; name: string; accountIds: string[] };
type Result = Awaited<ReturnType<typeof scheduleContent>>;

const FORMAT: Record<string, string> = { video: "Video", image: "Image", carousel: "Carousel" };

/** Tomorrow, on the hour, as a datetime-local value in the reader's time zone. */
function tomorrow() {
  const date = new Date(Date.now() + 24 * 3600_000);
  date.setMinutes(0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:00`;
}

/**
 * Sends a content item to brands and channels: pick where, see channel by channel whether
 * it fits and what would be posted, pick when, schedule.
 */
export function ScheduleModal({
  item,
  accounts,
  brands,
  onClose,
  onScheduled,
}: {
  item: ItemView;
  accounts: Account[];
  brands: Brand[];
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [brandIds, setBrandIds] = useState<string[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [when, setWhen] = useState(tomorrow);
  const [plan, setPlan] = useState<PlanRow[] | null>(null);
  const [planning, setPlanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const viaBrand = (id: string) =>
    brands.filter((brand) => brandIds.includes(brand.id) && brand.accountIds.includes(id));
  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((other) => other !== id) : [...list, id];

  // The matrix follows the choice of brands and channels.
  useEffect(() => {
    if (!brandIds.length && !accountIds.length) {
      setPlan(null);
      return;
    }
    let live = true;
    setPlanning(true);
    const wait = setTimeout(async () => {
      try {
        const planned = await planContent({ data: { id: item.id, brandIds, accountIds } });
        if (live) {
          setPlan(planned.channels);
          setError(null);
        }
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Could not check the channels");
      } finally {
        if (live) setPlanning(false);
      }
    }, 200);
    return () => {
      live = false;
      clearTimeout(wait);
    };
  }, [item.id, brandIds, accountIds]);

  const ready = plan?.filter((row) => row.ready) ?? [];
  const time = new Date(when);
  const past = !when || Number.isNaN(time.getTime()) || time.getTime() < Date.now();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(
        await scheduleContent({
          data: { id: item.id, brandIds, accountIds, scheduledAt: time.toISOString() },
        }),
      );
      onScheduled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not schedule the content");
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
        <div className="flex flex-col gap-4">
          <ModalHeader>
            <ModalTitle>
              Scheduled on {result.scheduled.length} channel
              {result.scheduled.length === 1 ? "" : "s"}
            </ModalTitle>
            <ModalDescription>
              Each is a post in Publish — editable and cancellable until it goes out.
            </ModalDescription>
          </ModalHeader>
          {left.length > 0 && (
            <ul className="grid gap-1.5 rounded-xl bg-muted p-3 text-xs">
              {left.map((row) => (
                <li key={row.accountId}>
                  <span className="font-medium">{row.name}</span>{" "}
                  <span className="text-muted-foreground">not scheduled: {row.reason}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2">
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
    <Modal open onOpenChange={(open) => !open && onClose()} className="max-w-xl">
      <form onSubmit={submit} className="flex max-h-[82vh] flex-col gap-4 overflow-y-auto">
        <ModalHeader>
          <ModalTitle>Schedule content</ModalTitle>
          <ModalDescription>
            {item.title || item.caption || "Untitled"} · {item.files.length} file
            {item.files.length === 1 ? "" : "s"}
          </ModalDescription>
        </ModalHeader>

        {brands.length > 0 && (
          <fieldset className="grid gap-1.5">
            <legend className="pb-1.5 text-[13px] font-medium">Brands</legend>
            <div className="flex flex-wrap gap-1.5">
              {brands.map((brand) => {
                const on = brandIds.includes(brand.id);
                return (
                  <button
                    key={brand.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setBrandIds(toggle(brandIds, brand.id))}
                    className={`h-7 rounded-full px-3 text-xs font-medium ring-1 transition-colors ${on ? "bg-primary text-primary-foreground ring-primary" : "ring-border hover:bg-muted"}`}
                  >
                    {brand.name}
                    <span className="ml-1.5 tabular-nums opacity-70">
                      {brand.accountIds.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <fieldset className="grid gap-1.5">
          <legend className="pb-1.5 text-[13px] font-medium">Channels</legend>
          <ul className="divide-y divide-border rounded-xl ring-1 ring-border">
            {accounts.map((account) => {
              const brandsOf = viaBrand(account.id);
              const row = plan?.find((candidate) => candidate.accountId === account.id);
              const included = brandsOf.length > 0 || accountIds.includes(account.id);
              return (
                <li key={account.id} className="px-3 py-2">
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={included}
                      disabled={brandsOf.length > 0}
                      onChange={() => setAccountIds(toggle(accountIds, account.id))}
                      className="size-4 shrink-0 accent-primary"
                    />
                    <ChannelAvatar
                      provider={account.provider}
                      avatar={account.avatar}
                      name={account.name}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px]">{account.name}</span>
                    {brandsOf.length > 0 && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        via {brandsOf.map((brand) => brand.name).join(", ")}
                      </span>
                    )}
                    {included && row && (
                      <span
                        className={`flex shrink-0 items-center gap-1 text-[11px] font-medium ${row.ready ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
                      >
                        {row.ready ? <Check weight="bold" /> : <WarningCircle weight="fill" />}
                        {row.ready ? (FORMAT[row.format ?? ""] ?? "Ready") : "Can't post"}
                      </span>
                    )}
                  </label>
                  {included && row && (row.problems.length > 0 || row.warnings.length > 0) && (
                    <ul className="mt-1 grid gap-0.5 pl-[3.25rem] text-[11px] leading-relaxed">
                      {row.problems.map((problem) => (
                        <li key={problem} className="text-destructive">
                          {problem}
                        </li>
                      ))}
                      {row.warnings.map((warning) => (
                        <li
                          key={warning}
                          className="flex items-start gap-1 text-amber-700 dark:text-amber-400"
                        >
                          <Warning className="mt-0.5 shrink-0" /> {warning}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
            {accounts.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                No channel yet. <Link to="/channels">Connect one</Link> first.
              </li>
            )}
          </ul>
        </fieldset>

        <label className="grid gap-1.5 text-[13px] font-medium">
          Goes live
          <Input
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
          />
          <span className="text-xs font-normal text-muted-foreground">
            {Intl.DateTimeFormat().resolvedOptions().timeZone} · each platform gets it early enough
            to finish processing.
          </span>
        </label>

        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center justify-end gap-2">
          {planning && <SpinnerGap className="mr-auto animate-spin text-muted-foreground" />}
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || planning || !ready.length || past}>
            {busy && <SpinnerGap className="animate-spin" />}
            {ready.length
              ? `Schedule on ${ready.length} channel${ready.length === 1 ? "" : "s"}`
              : "Schedule"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
