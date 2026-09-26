import dayjs from "dayjs";
import { siteConfig } from "#/config/site";

export default function Footer() {
  const year = dayjs().format("YYYY");

  return (
    <footer className="mx-4 mt-auto border-t border-border px-1 py-8 text-sm text-muted-foreground sm:mx-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-semibold tracking-tight text-foreground">{siteConfig.name}</p>
          <p className="mt-1 text-xs">Publish on your time.</p>
        </div>
        <p className="font-mono text-[11px] tracking-wide">
          &copy; {year} {siteConfig.name} · YouTube today
        </p>
      </div>
    </footer>
  );
}
