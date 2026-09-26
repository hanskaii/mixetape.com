import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "@phosphor-icons/react";
import { Route as RootRoute } from "#/routes/__root";
import { siteConfig } from "#/config/site";
import { HeaderUser } from "./header-user";
import ThemeToggle from "./theme-toggle";

const workspaceLinks = [
  { to: "/publish", label: "Publish" },
  { to: "/channels", label: "Channels" },
  { to: "/api-keys", label: "API keys" },
] as const;

export function AppHeader() {
  const { session } = RootRoute.useRouteContext();
  const user = session?.user;

  return (
    <header className="sticky top-3 z-50 mx-4 mt-3 rounded-[20px] border border-border bg-card/90 px-3 py-2 shadow-[0_14px_32px_-24px_rgba(23,19,10,0.55)] backdrop-blur-xl backdrop-saturate-150 sm:mx-6 sm:px-4">
      <nav
        aria-label="Main navigation"
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
      >
        <Link
          to="/"
          className="group flex shrink-0 items-center gap-2.5 text-[19px] font-bold tracking-[-0.045em] text-foreground"
        >
          <img
            src={siteConfig.author.avatar}
            alt=""
            className="size-9 rounded-[10px] transition-transform duration-200 group-hover:-rotate-6"
          />
          <span>{siteConfig.name}</span>
          <span className="hidden rounded-md border border-border px-1.5 py-0.5 font-mono text-[9px] font-medium tracking-[0.14em] text-muted-foreground uppercase md:inline-flex">
            Studio
          </span>
        </Link>

        {user ? (
          <div className="order-3 flex w-full items-center gap-1 overflow-x-auto pt-1 sm:order-none sm:w-auto sm:pt-0">
            {workspaceLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="shrink-0 rounded-xl px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                activeProps={{ className: "!bg-primary !text-primary-foreground font-semibold" }}
              >
                {label}
              </Link>
            ))}
          </div>
        ) : (
          <div className="hidden items-center gap-1 sm:flex">
            <a
              href="/#how"
              className="rounded-xl px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              How it works
            </a>
            <a
              href="/#features"
              className="rounded-xl px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Features
            </a>
          </div>
        )}

        <div className="flex items-center gap-2">
          {user && (
            <Link
              to="/publish"
              className="hidden items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground transition-transform hover:-translate-y-px md:inline-flex"
            >
              New post <ArrowUpRight className="size-4" />
            </Link>
          )}
          <HeaderUser />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
