import { Link } from "@tanstack/react-router";
import { Route as RootRoute } from "#/routes/__root";
import { siteConfig } from "#/config/site";
import { HeaderUser } from "./header-user";
import ThemeToggle from "./theme-toggle";
import { BookmarkHeaderMenu } from "#/routes/(public)/blog/-components/bookmark-header-menu";

export function AppHeader() {
  const { session } = RootRoute.useRouteContext();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-50 bg-background/80 px-4 backdrop-blur-md backdrop-saturate-150 border-b border-border">
      <nav className="flex items-center justify-between py-2.5">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            to="/"
            className="flex items-center gap-2 font-bold text-sm text-foreground no-underline group"
          >
            <img
              src={siteConfig.author.avatar}
              alt={`${siteConfig.name} logo`}
              className="size-5 rounded-md transition-transform duration-200 group-hover:scale-105"
            />
            <span>{siteConfig.name}</span>
          </Link>

          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Link
              to="/blog"
              className="px-2.5 py-1 rounded-full hover:text-foreground hover:bg-muted/40 transition-colors"
              activeProps={{ className: "text-foreground font-semibold bg-muted/60" }}
            >
              Blog
            </Link>
            <Link
              to="/about"
              className="px-2.5 py-1 rounded-full hover:text-foreground hover:bg-muted/40 transition-colors"
              activeProps={{ className: "text-foreground font-semibold bg-muted/60" }}
            >
              About
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {user && (
            <Link
              to="/dashboard"
              className="px-2.5 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              activeProps={{ className: "text-foreground font-semibold bg-muted/60" }}
            >
              Dashboard
            </Link>
          )}

          {user && <BookmarkHeaderMenu />}

          <HeaderUser />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
