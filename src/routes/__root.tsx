import { HeadContent, Scripts, createRootRouteWithContext, Link } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import Footer from "../components/layouts/footer";
import { AppHeader } from "../components/layouts/app-header";
import { getAuthSession } from "../modules/auth/auth.fn";
import { ModalProvider } from "../components/providers/modal-providers";

import { TanStackQueryDevtools } from "../components/providers/query-devtools";
import { siteConfig } from "#/config/site";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";

export interface MyRouterContext {
  queryClient: QueryClient;
  session?: any;
  user?: any;
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`;

import { Button } from "../components/ui/button";
import { Warning, ArrowLeft, ArrowsClockwise } from "@phosphor-icons/react";

function RootNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full max-w-md rounded-2xl ring-1 ring-foreground/10 bg-card p-8 space-y-4">
        <span className="font-mono text-4xl font-extrabold text-foreground">404</span>
        <h2 className="text-lg font-semibold text-foreground">Page Not Found</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          The page you requested does not exist or has been moved.
        </p>
        <div className="pt-2">
          <Button
            render={
              <Link to="/">
                <ArrowLeft className="size-3.5" />
                <span>Back to Home</span>
              </Link>
            }
            size="sm"
            className="rounded-full gap-1.5"
          />
        </div>
      </div>
    </div>
  );
}

function RootError({ error, reset }: { error: any; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full max-w-lg rounded-2xl ring-1 ring-destructive/30 bg-card p-8 space-y-4 text-left">
        <div className="flex items-center gap-2 text-destructive">
          <Warning className="size-5" />
          <h2 className="text-base font-semibold">Something went wrong</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          An unexpected error occurred while loading this page. Please try again.
        </p>
        <pre className="max-h-40 overflow-auto rounded-xl bg-muted/40 p-3 font-mono text-[11px] text-foreground/80 border border-border">
          {error?.message || String(error)}
        </pre>
        <div className="flex items-center gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            onClick={reset}
            className="rounded-full gap-1.5 cursor-pointer text-xs"
          >
            <ArrowsClockwise className="size-3.5" />
            <span>Try Again</span>
          </Button>
          <Button
            render={<Link to="/">Return to Home</Link>}
            variant="outline"
            size="sm"
            className="rounded-full text-xs"
          />
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async () => {
    const session = await getAuthSession();
    return {
      session,
      user: session?.user ?? null,
    };
  },
  notFoundComponent: RootNotFound,
  errorComponent: RootError,
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: siteConfig.title,
      },
      {
        name: "description",
        content: siteConfig.description,
      },
    ],
    links: [
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg",
      },
      {
        rel: "icon",
        type: "image/x-icon",
        href: "/favicon.ico",
      },
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: `${siteConfig.name} | Blog RSS Feed`,
        href: "/rss.xml",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans antialiased [overflow-wrap:anywhere] selection:bg-primary/20">
        <ModalProvider>
          <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-start md:border-x">
            <AppHeader />
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
          <TanStackDevtools
            config={{
              position: "bottom-right",
            }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
              TanStackQueryDevtools,
            ]}
          />
        </ModalProvider>
        <Scripts />
      </body>
    </html>
  );
}
