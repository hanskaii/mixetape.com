import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { z } from "zod";
import { Plus, UploadSimple, WarningCircle } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Notice, Page, PageHeader, Panel } from "#/components/layouts/workspace-page";
import { useConfirmModal, useModal } from "#/components/providers/modal-providers";
import { siteConfig } from "#/config/site";
import type { ItemView } from "#/modules/library/library.service";
import { getLibraryData, removeContent } from "#/modules/library/library.fn";
import type { FileView } from "#/modules/storage/files.service";
import { removeFile } from "#/modules/storage/storage.fn";
import { ContentModal } from "./-components/content-modal";
import { ContentView } from "./-components/content-view";
import { FilesView } from "./-components/files-view";
import { UploadTray } from "./-components/upload-tray";
import { useUploads } from "./-lib/use-uploads";

export const Route = createFileRoute("/(app)/_app/library/")({
  validateSearch: z.object({ tab: z.enum(["content", "files"]).optional() }),
  loader: () => getLibraryData(),
  head: () => ({ meta: [{ title: `Library | ${siteConfig.name}` }] }),
  component: LibraryPage,
});

const TABS = [
  { id: "content", label: "Content" },
  { id: "files", label: "Files" },
] as const;

function LibraryPage() {
  const router = useRouter();
  const navigate = useNavigate({ from: "/library/" });
  const { files, items } = Route.useLoaderData();
  const { tab = "content" } = Route.useSearch();
  const { confirm } = useConfirmModal();
  const { openModal, closeModal } = useModal();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => router.invalidate(), [router]);
  const { uploads, add, clearFinished } = useUploads(refresh);

  const upload = (list: FileList | null) => {
    if (!list?.length) return;
    add([...list]);
    void navigate({ search: { tab: "files" } });
  };

  const openContent = (props: { item?: ItemView; files?: FileView[] }) =>
    openModal(
      <ContentModal
        {...props}
        onClose={closeModal}
        onSaved={async () => {
          await navigate({ search: { tab: "content" } });
          await refresh();
        }}
      />,
    );

  const attempt = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const deleteFile = (file: FileView) =>
    confirm({
      title: "Delete this file?",
      description: `"${file.name}" is removed from storage. Posts already on a platform stay there.`,
      confirmText: "Delete",
      variant: "destructive",
      onConfirm: () => attempt(() => removeFile({ data: { id: file.id } })),
    });

  const deleteItem = (item: ItemView) =>
    confirm({
      title: "Delete this content?",
      description: "Its title, caption and metadata go; its files stay in storage.",
      confirmText: "Delete",
      variant: "destructive",
      onConfirm: () => attempt(() => removeContent({ data: { id: item.id } })),
    });

  return (
    // The whole page takes dropped files.
    <div
      className="relative"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        upload(event.dataTransfer.files);
      }}
    >
      <Page>
        <PageHeader
          title="Library"
          description="Files in your storage, and the content written for them before it is scheduled."
          actions={
            <>
              <Button size="sm" variant="outline" onClick={() => openContent({})}>
                <Plus /> New content
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
                  upload(event.target.files);
                  event.target.value = "";
                }}
              />
            </>
          }
        />

        {error && (
          <Notice tone="danger">
            <WarningCircle /> {error}
          </Notice>
        )}

        <UploadTray uploads={uploads} onClear={clearFinished} />

        <Panel>
          <div className="px-4 pb-6 pt-2 sm:px-6">
            <div
              role="tablist"
              aria-label="Library"
              className="mb-4 flex gap-4 border-b border-border"
            >
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => navigate({ search: { tab: item.id } })}
                  className={`flex h-10 items-center gap-2 border-b-2 px-1.5 text-sm font-medium transition-colors ${tab === item.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {tab === "files" ? (
              <FilesView
                initial={files}
                onUpload={() => input.current?.click()}
                onNewContent={(chosen) => openContent({ files: chosen })}
                onDelete={deleteFile}
              />
            ) : (
              <ContentView
                initial={items}
                onNew={() => openContent({})}
                onEdit={(item) => openContent({ item })}
                onDelete={deleteItem}
              />
            )}
          </div>
        </Panel>
      </Page>

      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-primary bg-background/80 backdrop-blur-sm">
          <p className="flex items-center gap-2 text-sm font-medium">
            <UploadSimple size={18} /> Drop to upload to your library
          </p>
        </div>
      )}
    </div>
  );
}
