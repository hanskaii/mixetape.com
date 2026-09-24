import { useMemo, useState, useEffect } from "react";
import { List, CaretDown as ChevronDown } from "@phosphor-icons/react";

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
}

export function extractHeadings(html: string): { headings: TocItem[]; htmlWithIds: string } {
  if (typeof window === "undefined") {
    const headings: TocItem[] = [];
    const htmlWithIds = html.replace(/<(h[2-3])(.*?)>(.*?)<\/\1>/gi, (_match, tag, attrs, text) => {
      const cleanText = text.replace(/<[^>]+>/g, "").trim();
      const id = cleanText
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      const level = parseInt(tag[1], 10);
      headings.push({ id, text: cleanText, level });
      return `<${tag}${attrs} id="${id}">${text}</${tag}>`;
    });
    return { headings, htmlWithIds };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const elements = doc.querySelectorAll("h2, h3");
  const headings: TocItem[] = [];

  elements.forEach((el) => {
    const text = el.textContent?.trim() || "";
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    el.setAttribute("id", id);
    headings.push({
      id,
      text,
      level: el.tagName === "H2" ? 2 : 3,
    });
  });

  return { headings, htmlWithIds: doc.body.innerHTML };
}

export function TableOfContents({ content }: TableOfContentsProps) {
  const { headings } = useMemo(() => extractHeadings(content), [content]);
  const [activeId, setActiveId] = useState<string>("");
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: "0px 0px -70% 0px",
        threshold: 0.1,
      },
    );

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating Desktop Sidebar (outside main container) */}
      <aside className="hidden xl:block w-56 text-xs select-none">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
            <List className="size-3 text-primary" />
            <span>On this page</span>
          </p>

          <nav className="space-y-1 max-h-[calc(100vh-10rem)] overflow-y-auto pr-2 border-l border-border/60">
            {headings.map((item) => {
              const isActive = activeId === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById(item.id);
                    if (el) {
                      el.scrollIntoView({ behavior: "smooth" });
                      setActiveId(item.id);
                    }
                  }}
                  className={`block transition-colors leading-snug py-1 truncate -ml-px border-l-2 ${
                    item.level === 3 ? "pl-5 text-[11px]" : "pl-3"
                  } ${
                    isActive
                      ? "border-primary text-primary font-semibold"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                  title={item.text}
                >
                  {item.text}
                </a>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Collapsible Floating Pill for Mobile/Tablet (< xl) */}
      <div className="xl:hidden w-full rounded-xl border border-border/60 bg-muted/30 p-3">
        <button
          type="button"
          onClick={() => setIsOpenMobile(!isOpenMobile)}
          className="flex w-full items-center justify-between text-xs font-semibold text-foreground cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <List className="size-3.5 text-primary" />
            <span>On this page ({headings.length})</span>
          </span>
          <ChevronDown
            className={`size-3.5 text-muted-foreground transition-transform duration-200 ${
              isOpenMobile ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpenMobile && (
          <nav className="mt-2.5 pt-2 border-t border-border/40 space-y-1.5 text-xs">
            {headings.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setIsOpenMobile(false)}
                className={`block py-0.5 text-muted-foreground hover:text-foreground transition-colors ${
                  item.level === 3 ? "pl-3 text-[11px]" : "font-medium"
                }`}
              >
                {item.text}
              </a>
            ))}
          </nav>
        )}
      </div>
    </>
  );
}
