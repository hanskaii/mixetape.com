import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Typography from "@tiptap/extension-typography";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import CharacterCount from "@tiptap/extension-character-count";
import Focus from "@tiptap/extension-focus";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { useState } from "react";
import { markdownToHtml } from "#/modules/posts/markdown";
import {
  TextB as Bold,
  TextItalic as Italic,
  TextUnderline as UnderlineIcon,
  TextStrikethrough as Strikethrough,
  TextHOne as Heading1,
  TextHTwo as Heading2,
  TextHThree as Heading3,
  TextT as Type,
  List,
  ListNumbers as ListOrdered,
  ListChecks as ListTodo,
  Code,
  Quotes as Quote,
  ArrowCounterClockwise as Undo,
  ArrowClockwise as Redo,
  Image as ImageIcon,
  Link as LinkIcon,
  Minus,
  Highlighter,
  TextAlignLeft as AlignLeft,
  TextAlignCenter as AlignCenter,
  TextAlignRight as AlignRight,
  Sparkle as Sparkles,
  SpinnerGap as Loader2,
  Check,
  CaretDown as ChevronDown,
  MagicWand as Wand2,
  Square,
  Table as TableIcon,
  DotsThree as MoreHorizontal,
  FileText,
} from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { useModal } from "#/components/providers/modal-providers";
import { CodeBlockComponent } from "./code-block-view";

const lowlight = createLowlight(common);

interface BlogEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
  onAiSummaryGenerated?: (summary: string) => void;
  onAiTitleGenerated?: (title: string) => void;
}

export function BlogEditorSkeleton() {
  return (
    <div className="w-full space-y-4 animate-pulse">
      {/* Compact Toolbar skeleton */}
      <div className="flex items-center justify-between border-b border-border/40 py-1.5">
        <div className="flex items-center gap-1">
          <Skeleton className="h-7 w-24 rounded-md bg-muted/60" />
          <div className="h-3.5 w-px bg-border/40 mx-1" />
          <Skeleton className="h-7 w-7 rounded-md bg-muted/60" />
          <Skeleton className="h-7 w-7 rounded-md bg-muted/60" />
          <Skeleton className="h-7 w-7 rounded-md bg-muted/60" />
          <div className="h-3.5 w-px bg-border/40 mx-1" />
          <Skeleton className="h-7 w-7 rounded-md bg-muted/60" />
          <Skeleton className="h-7 w-7 rounded-md bg-muted/60" />
          <div className="h-3.5 w-px bg-border/40 mx-1" />
          <Skeleton className="h-7 w-20 rounded-md bg-muted/60" />
        </div>
        <Skeleton className="h-4 w-16 bg-muted/60" />
      </div>

      {/* Editor Body skeleton */}
      <div className="space-y-3 pt-2">
        <Skeleton className="h-7 w-1/3 rounded bg-muted/70" />
        <Skeleton className="h-4 w-full rounded bg-muted/50" />
        <Skeleton className="h-4 w-11/12 rounded bg-muted/50" />
        <Skeleton className="h-4 w-4/5 rounded bg-muted/50" />
      </div>
    </div>
  );
}

export function BlogEditor({
  content,
  onChange,
  editable = true,
  placeholder = "Write your story, technical breakdown, or ideas here...",
  onAiSummaryGenerated,
  onAiTitleGenerated,
}: BlogEditorProps) {
  const { openMediaPicker } = useModal();
  const [aiStreaming, setAiStreaming] = useState(false);
  const [streamingPreview, setStreamingPreview] = useState("");
  const [streamingAction, setStreamingAction] = useState<string>("");
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [showPromptInput, setShowPromptInput] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false, // Replaced by CodeBlockLowlight
      }),
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockComponent);
        },
      }).configure({
        lowlight,
        defaultLanguage: "typescript",
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          "is-editor-empty before:content-[attr(data-placeholder)] before:text-muted-foreground/50 before:float-left before:pointer-events-none before:h-0",
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-4 font-medium",
        },
      }),
      Typography,
      Underline,
      Highlight.configure({ multicolor: false }),
      Subscript,
      Superscript,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      CharacterCount,
      Focus.configure({ className: "has-focus", mode: "shallowest" }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    editable,
    immediatelyRender: true,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "typeset focus:outline-none min-h-[200px] h-auto text-foreground leading-relaxed selection:bg-primary/20 p-0 m-0 border-0",
      },
    },
  });

  if (!editor) {
    return <BlogEditorSkeleton />;
  }

  if (!editable) {
    return (
      <div className="typeset max-w-none p-0 m-0">
        <EditorContent editor={editor} />
      </div>
    );
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addImage = () => {
    openMediaPicker(handleSelectImage);
  };

  const handleSelectImage = (url: string, alt?: string) => {
    editor
      .chain()
      .focus()
      .setImage({ src: url, alt: alt || "" })
      .run();
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const stopAiStream = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setAiStreaming(false);
    setStreamingPreview("");
    setStreamingAction("");
  };

  const handleAiAction = async (
    action: "continue" | "improve" | "fix_grammar" | "summarize" | "generate_title" | "custom",
    promptOverride?: string,
  ) => {
    const selectedText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      " ",
    );
    const fullText = editor.getText();
    const context = selectedText || fullText;

    if (!context && action !== "custom") {
      window.alert("Please write some text in the editor first.");
      return;
    }

    const controller = new AbortController();
    setAbortController(controller);
    setAiStreaming(true);
    setStreamingAction(action);
    setStreamingPreview("");

    try {
      const res = await fetch("/api/ai/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          context,
          prompt: promptOverride || customPrompt,
          model: "mid-combo",
          stream: true,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error || "Failed to start AI stream");
      }

      if (!res.body) throw new Error("No readable stream received");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedMarkdown = "";
      let buffer = "";

      const replaceWhole = !selectedText && (action === "improve" || action === "fix_grammar");
      let insertPos: number | null = null;

      if (action === "continue" || action === "custom") {
        insertPos = editor.state.selection.to;
      } else if (selectedText && (action === "improve" || action === "fix_grammar")) {
        insertPos = editor.state.selection.from;
        editor.chain().focus().deleteSelection().run();
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            // TanStack AI AG-UI event protocol & standard chunk parsing
            let delta = "";
            if (parsed.type === "TEXT_MESSAGE_CONTENT") {
              delta = parsed.delta || parsed.content || "";
            } else if (parsed.type === "REASONING_MESSAGE_CONTENT") {
              delta = parsed.delta || parsed.content || "";
            } else if (parsed?.choices?.[0]?.delta) {
              delta =
                parsed.choices[0].delta.content || parsed.choices[0].delta.reasoning_content || "";
            }
            if (delta) {
              accumulatedMarkdown += delta;
              setStreamingPreview(accumulatedMarkdown);
            }
          } catch {
            // ignore chunk parse errors
          }
        }
      }

      if (accumulatedMarkdown) {
        // Strip markdown styling (bold, italic, quotes, headers, backticks) for title and excerpt
        const cleanPlainText = accumulatedMarkdown
          .replace(/^#+\s*/gm, "")
          .replace(/[*_`~]/g, "")
          .replace(/^["']|["']$/g, "")
          .trim();

        if (action === "generate_title" && onAiTitleGenerated) {
          onAiTitleGenerated(cleanPlainText);
        } else if (action === "summarize" && onAiSummaryGenerated) {
          onAiSummaryGenerated(cleanPlainText);
        } else {
          const htmlContent = await markdownToHtml(accumulatedMarkdown);

          if (replaceWhole) {
            editor.chain().focus().setContent(htmlContent).run();
          } else if (insertPos !== null) {
            editor.chain().focus().insertContentAt(insertPos, htmlContent).run();
          } else {
            editor.chain().focus().insertContent(htmlContent).run();
          }
        }
      }

      setShowPromptInput(false);
      setCustomPrompt("");
    } catch (err: any) {
      if (err.name !== "AbortError") {
        window.alert(err.message || "AI generation failed");
      }
    } finally {
      setAiStreaming(false);
      setStreamingPreview("");
      setStreamingAction("");
      setAbortController(null);
    }
  };

  const wordCount = editor.storage.characterCount?.words() || 0;

  const getHeadingLabel = () => {
    if (editor.isActive("heading", { level: 1 })) return "Heading 1";
    if (editor.isActive("heading", { level: 2 })) return "Heading 2";
    if (editor.isActive("heading", { level: 3 })) return "Heading 3";
    return "Text";
  };

  return (
    <div className="relative w-full space-y-4">
      {/* Sleek Compact Toolbar */}
      <div className="sticky top-14 z-20 flex flex-wrap items-center justify-between gap-1.5 border-b border-border/40 bg-background/90 py-1.5 backdrop-blur-md">
        <div className="flex items-center gap-1">
          {/* Paragraph / Heading Style Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="h-7 px-2 text-xs font-medium gap-1 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <span>{getHeadingLabel()}</span>
                  <ChevronDown className="size-3 opacity-60" />
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="w-36 p-1">
              <DropdownMenuItem
                onClick={() => editor.chain().focus().setParagraph().run()}
                className={`text-xs cursor-pointer gap-2 ${
                  !editor.isActive("heading") ? "font-semibold bg-accent" : ""
                }`}
              >
                <Type className="size-3.5" />
                <span>Normal Text</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`text-xs cursor-pointer gap-2 ${
                  editor.isActive("heading", { level: 1 }) ? "font-semibold bg-accent" : ""
                }`}
              >
                <Heading1 className="size-3.5" />
                <span>Heading 1</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`text-xs cursor-pointer gap-2 ${
                  editor.isActive("heading", { level: 2 }) ? "font-semibold bg-accent" : ""
                }`}
              >
                <Heading2 className="size-3.5" />
                <span>Heading 2</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`text-xs cursor-pointer gap-2 ${
                  editor.isActive("heading", { level: 3 }) ? "font-semibold bg-accent" : ""
                }`}
              >
                <Heading3 className="size-3.5" />
                <span>Heading 3</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-3.5 w-px bg-border/50 mx-0.5" />

          {/* Primary Format Buttons */}
          <Button
            type="button"
            size="xs"
            variant={editor.isActive("bold") ? "secondary" : "ghost"}
            onClick={() => editor.chain().focus().toggleBold().run()}
            className="h-7 w-7 p-0 rounded-md"
            title="Bold (Ctrl+B)"
          >
            <Bold className="size-3.5" />
          </Button>

          <Button
            type="button"
            size="xs"
            variant={editor.isActive("italic") ? "secondary" : "ghost"}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className="h-7 w-7 p-0 rounded-md"
            title="Italic (Ctrl+I)"
          >
            <Italic className="size-3.5" />
          </Button>

          <Button
            type="button"
            size="xs"
            variant={editor.isActive("underline") ? "secondary" : "ghost"}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className="h-7 w-7 p-0 rounded-md"
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="size-3.5" />
          </Button>

          <div className="h-3.5 w-px bg-border/50 mx-0.5" />

          {/* Lists Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  size="xs"
                  variant={
                    editor.isActive("bulletList") ||
                    editor.isActive("orderedList") ||
                    editor.isActive("taskList")
                      ? "secondary"
                      : "ghost"
                  }
                  className="h-7 px-1.5 rounded-md gap-0.5"
                  title="List styles"
                >
                  {editor.isActive("orderedList") ? (
                    <ListOrdered className="size-3.5" />
                  ) : editor.isActive("taskList") ? (
                    <ListTodo className="size-3.5" />
                  ) : (
                    <List className="size-3.5" />
                  )}
                  <ChevronDown className="size-2.5 opacity-60" />
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="w-38 p-1">
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`text-xs cursor-pointer gap-2 ${
                  editor.isActive("bulletList") ? "font-semibold bg-accent" : ""
                }`}
              >
                <List className="size-3.5" />
                <span>Bullet List</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`text-xs cursor-pointer gap-2 ${
                  editor.isActive("orderedList") ? "font-semibold bg-accent" : ""
                }`}
              >
                <ListOrdered className="size-3.5" />
                <span>Numbered List</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className={`text-xs cursor-pointer gap-2 ${
                  editor.isActive("taskList") ? "font-semibold bg-accent" : ""
                }`}
              >
                <ListTodo className="size-3.5" />
                <span>Checklist</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Media & Link */}
          <Button
            type="button"
            size="xs"
            variant={editor.isActive("link") ? "secondary" : "ghost"}
            onClick={setLink}
            className="h-7 w-7 p-0 rounded-md"
            title="Link"
          >
            <LinkIcon className="size-3.5" />
          </Button>

          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={addImage}
            className="h-7 w-7 p-0 rounded-md"
            title="Image URL"
          >
            <ImageIcon className="size-3.5" />
          </Button>

          {/* Code Block button */}
          <Button
            type="button"
            size="xs"
            variant={editor.isActive("codeBlock") ? "secondary" : "ghost"}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className="h-7 w-7 p-0 rounded-md"
            title="Code Block (``` or Shift+Ctrl+C)"
          >
            <Code className="size-3.5" />
          </Button>

          {/* More Blocks & Formatting Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="h-7 w-7 p-0 rounded-md text-muted-foreground hover:text-foreground"
                  title="More formatting & blocks"
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="w-44 p-1 shadow-md">
              <DropdownMenuLabel className="text-[10px] font-mono text-muted-foreground uppercase px-2 py-1">
                Extra Blocks
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className="text-xs cursor-pointer gap-2"
              >
                <Quote className="size-3.5" />
                <span>Blockquote</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={insertTable} className="text-xs cursor-pointer gap-2">
                <TableIcon className="size-3.5" />
                <span>Table (3x3)</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                className="text-xs cursor-pointer gap-2"
              >
                <Minus className="size-3.5" />
                <span>Divider Line</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] font-mono text-muted-foreground uppercase px-2 py-1">
                Inline Format
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleHighlight().run()}
                className="text-xs cursor-pointer gap-2"
              >
                <Highlighter className="size-3.5" />
                <span>Highlight</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className="text-xs cursor-pointer gap-2"
              >
                <Strikethrough className="size-3.5" />
                <span>Strikethrough</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] font-mono text-muted-foreground uppercase px-2 py-1">
                Alignment
              </DropdownMenuLabel>
              <div className="flex items-center justify-around px-1 py-1">
                <Button
                  type="button"
                  size="xs"
                  variant={editor.isActive({ textAlign: "left" }) ? "secondary" : "ghost"}
                  onClick={() => editor.chain().focus().setTextAlign("left").run()}
                  className="h-6 w-6 p-0"
                >
                  <AlignLeft className="size-3" />
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={editor.isActive({ textAlign: "center" }) ? "secondary" : "ghost"}
                  onClick={() => editor.chain().focus().setTextAlign("center").run()}
                  className="h-6 w-6 p-0"
                >
                  <AlignCenter className="size-3" />
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={editor.isActive({ textAlign: "right" }) ? "secondary" : "ghost"}
                  onClick={() => editor.chain().focus().setTextAlign("right").run()}
                  className="h-6 w-6 p-0"
                >
                  <AlignRight className="size-3" />
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-3.5 w-px bg-border/50 mx-0.5" />

          {/* AI Assistant Menu */}
          {aiStreaming ? (
            <Button
              type="button"
              size="xs"
              variant="destructive"
              onClick={stopAiStream}
              className="h-7 px-2 text-xs font-semibold rounded-md gap-1.5 cursor-pointer shadow-2xs"
            >
              <Square className="size-3 fill-current" />
              <span>Stop AI</span>
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="h-7 px-2 text-xs font-semibold rounded-md gap-1 border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 cursor-pointer"
                  >
                    <Sparkles className="size-3.5 text-primary" />
                    <span>AI</span>
                    <ChevronDown className="size-2.5 opacity-60" />
                  </Button>
                }
              />
              <DropdownMenuContent align="start" className="w-52 p-1.5 shadow-lg">
                <DropdownMenuLabel className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider px-2 py-1 flex items-center justify-between">
                  <span>AI Assistant</span>
                  <span className="text-[9px] text-primary/80 font-normal">mid-combo</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleAiAction("continue")}
                  className="text-xs cursor-pointer gap-2"
                >
                  <Wand2 className="size-3.5 text-primary" />
                  <span>Continue Writing</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleAiAction("improve")}
                  className="text-xs cursor-pointer gap-2"
                >
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Improve & Polish</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleAiAction("fix_grammar")}
                  className="text-xs cursor-pointer gap-2"
                >
                  <Check className="size-3.5 text-primary" />
                  <span>Fix Grammar & Flow</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleAiAction("summarize")}
                  className="text-xs cursor-pointer gap-2"
                >
                  <FileText className="size-3.5 text-primary" />
                  <span>Draft Excerpt (&le;120 words)</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleAiAction("generate_title")}
                  className="text-xs cursor-pointer gap-2"
                >
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Suggest Title</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowPromptInput(true)}
                  className="text-xs cursor-pointer gap-2 font-medium text-primary"
                >
                  <span>Custom Prompt...</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Undo / Redo & Word Count */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-[11px] font-mono hidden sm:inline">{wordCount} words</span>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="h-7 w-7 p-0 rounded-md"
              title="Undo"
            >
              <Undo className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="h-7 w-7 p-0 rounded-md"
              title="Redo"
            >
              <Redo className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Custom AI Prompt Floating Bar */}
      {showPromptInput && (
        <div className="border border-primary/20 bg-primary/5 rounded-lg px-3 py-2 flex items-center gap-2 text-xs">
          <Sparkles className="size-3.5 text-primary shrink-0 animate-pulse" />
          <input
            type="text"
            placeholder="Ask AI to write, rewrite, or brainstorm anything..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAiAction("custom");
              }
            }}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none text-xs"
            autoFocus
          />
          <Button
            type="button"
            size="xs"
            disabled={aiStreaming || !customPrompt.trim()}
            onClick={() => handleAiAction("custom")}
            className="h-6 px-2.5 text-[11px] font-medium"
          >
            {aiStreaming ? <Loader2 className="size-3 animate-spin" /> : "Generate"}
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => setShowPromptInput(false)}
            className="h-6 px-2 text-[11px] text-muted-foreground"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Zenblog Pure Canvas */}
      <div className="w-full relative">
        {/* Floating Menu - Ultra Compact Notion/Zenblog Style */}
        <FloatingMenu
          editor={editor}
          options={{
            strategy: "absolute",
            offset: 6,
          }}
          className="flex items-center gap-0.5 p-0.5 bg-background/95 backdrop-blur-md border border-border/80 shadow-md rounded-md animate-in fade-in-50 zoom-in-95 duration-100 z-30"
        >
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className="h-6 px-1.5 text-[11px] font-bold rounded-sm hover:bg-accent"
            title="Heading 1"
          >
            H1
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className="h-6 px-1.5 text-[11px] font-bold rounded-sm hover:bg-accent"
            title="Heading 2"
          >
            H2
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className="h-6 w-6 p-0 rounded-sm hover:bg-accent"
            title="Bullet list"
          >
            <List className="size-3" />
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className="h-6 w-6 p-0 rounded-sm hover:bg-accent"
            title="Code block"
          >
            <Code className="size-3" />
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={addImage}
            className="h-6 w-6 p-0 rounded-sm hover:bg-accent"
            title="Insert image"
          >
            <ImageIcon className="size-3" />
          </Button>
          <div className="h-3 w-px bg-border/60 mx-0.5" />
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => handleAiAction("continue")}
            className="h-6 px-1.5 text-[11px] font-medium text-primary hover:text-primary hover:bg-primary/10 rounded-sm gap-1"
            title="Continue writing with AI"
          >
            <Sparkles className="size-3 text-primary" />
            <span>AI</span>
          </Button>
        </FloatingMenu>

        {/* Bubble Menu - Ultra Compact Selection Bar */}
        <BubbleMenu
          editor={editor}
          options={{
            strategy: "absolute",
            offset: 6,
          }}
          className="flex items-center gap-0.5 p-0.5 bg-background/95 backdrop-blur-md border border-border/80 shadow-lg rounded-md animate-in fade-in-50 zoom-in-95 duration-100 z-30"
        >
          {/* AI Quick Actions */}
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => handleAiAction("improve")}
            className="h-6 px-1.5 text-[11px] font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1 rounded-sm"
            title="Improve & Polish selected text"
          >
            <Sparkles className="size-3 text-primary" />
            <span>Improve</span>
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => handleAiAction("fix_grammar")}
            className="h-6 px-1.5 text-[11px] font-medium text-primary hover:text-primary hover:bg-primary/10 gap-1 rounded-sm"
            title="Fix grammar in selection"
          >
            <Check className="size-3 text-primary" />
            <span>Fix</span>
          </Button>

          <div className="h-3 w-px bg-border/60 mx-0.5" />

          {/* Text Formatting Icons */}
          <Button
            type="button"
            size="xs"
            variant={editor.isActive("bold") ? "secondary" : "ghost"}
            onClick={() => editor.chain().focus().toggleBold().run()}
            className="h-6 w-6 p-0 rounded-sm"
            title="Bold"
          >
            <Bold className="size-3" />
          </Button>
          <Button
            type="button"
            size="xs"
            variant={editor.isActive("italic") ? "secondary" : "ghost"}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className="h-6 w-6 p-0 rounded-sm"
            title="Italic"
          >
            <Italic className="size-3" />
          </Button>
          <Button
            type="button"
            size="xs"
            variant={editor.isActive("underline") ? "secondary" : "ghost"}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className="h-6 w-6 p-0 rounded-sm"
            title="Underline"
          >
            <UnderlineIcon className="size-3" />
          </Button>
          <Button
            type="button"
            size="xs"
            variant={editor.isActive("strike") ? "secondary" : "ghost"}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className="h-6 w-6 p-0 rounded-sm"
            title="Strikethrough"
          >
            <Strikethrough className="size-3" />
          </Button>
          <Button
            type="button"
            size="xs"
            variant={editor.isActive("highlight") ? "secondary" : "ghost"}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className="h-6 w-6 p-0 rounded-sm"
            title="Highlight"
          >
            <Highlighter className="size-3" />
          </Button>
          <Button
            type="button"
            size="xs"
            variant={editor.isActive("code") ? "secondary" : "ghost"}
            onClick={() => editor.chain().focus().toggleCode().run()}
            className="h-6 w-6 p-0 rounded-sm"
            title="Inline code"
          >
            <Code className="size-3" />
          </Button>
          <Button
            type="button"
            size="xs"
            variant={editor.isActive("link") ? "secondary" : "ghost"}
            onClick={setLink}
            className="h-6 w-6 p-0 rounded-sm"
            title="Link"
          >
            <LinkIcon className="size-3" />
          </Button>
        </BubbleMenu>

        <EditorContent editor={editor} />

        {/* Live Streaming Ghost / Preview Card */}
        {aiStreaming && streamingPreview && (
          <div className="my-4 rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm backdrop-blur-xs animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between border-b border-primary/20 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  AI {streamingAction || "generating"}...
                </span>
              </div>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={stopAiStream}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive gap-1"
              >
                <Square className="size-3 fill-current" />
                <span>Stop</span>
              </Button>
            </div>
            <div className="text-xs font-sans text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {streamingPreview}
              <span className="inline-block w-1.5 h-3.5 ml-1 bg-primary animate-pulse align-middle" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
