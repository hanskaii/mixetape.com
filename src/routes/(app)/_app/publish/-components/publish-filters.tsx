import { useEffect, useMemo, useState } from "react";
import { CaretDown, Globe, SquaresFour } from "@phosphor-icons/react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { ChannelAvatar } from "#/components/ui/channel-avatar";
import { COMMON_ZONES, DEFAULT_ZONE, zoneLabel, type Account } from "../-lib/posts";

/** The toolbar's quiet button look: icon, label, caret. */
export const FILTER_BUTTON =
  "flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring";

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

export function ChannelFilter({
  accounts,
  selected,
  onChange,
}: {
  accounts: Account[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const all = selected.length === accounts.length;
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button type="button" className={FILTER_BUTTON}>
            <SquaresFour size={17} /> {all ? "Channels" : `Channels (${selected.length})`}{" "}
            <CaretDown size={13} />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="max-h-72 min-w-56">
        <DropdownMenuItem
          onClick={() => onChange(all ? [] : accounts.map((account) => account.id))}
        >
          {all ? "Clear selection" : "Select all"}
        </DropdownMenuItem>
        {accounts.map((account) => (
          <DropdownMenuCheckboxItem
            key={account.id}
            checked={selected.includes(account.id)}
            onCheckedChange={() => toggle(account.id)}
          >
            <ChannelAvatar
              provider={account.provider}
              avatar={account.avatar}
              name={account.name}
              size="sm"
            />{" "}
            <span className="truncate">{account.name}</span>
          </DropdownMenuCheckboxItem>
        ))}
        {accounts.length === 0 && (
          <p className="px-2 py-2 text-xs text-muted-foreground">No channels connected</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ZoneFilter({
  timeZone,
  onChange,
}: {
  timeZone: string;
  onChange: (zone: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const zones = useMemo(
    () => [...new Set([...COMMON_ZONES, ...Intl.supportedValuesOf("timeZone")])],
    [],
  );
  const filtered = zones.filter((zone) =>
    `${zone} ${zoneLabel(zone)}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button type="button" className={FILTER_BUTTON}>
            <Globe size={17} /> {zoneLabel(timeZone)} <CaretDown size={13} />
          </button>
        }
      />
      <PopoverContent align="end" className="w-64">
        <label
          htmlFor="publish-timezone-search"
          className="px-1 text-xs font-medium text-muted-foreground"
        >
          Timezone
        </label>
        <input
          id="publish-timezone-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search city or region"
          className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-ring"
        />
        <div className="max-h-56 overflow-y-auto" role="listbox" aria-label="Timezone">
          {filtered.map((zone) => (
            <button
              key={zone}
              type="button"
              role="option"
              aria-selected={zone === timeZone}
              onClick={() => {
                onChange(zone);
                setOpen(false);
                setSearch("");
              }}
              className={`block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${zone === timeZone ? "bg-muted font-semibold" : ""}`}
            >
              {zone.replaceAll("_", " ")}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">No matching timezone</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
