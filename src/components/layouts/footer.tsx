import dayjs from "dayjs";
import { siteConfig } from "#/config/site";

export default function Footer() {
  const year = dayjs().format("YYYY");

  return (
    <footer className="border-t border-border px-4 py-8 text-muted-foreground text-xs">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="m-0">
          &copy; {year} {siteConfig.name}.
        </p>
        <p className="m-0 text-[11px]">Crafted for speed &amp; simplicity</p>
      </div>
    </footer>
  );
}
