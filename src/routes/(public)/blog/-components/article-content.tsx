import { useEffect, useRef } from "react";
import { common, createLowlight } from "lowlight";

const lowlight = createLowlight(common);

interface ArticleContentProps {
  html: string;
}

function highlightCodeBlocks(rawHtml: string): string {
  if (!rawHtml) return "";

  return rawHtml.replace(
    /<pre><code(?:\s+class="([^"]*)")?>([\s\S]*?)<\/code><\/pre>/gi,
    (_match, classAttr = "", codeContent = "") => {
      // Decode HTML entities
      const rawText = codeContent
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&#39;/g, "'");

      const langMatch = classAttr.match(/language-([a-zA-Z0-9_-]+)/);
      let lang = langMatch ? langMatch[1].toLowerCase() : "";

      if (lang === "caddy") lang = "nginx"; // fallback caddy to nginx/text

      let highlightedHtml = "";
      try {
        if (lang && lowlight.registered(lang)) {
          const tree = lowlight.highlight(lang, rawText);
          highlightedHtml = tree.children.map((c) => serializeHast(c)).join("");
        } else {
          const autoTree = lowlight.highlightAuto(rawText);
          if (!lang && autoTree.data?.language) {
            lang = autoTree.data.language;
          }
          highlightedHtml = autoTree.children.map((c) => serializeHast(c)).join("");
        }
      } catch {
        highlightedHtml = codeContent;
      }

      const displayLang = lang || "plaintext";

      return `
        <div class="code-block-wrapper relative my-6 rounded-2xl ring-1 ring-foreground/10 bg-zinc-950 text-zinc-100 shadow-xs overflow-hidden dark:border-zinc-800/60">
          <div class="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/90 px-3.5 py-2 text-xs select-none">
            <div class="flex items-center gap-2.5">
              <div class="flex items-center gap-1.5">
                <span class="size-2.5 rounded-full bg-red-500/80 inline-block"></span>
                <span class="size-2.5 rounded-full bg-yellow-500/80 inline-block"></span>
                <span class="size-2.5 rounded-full bg-green-500/80 inline-block"></span>
              </div>
              <span class="font-mono text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">${displayLang}</span>
            </div>
            <button
              type="button"
              class="code-copy-btn inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-mono text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
              title="Copy code"
            >
              <svg class="copy-icon size-3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              <span class="copy-text">Copy</span>
            </button>
          </div>
          <pre class="!bg-transparent !p-4 !m-0 overflow-x-auto text-[13px] font-mono leading-relaxed selection:bg-primary/30"><code class="hljs language-${displayLang}">${highlightedHtml || codeContent}</code></pre>
        </div>
      `;
    },
  );
}

function serializeHast(node: any): string {
  if (node.type === "text") {
    return node.value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  if (node.type === "element") {
    const className = node.properties?.className
      ? Array.isArray(node.properties.className)
        ? node.properties.className.join(" ")
        : node.properties.className
      : "";
    const childrenStr = (node.children || []).map((c: any) => serializeHast(c)).join("");
    return `<${node.tagName}${className ? ` class="${className}"` : ""}>${childrenStr}</${node.tagName}>`;
  }
  return "";
}

export function ArticleContent({ html }: ArticleContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedHtml = highlightCodeBlocks(html);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const copyButtons = container.querySelectorAll<HTMLButtonElement>(".code-copy-btn");
    const handlers: Array<() => void> = [];

    copyButtons.forEach((btn) => {
      const handler = async () => {
        const wrapper = btn.closest(".code-block-wrapper");
        const codeEl = wrapper?.querySelector("pre code");
        if (!codeEl) return;

        const codeText = codeEl.textContent || "";
        try {
          await navigator.clipboard.writeText(codeText);
          const textSpan = btn.querySelector(".copy-text");
          if (textSpan) textSpan.textContent = "Copied!";
          btn.classList.add("text-emerald-400");

          setTimeout(() => {
            if (textSpan) textSpan.textContent = "Copy";
            btn.classList.remove("text-emerald-400");
          }, 2000);
        } catch (e) {
          console.error(e);
        }
      };

      btn.addEventListener("click", handler);
      handlers.push(() => btn.removeEventListener("click", handler));
    });

    return () => {
      handlers.forEach((h) => h());
    };
  }, [renderedHtml]);

  return (
    <div
      ref={containerRef}
      className="typeset max-w-none text-foreground leading-relaxed font-sans"
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}
