import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarBlank, Key, PlugsConnected } from "@phosphor-icons/react";

const TABS = [
  { to: "/publish", label: "Publish", icon: CalendarBlank },
  { to: "/channels", label: "Channels", icon: PlugsConnected },
  { to: "/api-keys", label: "API keys", icon: Key },
] as const;

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <main className="workspace-shell">
      <PublishingTabs />
      <div className="workspace-content">{children}</div>
    </main>
  );
}

export function PublishingTabs() {
  return (
    <nav aria-label="Workspace" className="workspace-sidebar">
      <Link to="/" className="hidden px-3 text-[21px] font-bold tracking-[-.065em] md:block">
        mixetape
      </Link>
      <p className="hidden px-3 pt-8 font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground md:block">
        Workspace
      </p>
      <div className="flex gap-1 overflow-x-auto md:mt-3 md:flex-col">
        {TABS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            activeProps={{ className: "!bg-primary/20 !text-foreground font-semibold" }}
          >
            <Icon className="size-[18px]" />
            <span>{label}</span>
          </Link>
        ))}
      </div>
      <p className="mt-auto hidden px-3 font-mono text-[10px] uppercase tracking-[.13em] text-muted-foreground md:block">
        YouTube today
      </p>
    </nav>
  );
}

export const selectClassName =
  "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";
