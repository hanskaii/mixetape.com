import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FolderSimplePlus,
  MagnifyingGlass,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Notice, Page, PageHeader } from "#/components/layouts/workspace-page";
import { useConfirmModal, useModal } from "#/components/providers/modal-providers";
import { siteConfig } from "#/config/site";
import type { GroupView } from "#/modules/library/groups.service";
import {
  addFilesToGroup,
  createGroupFromFiles,
  getLibraryData,
  listLooseFiles,
  removeGroup,
} from "#/modules/library/library.fn";
import type { FileView } from "#/modules/storage/files.service";
import { removeFiles } from "#/modules/storage/storage.fn";
import { DragDock } from "./-components/drag-dock";
import { FileCard } from "./-components/file-card";
import { FILES_TYPE, GroupCard } from "./-components/group-card";
import { GroupModal } from "./-components/group-modal";
import { Masonry } from "./-components/masonry";
import { PublishModal, type PublishDraft } from "./-components/publish-modal";
import { SelectionBar } from "./-components/selection-bar";
import { UploadTray } from "./-components/upload-tray";
import { useUploads } from "./-lib/use-uploads";

export const Route = createFileRoute("/(app)/_app/library/")({
  loader: () => getLibraryData(),
  head: () => ({ meta: [{ title: `Library | ${siteConfig.name}` }] }),
  component: LibraryPage,
});

type Kind = "all" | "video" | "image";
const KINDS: { id: Kind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "video", label: "Videos" },
  { id: "image", label: "Images" },
];

const ratio = (file: FileView) => (file.width && file.height ? file.height / file.width : 1);

function LibraryPage() {
  const router = useRouter();
  const data = Route.useLoaderData();
  const { groups, accounts, brands, platforms, scheduled, retentionDays } = data;
  const { confirm } = useConfirmModal();
  const { openModal, closeModal } = useModal();
  const input = useRef<HTMLInputElement>(null);

  const [list, setList] = useState(data.files);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [notice, setNotice] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const loading = useRef(false);

  const refresh = useCallback(() => router.invalidate(), [router]);
  const filtered = Boolean(search.trim()) || kind !== "all";
  const filter = () => ({
    search: search.trim() || undefined,
    kind: kind === "all" ? undefined : [kind],
  });

  // The loader's first page, unless a search or a kind asks the server for another.
  useEffect(() => {
    if (!filtered) {
      setList(data.files);
      return;
    }
    let live = true;
    const wait = setTimeout(async () => {
      const page = await listLooseFiles({ data: filter() });
      if (live) setList(page);
    }, 250);
    return () => {
      live = false;
      clearTimeout(wait);
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- filter() reads search and kind
  }, [data.files, search, kind, filtered]);

  // Files that left (grouped, deleted) leave the selection too.
  useEffect(() => {
    setSelected((current) => current.filter((id) => list.files.some((file) => file.id === id)));
  }, [list]);

  const more = useCallback(async () => {
    if (!list.nextCursor || loading.current) return;
    loading.current = true;
    try {
      const page = await listLooseFiles({ data: { ...filter(), cursor: list.nextCursor } });
      setList((current) => ({
        files: [...current.files, ...page.files],
        nextCursor: page.nextCursor,
      }));
    } finally {
      loading.current = false;
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- filter() reads search and kind
  }, [list.nextCursor, search, kind]);

  const { uploads, add, clearFinished } = useUploads(
    useCallback(
      (file: FileView) => {
        // A loose file shows at once; a group's shows when the page refreshes.
        if (!file.groupId && !filtered)
          setList((current) => ({ ...current, files: [file, ...current.files] }));
      },
      [filtered],
    ),
    refresh,
  );

  const attempt = async (action: () => Promise<unknown>, done?: string) => {
    setNotice(null);
    try {
      await action();
      if (done) setNotice({ tone: "success", text: done });
      await refresh();
    } catch (err) {
      setNotice({
        tone: "danger",
        text: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  };

  // ── selection ─────────────────────────────────────────────────────────────
  // The order files are picked in is the order a carousel gets.
  const toggle = (file: FileView, event: React.MouseEvent | React.KeyboardEvent) => {
    if (event.shiftKey && anchor) {
      const from = list.files.findIndex((item) => item.id === anchor);
      const to = list.files.findIndex((item) => item.id === file.id);
      const range = list.files
        .slice(Math.min(from, to), Math.max(from, to) + 1)
        .map((item) => item.id);
      setSelected((current) => [...current, ...range.filter((id) => !current.includes(id))]);
    } else
      setSelected((current) =>
        current.includes(file.id) ? current.filter((id) => id !== file.id) : [...current, file.id],
      );
    setAnchor(file.id);
  };
  const selectedFiles = selected
    .map((id) => list.files.find((file) => file.id === id))
    .filter((file): file is FileView => Boolean(file));

  // ── actions ───────────────────────────────────────────────────────────────
  const publish = (files: FileView[], draft: PublishDraft = {}, groupId?: string) =>
    openModal(
      <PublishModal
        files={files}
        groupId={groupId}
        draft={draft}
        accounts={accounts}
        brands={brands}
        platforms={platforms}
        retentionDays={retentionDays}
        onClose={closeModal}
        onPublished={() => {
          setSelected([]);
          void refresh();
        }}
      />,
    );

  const newGroup = (fileIds: string[]) =>
    attempt(async () => {
      await createGroupFromFiles({ data: { fileIds } });
      setSelected([]);
    });

  const moveTo = (groupId: string, fileIds: string[]) =>
    attempt(async () => {
      await addFilesToGroup({ data: { groupId, fileIds } });
      setSelected([]);
    });

  const deleteSelected = () =>
    confirm({
      title: `Delete ${selected.length} file${selected.length === 1 ? "" : "s"}?`,
      description: "They leave your storage. Posts already on a platform stay there.",
      confirmText: "Delete",
      variant: "destructive",
      onConfirm: () =>
        attempt(async () => {
          const result = await removeFiles({ data: { ids: selected } });
          setSelected([]);
          if (result.kept.length) throw new Error(`Kept ${result.kept.length}: ${result.kept[0]}`);
        }),
    });

  const openGroup = (group: GroupView) =>
    openModal(
      <GroupModal
        group={group}
        onClose={closeModal}
        onChanged={() => void refresh()}
        onUpload={(files) => add(files, group.id)}
        onPublish={(current) => {
          closeModal();
          publish(current.files, current, current.id);
        }}
        onDelete={(deleteFiles) => {
          closeModal();
          void attempt(() => removeGroup({ data: { id: group.id, deleteFiles } }));
        }}
      />,
    );

  const emptyGroup = () =>
    attempt(async () => {
      const group = await createGroupFromFiles({ data: { fileIds: [] } });
      openGroup(group);
    });

  // ── dragging ──────────────────────────────────────────────────────────────
  const dragStart = (file: FileView, event: React.DragEvent) => {
    const ids = selected.includes(file.id) ? selected : [file.id];
    event.dataTransfer.setData(FILES_TYPE, JSON.stringify(ids));
    event.dataTransfer.effectAllowed = "move";
    setDragging(true);
  };

  const empty = !list.files.length && !groups.length && !filtered;

  return (
    // The whole page takes files from the computer.
    <div
      className="relative min-h-[70vh]"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDropping(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false);
      }}
      // A group card takes its own drops; the overlay goes either way.
      onDropCapture={() => setDropping(false)}
      onDrop={(event) => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        add([...event.dataTransfer.files]);
      }}
    >
      <Page>
        <PageHeader
          title="Library"
          description="Drop your videos and images here. Group what goes out together, then publish it to every channel it fits."
          actions={
            <>
              <Button size="sm" variant="outline" onClick={() => void emptyGroup()}>
                <FolderSimplePlus /> New group
              </Button>
              <Button size="sm" onClick={() => input.current?.click()}>
                <UploadSimple /> Upload
              </Button>
              <input
                ref={input}
                type="file"
                multiple
                accept="video/*,image/*"
                hidden
                onChange={(event) => {
                  if (event.target.files?.length) add([...event.target.files]);
                  event.target.value = "";
                }}
              />
            </>
          }
        />

        {notice && (
          <Notice tone={notice.tone}>
            {notice.tone === "danger" && <WarningCircle />} {notice.text}
          </Notice>
        )}

        <UploadTray uploads={uploads} onClear={clearFinished} />

        {empty ? (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="grid min-h-80 place-items-center rounded-3xl border-2 border-dashed border-border bg-card/50 px-6 text-center transition-colors hover:border-foreground/30"
          >
            <span className="grid justify-items-center gap-3">
              <span className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
                <UploadSimple size={26} weight="bold" />
              </span>
              <span className="text-base font-semibold">Drop videos and images here</span>
              <span className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                Or ask your agent to upload them into a group with its captions written — then you
                only pick where it goes. Files stay {retentionDays} days.
              </span>
            </span>
          </button>
        ) : (
          <>
            {groups.length > 0 && (
              <section className="grid gap-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Groups · {groups.length}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {groups.map((group) => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      onOpen={() => openGroup(group)}
                      onPublish={() => publish(group.files, group, group.id)}
                      onDropFiles={(ids) => void moveTo(group.id, ids)}
                      onDropUploads={(files) => add(files, group.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="mr-auto text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Files
                </h2>
                <label className="relative w-full sm:w-64">
                  <span className="sr-only">Search files</span>
                  <MagnifyingGlass
                    size={15}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    type="search"
                    placeholder="Search by name"
                    className="pl-8"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <div role="radiogroup" aria-label="Kind" className="flex rounded-xl bg-muted p-1">
                  {KINDS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={kind === option.id}
                      onClick={() => setKind(option.id)}
                      className={`h-7 rounded-lg px-3 text-xs font-medium transition-colors ${kind === option.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {list.files.length ? (
                <Masonry
                  items={list.files}
                  getKey={(file) => file.id}
                  ratio={ratio}
                  onEnd={list.nextCursor ? more : undefined}
                  render={(file) => (
                    <FileCard
                      file={file}
                      selected={selected.includes(file.id)}
                      order={selected.length > 1 ? selected.indexOf(file.id) + 1 : 0}
                      selecting={selected.length > 0}
                      scheduled={scheduled[file.url] ?? 0}
                      onToggle={(event) => toggle(file, event)}
                      onDragStart={(event) => dragStart(file, event)}
                      onDragEnd={() => setDragging(false)}
                    />
                  )}
                />
              ) : (
                <p className="py-12 text-center text-[13px] text-muted-foreground">
                  {filtered ? "No file matches." : "Every file is in a group."}
                </p>
              )}
            </section>
          </>
        )}
        {/* Room for the selection bar. */}
        <div className="h-20" />
      </Page>

      {dragging ? (
        <DragDock
          groups={groups}
          onNewGroup={(ids) => {
            setDragging(false);
            void newGroup(ids);
          }}
          onMove={(groupId, ids) => {
            setDragging(false);
            void moveTo(groupId, ids);
          }}
        />
      ) : (
        <SelectionBar
          files={selectedFiles}
          groups={groups}
          onPublish={() => publish(selectedFiles)}
          onGroup={() => void newGroup(selected)}
          onMove={(groupId) => void moveTo(groupId, selected)}
          onDelete={deleteSelected}
          onClear={() => setSelected([])}
        />
      )}

      {dropping && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-sm">
          <p className="flex items-center gap-2 rounded-2xl bg-card px-5 py-4 text-sm font-semibold shadow-xl ring-1 ring-border">
            <UploadSimple size={18} /> Drop to upload — onto a group to put them in it
          </p>
        </div>
      )}
    </div>
  );
}
