import { useEffect, useState } from "react";
import {
  ArrowSquareOut,
  Copy,
  DotsThree,
  MagnifyingGlass,
  Plus,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import { LocalTime } from "#/components/layouts/workspace-page";
import { listLibraryFiles } from "#/modules/library/library.fn";
import type { FileView } from "#/modules/storage/files.service";
import { FileThumb } from "./file-thumb";
import { fileSummary } from "../-lib/format";

type FilePage = { files: FileView[]; nextCursor: string | null };
type Kind = "all" | "video" | "image";

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
const KINDS: { id: Kind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "video", label: "Videos" },
  { id: "image", label: "Images" },
];

/** Everything in storage, newest first: search, filter by kind, select files to make content. */
export function FilesView({
  initial,
  onUpload,
  onNewContent,
  onDelete,
}: {
  initial: FilePage;
  onUpload: () => void;
  onNewContent: (files: FileView[]) => void;
  onDelete: (file: FileView) => void;
}) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [list, setList] = useState(initial);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<FileView[]>([]);
  const filtered = Boolean(search.trim()) || kind !== "all";
  const filter = () => ({
    search: search.trim() || undefined,
    kind: kind === "all" ? undefined : [kind],
  });

  // The loader's first page, unless a search or filter asks the server for another.
  useEffect(() => {
    if (!filtered) {
      setList(initial);
      return;
    }
    let live = true;
    const wait = setTimeout(async () => {
      const page = await listLibraryFiles({ data: filter() });
      if (live) setList(page);
    }, 250);
    return () => {
      live = false;
      clearTimeout(wait);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- filter() reads search and kind
  }, [initial, search, kind, filtered]);

  const more = async () => {
    if (!list.nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await listLibraryFiles({ data: { ...filter(), cursor: list.nextCursor } });
      setList({ files: [...list.files, ...page.files], nextCursor: page.nextCursor });
    } finally {
      setLoadingMore(false);
    }
  };

  const isSelected = (file: FileView) => selected.some((other) => other.id === file.id);
  const toggle = (file: FileView) =>
    setSelected(
      isSelected(file) ? selected.filter((other) => other.id !== file.id) : [...selected, file],
    );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Search files</span>
          <MagnifyingGlass
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            placeholder="Search by file name"
            className="pl-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div role="radiogroup" aria-label="Kind" className="flex rounded-lg bg-muted p-0.5">
          {KINDS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={kind === option.id}
              onClick={() => setKind(option.id)}
              className={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${kind === option.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-[13px]">
          <span className="flex-1 font-medium">
            {selected.length} file{selected.length > 1 ? "s" : ""} selected
          </span>
          <Button size="xs" variant="ghost" onClick={() => setSelected([])}>
            Clear
          </Button>
          <Button
            size="xs"
            onClick={() => {
              onNewContent(selected);
              setSelected([]);
            }}
          >
            <Plus /> New content
          </Button>
        </div>
      )}

      {list.files.length ? (
        <ul className="divide-y divide-border">
          {list.files.map((file) => (
            <li
              key={file.id}
              className={`flex items-center gap-3 px-1 py-2 ${isSelected(file) ? "bg-primary/5" : ""}`}
            >
              <input
                type="checkbox"
                aria-label={`Select ${file.name}`}
                checked={isSelected(file)}
                onChange={() => toggle(file)}
                className="size-4 shrink-0 accent-primary"
              />
              <button
                type="button"
                onClick={() => toggle(file)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <FileThumb file={file} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{file.name}</span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {fileSummary(file)}
                    {file.orientation && ` · ${file.orientation}`}
                  </span>
                </span>
              </button>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                <LocalTime date={file.createdAt} format={DAY} />
              </span>
              <FileMenu file={file} onDelete={() => onDelete(file)} />
            </li>
          ))}
        </ul>
      ) : filtered ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">No file matches.</p>
      ) : (
        <div className="grid justify-items-center gap-2 py-12 text-center">
          <p className="text-[13px] font-medium">No file yet</p>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            Drop videos and images here, or let an agent upload them with create_upload.
          </p>
          <Button size="sm" variant="outline" onClick={onUpload}>
            <UploadSimple /> Upload files
          </Button>
        </div>
      )}

      {list.nextCursor && (
        <Button
          variant="outline"
          size="sm"
          className="justify-self-center"
          disabled={loadingMore}
          onClick={more}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}

function FileMenu({ file, onDelete }: { file: FileView; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${file.name}`}>
            <DotsThree weight="bold" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem render={<a href={file.publicUrl} target="_blank" rel="noreferrer" />}>
          <ArrowSquareOut /> Open
        </DropdownMenuItem>
        {/* What an agent passes as mediaUrl, or to get_file. */}
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(file.url)}>
          <Copy /> Copy file URL
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
