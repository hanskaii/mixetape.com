import { Link, useLocation } from "@tanstack/react-router";
import { ArrowRight } from "@phosphor-icons/react";
import { Route as RootRoute } from "#/routes/__root";
import { siteConfig } from "#/config/site";
import { HeaderUser } from "./header-user";
import ThemeToggle from "./theme-toggle";

export function AppHeader() {
  const { session } = RootRoute.useRouteContext();
  const user = session?.user;
  const isLanding = useLocation().pathname === "/";

  return (
    <header className="sticky top-0 z-50 mx-4 bg-background/90 px-1 py-3 backdrop-blur-xl sm:mx-8">
      <nav
        aria-label="Main navigation"
        className={
          isLanding
            ? "flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:translate-x-[48px]"
            : "flex items-center justify-between gap-4"
        }
      >
        <Link
          to="/"
          className="group flex shrink-0 items-center text-[23px] font-bold tracking-[-0.07em] text-foreground"
        >
          <span>{siteConfig.name}</span>
        </Link>

        {isLanding && (
          <div className="hidden items-center gap-2 sm:flex">
            <a
              href="/#how"
              className="rounded-lg px-3 py-2 text-[13px] font-medium transition-colors hover:bg-muted"
            >
              How it works
            </a>
            <a
              href="/#agents"
              className="rounded-lg px-3 py-2 text-[13px] font-medium transition-colors hover:bg-muted"
            >
              For agents
            </a>
          </div>
        )}

        <div className="flex items-center gap-2">
          {user && (
            <Link
              to="/queue"
              className="hidden items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/80 md:inline-flex"
            >
              Workspace <ArrowRight className="size-4" />
            </Link>
          )}
          <HeaderUser />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
