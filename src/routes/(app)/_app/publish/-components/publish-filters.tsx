import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CaretLeft } from "@phosphor-icons/react/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/CaretRight";
import { Check } from "@phosphor-icons/react/Check";
import { Funnel } from "@phosphor-icons/react/Funnel";
import { Globe } from "@phosphor-icons/react/Globe";
import { SquaresFour } from "@phosphor-icons/react/SquaresFour";
import { Stack } from "@phosphor-icons/react/Stack";
import { BottomSheet } from "#/components/ui/bottom-sheet";
import { Button } from "#/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { ChannelAvatar } from "#/components/ui/channel-avatar";
import { COMMON_ZONES, DEFAULT_ZONE, zoneLabel, type Account } from "../-lib/posts";

/**
 * The time zone the page is read in: rendered on the server in DEFAULT_ZONE, then the
 * viewer's own once mounted (so the markup never mismatches).
 */
export function useViewerZone() {
  const [timeZone, setTimeZone] = useState(DEFAULT_ZONE);
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone) setTimeZone(zone);
  }, []);
  return [timeZone, setTimeZone] as const;
}

/** Channels to show; null means all of them, including any connected later. */
export function useChannelSelection(accounts: Account[]) {
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const selected = useMemo(
    () => selectedIds ?? accounts.map((account) => account.id),
    [accounts, selectedIds],
  );
  return { selected, setSelected: setSelectedIds };
}

/** The zones, searchable. */
function ZoneList({
  timeZone,
  onPick,
  className,
}: {
  timeZone: string;
  onPick: (zone: string) => void;
  className: string;
}) {
  const [search, setSearch] = useState("");
  const zones = useMemo(
    () => [...new Set([...COMMON_ZONES, ...Intl.supportedValuesOf("timeZone")])],
    [],
  );
  const filtered = zones.filter((zone) =>
    `${zone} ${zoneLabel(zone)}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <input
        aria-label="Search time zones"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search city or region"
        className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-ring"
      />
      <div className={className} role="listbox" aria-label="Timezone">
        {filtered.map((zone) => (
          <button
            key={zone}
            type="button"
            role="option"
            aria-selected={zone === timeZone}
            onClick={() => onPick(zone)}
            className={`block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted ${zone === timeZone ? "bg-muted font-semibold" : ""}`}
          >
            {zone.replaceAll("_", " ")}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="px-2 py-2 text-xs text-muted-foreground">No matching timezone</p>
        )}
      </div>
    </>
  );
}

type FilterPage = "menu" | "channels" | "posts" | "zone";

/**
 * The board's filters behind one button: a row per filter, each opening its choices in the
 * same panel. A popover on a wide screen, a bottom sheet on a phone.
 */
export function PublishFilters<T extends string>({
  phone,
  accounts,
  selected,
  onSelect,
  shown,
  shownOptions,
  onShown,
  timeZone,
  onZone,
}: {
  phone: boolean;
  accounts: Account[];
  selected: string[];
  onSelect: (ids: string[]) => void;
  shown: T;
  shownOptions: { value: T; label: string }[];
  onShown: (value: T) => void;
  timeZone: string;
  onZone: (zone: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<FilterPage>("menu");
  const all = selected.length === accounts.length;
  const filtered = !all || shown !== shownOptions[0]?.value;
  const row = `flex w-full items-center gap-3 rounded-lg px-3 text-left text-foreground hover:bg-muted ${phone ? "min-h-11 text-[15px]" : "min-h-9 text-sm"}`;
  const back = (label: string) => (
    <button type="button" onClick={() => setPage("menu")} className={`${row} font-semibold`}>
      <CaretLeft size={16} /> {label}
    </button>
  );
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setPage("menu");
  };
  const trigger = (
    <Button
      size="icon-sm"
      variant={filtered ? "secondary" : "outline"}
      aria-label={filtered ? "Filters (on)" : "Filters"}
    >
      <Funnel />
    </Button>
  );

  const body: ReactNode = (
    <>
      {page === "menu" && (
        <div className="flex flex-col">
          <button type="button" onClick={() => setPage("channels")} className={row}>
            <SquaresFour size={18} />
            <span className="flex-1">{all ? "All channels" : `Channels (${selected.length})`}</span>
            <CaretRight size={15} className="text-muted-foreground" />
          </button>
          <button type="button" onClick={() => setPage("posts")} className={row}>
            <Stack size={18} />
            <span className="flex-1">
              {shownOptions.find((option) => option.value === shown)?.label}
            </span>
            <CaretRight size={15} className="text-muted-foreground" />
          </button>
          <div className="my-1.5 border-t border-border" />
          <button type="button" onClick={() => setPage("zone")} className={row}>
            <Globe size={18} />
            <span className="flex-1">{zoneLabel(timeZone)}</span>
            <CaretRight size={15} className="text-muted-foreground" />
          </button>
        </div>
      )}

      {page === "channels" && (
        <div className="flex flex-col">
          {back("Channels")}
          <button
            type="button"
            onClick={() => onSelect(all ? [] : accounts.map((account) => account.id))}
            className={`${row} text-muted-foreground`}
          >
            {all ? "Clear selection" : "Select all"}
          </button>
          {accounts.map((account) => {
            const on = selected.includes(account.id);
            return (
              <button
                key={account.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() =>
                  onSelect(
                    on ? selected.filter((id) => id !== account.id) : [...selected, account.id],
                  )
                }
                className={row}
              >
                <ChannelAvatar
                  provider={account.provider}
                  avatar={account.avatar}
                  name={account.name}
                  size="sm"
                />
                <span className="flex-1 truncate">{account.name}</span>
                {on && <Check size={16} weight="bold" />}
              </button>
            );
          })}
          {accounts.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No channels connected</p>
          )}
        </div>
      )}

      {page === "posts" && (
        <div className="flex flex-col" role="radiogroup" aria-label="Posts">
          {back("Posts")}
          {shownOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={option.value === shown}
              onClick={() => {
                onShown(option.value);
                setPage("menu");
              }}
              className={row}
            >
              <span className="flex-1">{option.label}</span>
              {option.value === shown && <Check size={16} weight="bold" />}
            </button>
          ))}
        </div>
      )}

      {page === "zone" && (
        <div className="flex flex-col gap-2">
          {back("Time zone")}
          <ZoneList
            timeZone={timeZone}
            className={phone ? "max-h-[50vh] overflow-y-auto" : "max-h-64 overflow-y-auto"}
            onPick={(zone) => {
              onZone(zone);
              setPage("menu");
            }}
          />
        </div>
      )}
    </>
  );

  if (phone)
    return (
      <BottomSheet title="Filters" open={open} onOpenChange={onOpenChange} trigger={trigger}>
        {body}
      </BottomSheet>
    );
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="end" className="w-72 gap-0 p-1.5">
        {body}
      </PopoverContent>
    </Popover>
  );
}
