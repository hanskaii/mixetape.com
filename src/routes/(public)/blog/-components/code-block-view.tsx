import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";

const LANGUAGES = [
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "html",
  "css",
  "json",
  "python",
  "bash",
  "sql",
  "markdown",
  "yaml",
  "rust",
  "go",
  "java",
  "cpp",
  "c",
  "plaintext",
];

export function CodeBlockComponent({ node, updateAttributes, extension }: any) {
  const [copied, setCopied] = useState(false);
  const defaultLanguage = extension.options.defaultLanguage;
  const language = node.attrs.language || defaultLanguage || "plaintext";

  const handleCopy = async () => {
    const text = node.textContent;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  return (
    <NodeViewWrapper className="code-block-wrapper relative my-4 rounded-xl border border-border/80 bg-zinc-950 text-zinc-100 shadow-sm overflow-hidden dark:border-zinc-800">
      {/* Code Header: language selector on left, copy button on right */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/90 px-3 py-1.5 text-xs select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-red-500/80 inline-block" />
            <span className="size-2.5 rounded-full bg-yellow-500/80 inline-block" />
            <span className="size-2.5 rounded-full bg-green-500/80 inline-block" />
          </div>

          <select
            contentEditable={false}
            aria-label="Select code language"
            value={language}
            onChange={(e) => updateAttributes({ language: e.target.value })}
            className="bg-transparent font-mono text-[11px] font-semibold text-zinc-300 hover:text-white uppercase tracking-wider focus:outline-none cursor-pointer pr-1"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang} className="bg-zinc-900 text-zinc-200 text-xs">
                {lang}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          contentEditable={false}
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-mono text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors cursor-pointer"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="size-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <pre className="!bg-transparent !p-3.5 !m-0 overflow-x-auto text-[13px] font-mono leading-relaxed selection:bg-primary/30">
        <NodeViewContent as="div" className={`language-${language}`} />
      </pre>
    </NodeViewWrapper>
  );
}
