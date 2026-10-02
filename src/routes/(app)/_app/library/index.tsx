import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { MagnifyingGlass, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Segmented } from "#/components/ui/segmented";
import { Notice, Page, PageHeader, Panel } from "#/components/layouts/workspace-page";
import { useConfirmModal, useModal } from "#/components/providers/modal-providers";
import { siteConfig } from "#/config/site";
import type { GroupView } from "#/modules/library/groups.service";
import {
  addFilesToGroup,
  createGroupFromFiles,
  getLibraryData,
  listLooseFiles,
  removeGroup,
  ungroupFiles,
} from "#/modules/library/library.fn";
import type { FileView } from "#/modules/storage/files.service";
import { removeFiles } from "#/modules/storage/storage.fn";
import { colors, radius } from "../../../../components/ui/tokens.stylex";
import { DragDock } from "./-components/drag-dock";
import { FileCard } from "./-components/file-card";
import { FILES_TYPE, FROM_GROUP_TYPE, GROUP_FOOTER, GroupCard } from "./-components/group-card";
import { GroupBand } from "./-components/group-band";
import { Masonry } from "./-components/masonry";
import { PublishModal, type PublishDraft } from "./-components/publish-modal";
import { SelectionBar } from "./-components/selection-bar";
import { setStackDragImage } from "./-lib/drag-image";
import { useUploads } from "./-lib/use-uploads";

export const Route = createFileRoute("/(app)/_app/library/")({
  loader: () => getLibraryData(),
  head: () => ({ meta: [{ title: `Library | ${siteConfig.name}` }] }),
  component: LibraryPage,
});

type Kind = "all" | "video" | "image" | "group";
const KINDS: { value: Kind; label: string }[] = [
  { value: "all", label: "All" },
  { value: "video", label: "Videos" },
  { value: "image", label: "Images" },
  { value: "group", label: "Carousels" },
];

/** One place in the grid: a group or a loose file, newest activity first. */
type Tile =
  | { type: "group"; key: string; at: number; group: GroupView }
  | { type: "file"; key: string; at: number; file: FileView };

const styles = stylex.create({
  root: { minHeight: "70vh", position: "relative" },
  body: {
    alignContent: "start",
    display: "grid",
    gap: "1rem",
    minHeight: "24rem",
    paddingBlock: "0.5rem 1.5rem",
    paddingInline: { default: "1rem", "@media (min-width: 640px)": "1.5rem" },
  },
  toolbar: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
    borderBottomWidth: "1px",
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    justifyContent: "space-between",
    paddingBlock: "0.5rem 0.75rem",
  },
  search: {
    position: "relative",
    width: { default: "100%", "@media (min-width: 640px)": "16rem" },
  },
  searchIcon: {
    color: colors.mutedForeground,
    left: "0.625rem",
    pointerEvents: "none",
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
  },
  searchInput: { paddingInlineStart: "2rem" },
  empty: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: { default: colors.border, ":hover": colors.mutedForeground },
    borderRadius: radius["2xl"],
    borderStyle: "dashed",
    borderWidth: "2px",
    color: colors.foreground,
    cursor: "pointer",
    display: "grid",
    justifyItems: "center",
    minHeight: "18rem",
    paddingInline: "1.5rem",
    rowGap: "0.75rem",
    textAlign: "center",
    transitionDuration: "150ms",
    transitionProperty: "border-color",
    width: "100%",
    alignContent: "center",
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    color: colors.primaryForeground,
    display: "flex",
    height: "3.5rem",
    justifyContent: "center",
    width: "3.5rem",
  },
  emptyTitle: { fontSize: "1rem", fontWeight: 600 },
  emptyText: {
    color: colors.mutedForeground,
    fontSize: "0.8125rem",
    lineHeight: 1.6,
    maxWidth: "24rem",
  },
  nothing: {
    color: colors.mutedForeground,
    fontSize: "0.8125rem",
    margin: 0,
    paddingBlock: "3rem",
    textAlign: "center",
  },
  room: { height: "5rem" },
  hidden: { display: "none" },
  overlay: {
    alignItems: "center",
    backdropFilter: "blur(4px)",
    backgroundColor: `color-mix(in oklab, ${colors.background} 70%, transparent)`,
    display: "flex",
    inset: 0,
    justifyContent: "center",
    pointerEvents: "none",
    position: "fixed",
    zIndex: 50,
  },
  overlayText: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius["2xl"],
    borderStyle: "solid",
    borderWidth: "1px",
    boxShadow: "0 18px 40px -12px rgb(0 0 0 / 0.35)",
    display: "flex",
    fontSize: "0.875rem",
    fontWeight: 600,
    gap: "0.5rem",
    margin: 0,
    paddingBlock: "1rem",
    paddingInline: "1.25rem",
  },
});

const fileHeight = (file: FileView, column: number) =>
  column * Math.min(Math.max(file.width && file.height ? file.height / file.width : 1, 0.56), 1.78);

function LibraryPage() {
  const router = useRouter();
  const data = Route.useLoaderData();
  const { groups, accounts, brands, platforms, scheduled, retentionHours } = data;
  const { confirm } = useConfirmModal();
  const { openModal, closeModal } = useModal();
  const input = useRef<HTMLInputElement>(null);

  const [list, setList] = useState(data.files);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // The group open across the grid, and the one files are being dragged out of.
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const loading = useRef(false);

  const refresh = useCallback(() => router.invalidate(), [router]);
  const words = search.trim().toLowerCase();
  const fileKind = kind === "video" || kind === "image" ? kind : undefined;
  const serverFiltered = Boolean(words) || Boolean(fileKind);

  // The loader's first page, unless a search or a kind asks the server for another.
  useEffect(() => {
    if (!serverFiltered) {
      setList(data.files);
      return;
    }
    let live = true;
    const wait = setTimeout(async () => {
      const page = await listLooseFiles({
        data: { search: words || undefined, kind: fileKind && [fileKind] },
      });
      if (live) setList(page);
    }, 250);
    return () => {
      live = false;
      clearTimeout(wait);
    };
  }, [data.files, words, fileKind, serverFiltered]);

  const filesById = useMemo(() => new Map(list.files.map((file) => [file.id, file])), [list]);

  // Files that left (grouped, deleted) leave the selection too.
  useEffect(() => {
    setSelected((current) => {
      const kept = current.filter((id) => filesById.has(id));
      return kept.length === current.length ? current : kept;
    });
  }, [filesById]);

  const more = useCallback(async () => {
    if (!list.nextCursor || loading.current) return;
    loading.current = true;
    try {
      const page = await listLooseFiles({
        data: { search: words || undefined, kind: fileKind && [fileKind], cursor: list.nextCursor },
      });
      setList((current) => ({
        files: [...current.files, ...page.files],
        nextCursor: page.nextCursor,
      }));
    } finally {
      loading.current = false;
    }
  }, [list.nextCursor, words, fileKind]);

  const upload = useUploads(
    useCallback(
      (file: FileView) => {
        // A loose file shows at once; a group's shows when the page refreshes.
        if (!file.groupId && !serverFiltered)
          setList((current) => ({ ...current, files: [file, ...current.files] }));
      },
      [serverFiltered],
    ),
    refresh,
  );

  // Groups and loose files share the grid, most recent activity first.
  const tiles = useMemo<Tile[]>(() => {
    const shownGroups =
      kind === "all" || kind === "group"
        ? groups.filter(
            (group) =>
              !words || `${group.title ?? ""} ${group.caption ?? ""}`.toLowerCase().includes(words),
          )
        : [];
    const shownFiles = kind === "group" ? [] : list.files;
    return [
      ...shownGroups.map((group) => ({
        type: "group" as const,
        key: `g:${group.id}`,
        at: new Date(group.updatedAt).getTime(),
        group,
      })),
      ...shownFiles.map((file) => ({
        type: "file" as const,
        key: file.id,
        at: new Date(file.createdAt).getTime(),
        file,
      })),
    ].sort((a, b) => b.at - a.at);
  }, [groups, list.files, kind, words]);

  const attempt = async (action: () => Promise<unknown>, done?: string) => {
    setNotice(null);
    try {
      await action();
      if (done) toast.success(done);
      await refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  // ── selection ─────────────────────────────────────────────────────────────
  // The order files are picked in is the order a carousel gets.
  const order = useMemo(() => new Map(selected.map((id, index) => [id, index + 1])), [selected]);
  const selectedFiles = selected.flatMap((id) => filesById.get(id) ?? []);

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
        images={list.files.filter((file) => file.kind === "image")}
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
    }, "Carousel made");

  const moveTo = (groupId: string, fileIds: string[]) =>
    attempt(
      async () => {
        await addFilesToGroup({ data: { groupId, fileIds } });
        setSelected([]);
      },
      `Moved ${fileIds.length} file${fileIds.length === 1 ? "" : "s"}`,
    );

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
        }, "Deleted"),
    });

  const openGroup = (group: GroupView) =>
    setExpanded((current) => (current === group.id ? null : group.id));

  const takeOut = (fileIds: string[]) =>
    attempt(
      () => ungroupFiles({ data: { fileIds } }),
      `Took ${fileIds.length} file${fileIds.length === 1 ? "" : "s"} out`,
    );

  const deleteGroup = (group: GroupView, deleteFiles: boolean) => {
    setExpanded(null);
    void attempt(
      () => removeGroup({ data: { id: group.id, deleteFiles } }),
      deleteFiles ? "Carousel and files deleted" : "Carousel undone — files kept",
    );
  };

  const dragStart = (file: FileView, event: React.DragEvent) => {
    const ids = order.has(file.id) ? selected : [file.id];
    event.dataTransfer.setData(FILES_TYPE, JSON.stringify(ids));
    // The grabbed file on top of the stack the pointer carries.
    const others = ids.filter((id) => id !== file.id).flatMap((id) => filesById.get(id) ?? []);
    setStackDragImage(event, [file, ...others]);
    event.dataTransfer.effectAllowed = "move";
    setDragging(true);
  };

  // Cards get callbacks that never change, so selecting one card re-renders only it; they
  // reach the current handlers through this ref, refreshed after each render.
  const handlers = useRef({ toggle, dragStart, openGroup, publish, moveTo, upload });
  useLayoutEffect(() => {
    handlers.current = { toggle, dragStart, openGroup, publish, moveTo, upload };
  });
  const cardToggle = useCallback(
    (file: FileView, event: React.MouseEvent | React.KeyboardEvent) =>
      handlers.current.toggle(file, event),
    [],
  );
  const cardDragStart = useCallback(
    (file: FileView, event: React.DragEvent) => handlers.current.dragStart(file, event),
    [],
  );
  const cardDragEnd = useCallback(() => setDragging(false), []);
  const groupOpen = useCallback((group: GroupView) => handlers.current.openGroup(group), []);
  const groupPublish = useCallback(
    (group: GroupView) => handlers.current.publish(group.files, group, group.id),
    [],
  );
  const groupDropFiles = useCallback(
    (group: GroupView, ids: string[]) => void handlers.current.moveTo(group.id, ids),
    [],
  );
  const groupDropUploads = useCallback(
    (group: GroupView, files: File[]) => handlers.current.upload(files, group.id),
    [],
  );

  const empty = !list.files.length && !groups.length && !serverFiltered && kind === "all";

  // An open group lies across the grid where its card was: the grid above it, the band, the
  // grid below it.
  const openAt = expanded
    ? tiles.findIndex((tile) => tile.type === "group" && tile.group.id === expanded)
    : -1;
  const openTile = openAt >= 0 ? tiles[openAt] : null;
  const open = openTile?.type === "group" ? openTile.group : null;
  const before = open ? tiles.slice(0, openAt) : tiles;
  const after = open ? tiles.slice(openAt + 1) : [];
  const onEnd = list.nextCursor && kind !== "group" ? more : undefined;

  const grid = (items: Tile[], end?: () => void) =>
    items.length > 0 && (
      <Masonry
        items={items}
        getKey={(tile) => tile.key}
        height={(tile, column) =>
          tile.type === "group"
            ? Math.round(column * 0.75) + GROUP_FOOTER
            : fileHeight(tile.file, column)
        }
        onEnd={end}
        render={(tile) =>
          tile.type === "group" ? (
            <GroupCard
              group={tile.group}
              onOpen={groupOpen}
              onPublish={groupPublish}
              onDropFiles={groupDropFiles}
              onDropUploads={groupDropUploads}
            />
          ) : (
            <FileCard
              file={tile.file}
              selected={order.has(tile.file.id)}
              order={selected.length > 1 ? (order.get(tile.file.id) ?? 0) : 0}
              selecting={selected.length > 0}
              scheduled={scheduled[tile.file.url] ?? 0}
              onToggle={cardToggle}
              onDragStart={cardDragStart}
              onDragEnd={cardDragEnd}
            />
          )
        }
      />
    );

  return (
    // The whole page takes files from the computer.
    <div
      {...stylex.props(styles.root)}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(FROM_GROUP_TYPE)) {
          event.preventDefault();
          return;
        }
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
        // A file dragged out of an open group and let go on the grid leaves the group.
        if (event.dataTransfer.types.includes(FROM_GROUP_TYPE)) {
          event.preventDefault();
          const ids = event.dataTransfer.getData(FILES_TYPE);
          if (ids) void takeOut(JSON.parse(ids) as string[]);
          return;
        }
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        upload([...event.dataTransfer.files]);
      }}
    >
      <Page>
        <PageHeader
          title="Library"
          description="Drop your videos and images here. Put what goes out together in a carousel, then publish it to every channel it fits."
          actions={
            <>
              <Button size="sm" onClick={() => input.current?.click()}>
                <UploadSimple /> Upload
              </Button>
              <input
                ref={input}
                type="file"
                multiple
                accept="video/*,image/*"
                {...stylex.props(styles.hidden)}
                onChange={(event) => {
                  if (event.target.files?.length) upload([...event.target.files]);
                  event.target.value = "";
                }}
              />
            </>
          }
        />

        {notice && (
          <Notice tone="danger">
            <WarningCircle /> {notice}
          </Notice>
        )}

        <Panel>
          <div {...stylex.props(styles.body)}>
            {empty ? (
              <button
                type="button"
                onClick={() => input.current?.click()}
                {...stylex.props(styles.empty)}
              >
                <span {...stylex.props(styles.emptyIcon)}>
                  <UploadSimple size={26} weight="bold" />
                </span>
                <span {...stylex.props(styles.emptyTitle)}>Drop videos and images here</span>
                <span {...stylex.props(styles.emptyText)}>
                  Or ask your agent to upload them into a carousel with its captions written — then
                  you only pick where it goes. Files not scheduled within {retentionHours} hours are
                  deleted.
                </span>
              </button>
            ) : (
              <>
                <div {...stylex.props(styles.toolbar)}>
                  <Segmented label="Show" value={kind} onChange={setKind} options={KINDS} />
                  <label {...stylex.props(styles.search)}>
                    <MagnifyingGlass size={15} {...stylex.props(styles.searchIcon)} />
                    <Input
                      type="search"
                      aria-label="Search the library"
                      placeholder="Search by name"
                      style={styles.searchInput}
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                </div>

                {tiles.length ? (
                  <>
                    {grid(before, open ? undefined : onEnd)}
                    {open && (
                      <GroupBand
                        key={open.id}
                        group={open}
                        // Only if it is still the open one: a click on another carousel opens that.
                        onCollapse={() =>
                          setExpanded((current) => (current === open.id ? null : current))
                        }
                        onPublish={(current) => publish(current.files, current, current.id)}
                        onChanged={() => void refresh()}
                        onDragging={setDragFrom}
                        onUpload={(files) => upload(files, open.id)}
                        onDelete={(deleteFiles) => deleteGroup(open, deleteFiles)}
                      />
                    )}
                    {open && grid(after, onEnd)}
                  </>
                ) : (
                  <p {...stylex.props(styles.nothing)}>
                    {kind === "group" && !words
                      ? "No carousel yet. Select files and press Carousel, or drag them onto New carousel at the bottom."
                      : "Nothing matches."}
                  </p>
                )}
              </>
            )}
          </div>
        </Panel>
        {/* Room for the selection bar. */}
        <div {...stylex.props(styles.room)} />
      </Page>

      {dragging || dragFrom ? (
        <DragDock
          onNewCarousel={(ids) => {
            setDragging(false);
            setDragFrom(null);
            void newGroup(ids);
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
        <div {...stylex.props(styles.overlay)}>
          <p {...stylex.props(styles.overlayText)}>
            <UploadSimple size={18} /> Drop to upload — onto a carousel to put them in it
          </p>
        </div>
      )}
    </div>
  );
}
