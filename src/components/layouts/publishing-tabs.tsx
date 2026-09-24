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
    <div className="flex items-center gap-2 border-b border-border/60 pb-3">
      {TABS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-muted/50 transition-colors"
          activeProps={{
            className: "!text-primary-foreground !bg-primary font-semibold hover:!bg-primary",
          }}
        >
          <Icon className="size-3.5" />
          <span>{label}</span>
        </Link>
      ))}
    </div>
  );
}

export const selectClassName =
  "h-9 w-full rounded-4xl border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
