import { Link } from "@tanstack/react-router";
import { CalendarBlank, Key, PlugsConnected } from "@phosphor-icons/react";

const TABS = [
  { to: "/publish", label: "Publish", icon: CalendarBlank },
  { to: "/channels", label: "Channels", icon: PlugsConnected },
  { to: "/api-keys", label: "API", icon: Key },
] as const;

/** The tabs across the top of every publishing page. */
export function PublishingTabs() {
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-border pb-4">
      {TABS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          activeProps={{
            className: "!bg-primary !text-primary-foreground font-semibold hover:!bg-primary",
          }}
        >
          <Icon className="size-4" />
          <span>{label}</span>
        </Link>
      ))}
    </div>
  );
}

export const selectClassName =
  "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";
