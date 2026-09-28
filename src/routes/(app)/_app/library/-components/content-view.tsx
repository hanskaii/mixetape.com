import { useEffect, useState } from "react";
import {
  CalendarPlus,
  DotsThree,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Robot,
  Trash,
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
import { PlatformLogo } from "#/components/ui/platform-logo";
import type { ItemView } from "#/modules/library/library.service";
import { listLibraryItems } from "#/modules/library/library.fn";
import { FileThumb } from "./file-thumb";

type ItemPage = { items: ItemView[]; nextCursor: string | null };

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

/** Content written for files but not scheduled yet, newest first. */
export function ContentView({
  initial,
  onNew,
  onEdit,
  onSchedule,
  onDelete,
}: {
  initial: ItemPage;
  onNew: () => void;
  onEdit: (item: ItemView) => void;
  onSchedule: (item: ItemView) => void;
  onDelete: (item: ItemView) => void;
}) {
  const [search, setSearch] = useState("");
  const [list, setList] = useState(initial);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!search.trim()) {
      setList(initial);
      return;
    }
    let live = true;
    const wait = setTimeout(async () => {
      const page = await listLibraryItems({ data: { search: search.trim() } });
      if (live) setList(page);
    }, 250);
    return () => {
      live = false;
      clearTimeout(wait);
    };
  }, [initial, search]);

  const more = async () => {
    if (!list.nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await listLibraryItems({
        data: { search: search.trim() || undefined, cursor: list.nextCursor },
      });
      setList({ items: [...list.items, ...page.items], nextCursor: page.nextCursor });
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="grid gap-3">
      <label className="relative">
        <span className="sr-only">Search content</span>
        <MagnifyingGlass
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          placeholder="Search titles, captions and descriptions"
          className="pl-8"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      {list.items.length ? (
        <ul className="divide-y divide-border">
          {list.items.map((item) => {
            const overrides = Object.keys(
              (item.metadata.platforms as Record<string, unknown> | undefined) ?? {},
            );
            return (
              <li key={item.id} className="flex items-center gap-3 px-1 py-2">
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <FileThumb file={item.files[0]} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[13px] font-medium ${item.title || item.caption ? "" : "text-muted-foreground"}`}
                    >
                      {item.title || item.caption || "Untitled"}
                    </span>
                    <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      {item.createdBy === "agent" && <Robot size={13} aria-label="By an agent" />}
                      {item.files.length} file{item.files.length === 1 ? "" : "s"}
                      {item.posts.length > 0 && (
                        <span>
                          · scheduled on {item.posts.length} channel
                          {item.posts.length === 1 ? "" : "s"}
                        </span>
                      )}
                      {overrides.length > 0 && (
                        <span className="flex items-center gap-1" title="Has overrides for">
                          ·
                          {overrides.map((provider) => (
                            <PlatformLogo key={provider} provider={provider} size="xs" />
                          ))}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  <LocalTime date={item.updatedAt} format={DAY} />
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={!item.files.length}
                  onClick={() => onSchedule(item)}
                >
                  <CalendarPlus /> Schedule
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button size="icon-sm" variant="ghost" aria-label="Actions">
                        <DotsThree weight="bold" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="min-w-40">
                    <DropdownMenuItem onClick={() => onEdit(item)}>
                      <PencilSimple /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(item)}>
                      <Trash /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      ) : search.trim() ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">No content matches.</p>
      ) : (
        <div className="grid justify-items-center gap-2 py-12 text-center">
          <p className="text-[13px] font-medium">No content yet</p>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            Content is a set of files with its title, caption and tags, before it is scheduled.
            Agents write it with create_item; you can too.
          </p>
          <Button size="sm" variant="outline" onClick={onNew}>
            <Plus /> New content
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
