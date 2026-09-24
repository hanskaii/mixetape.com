import dayjs from "dayjs";
import { Image as ImageIcon, ArrowUpRight } from "@phosphor-icons/react";
import { Input } from "#/components/ui/input";
import { siteConfig } from "#/config/site";

interface SettingsTabProps {
  sessionUser: {
    id: string;
    name?: string | null;
    email: string;
  };
}

export function SettingsTab({ sessionUser }: SettingsTabProps) {
  return (
    <div className="space-y-6">
      {/* 1. Open Graph & Social Card Preview */}
      <div className="bg-card p-5 sm:p-6 rounded-2xl ring-1 ring-foreground/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ImageIcon className="size-4 text-primary" />
              <span>Social Share Card (Open Graph)</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Default social card automatically generated for your posts when shared.
            </p>
          </div>
          <a
            href={`/api/og?title=${encodeURIComponent(siteConfig.title)}&author=${encodeURIComponent(sessionUser.name || siteConfig.author.name)}&tags=Architecture,Edge`}
            target="_blank"
            rel="noreferrer"
            className="h-8 px-4 rounded-full text-xs font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center gap-1.5 shadow-2xs shrink-0 transition-colors"
          >
            <span>Preview Card</span>
            <ArrowUpRight className="size-3" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
          <div className="sm:col-span-7 rounded-xl border border-border/80 overflow-hidden bg-black/90 shadow-2xs aspect-1200/630">
            <img
              src={`/api/og?title=Clean+Edge+Architecture+Guide&author=${encodeURIComponent(sessionUser.name || siteConfig.author.name)}&tags=Edge,Cloudflare,TanStack&date=${dayjs().format("MMM D, YYYY")}`}
              alt="Social Card Preview"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="sm:col-span-5 space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p className="font-medium text-foreground">Dynamic Edge Rendering</p>
            <p>
              Rendered on-the-fly at the Cloudflare edge using WASM (@takumi-js/response). Clean,
              fast, and consistent across X, LinkedIn, and messaging apps.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Author Profile & Account Settings */}
      <div className="bg-card p-5 sm:p-6 rounded-2xl ring-1 ring-foreground/10 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-foreground">Author Profile &amp; Account</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Account identity and credentials.</p>
        </div>

        <div className="space-y-4 max-w-xl">
          <div className="space-y-1.5">
            <label htmlFor="userId" className="text-xs font-semibold text-foreground">
              User ID
            </label>
            <Input
              id="userId"
              readOnly
              value={sessionUser.id}
              className="h-8 text-xs font-mono rounded-full bg-muted/40 cursor-default"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="authorName" className="text-xs font-semibold text-foreground">
              Author Name
            </label>
            <Input
              id="authorName"
              readOnly
              value={sessionUser.name || siteConfig.author.name}
              className="h-8 text-xs rounded-full bg-muted/40 cursor-default"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="authorEmail" className="text-xs font-semibold text-foreground">
              Author Email
            </label>
            <Input
              id="authorEmail"
              readOnly
              value={sessionUser.email}
              className="h-8 text-xs font-mono rounded-full bg-muted/40 cursor-default"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
