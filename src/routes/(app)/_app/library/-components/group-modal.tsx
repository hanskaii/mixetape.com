import { useRef, useState } from "react";
import { DotsThree, PaperPlaneTilt, Robot, Trash, UploadSimple, X } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import { Modal, ModalDescription, ModalHeader, ModalTitle } from "#/components/ui/modal";
import { Textarea } from "#/components/ui/textarea";
import type { GroupView } from "#/modules/library/groups.service";
import { saveGroup, ungroupFiles } from "#/modules/library/library.fn";
import { FileThumb } from "./file-thumb";
import { selectionSummary } from "../-lib/format";

/**
 * A group, opened: its files in the order they go out (drag to reorder, × to take one out),
 * the words drafted for it, and Publish. Changes save as they are made.
 */
export function GroupModal({
  group,
  onClose,
  onChanged,
  onPublish,
  onUpload,
  onDelete,
}: {
  group: GroupView;
  onClose: () => void;
  onChanged: () => void;
  onPublish: (group: GroupView) => void;
  onUpload: (files: File[]) => void;
  onDelete: (deleteFiles: boolean) => void;
}) {
  const [files, setFiles] = useState(group.files);
  const [title, setTitle] = useState(group.title ?? "");
  const [caption, setCaption] = useState(group.caption ?? "");
  const [description, setDescription] = useState(group.description ?? "");
  const [dragged, setDragged] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const save = async (changes: Parameters<typeof saveGroup>[0]["data"]) => {
    setSaving(true);
    try {
      await saveGroup({ data: changes });
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const saveWords = () => {
    if (
      title === (group.title ?? "") &&
      caption === (group.caption ?? "") &&
      description === (group.description ?? "")
    )
      return;
    void save({ id: group.id, title, caption, description });
  };

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...files];
    const [file] = next.splice(from, 1);
    next.splice(to, 0, file);
    setFiles(next);
    void save({ id: group.id, fileIds: next.map((item) => item.id) });
  };

  const takeOut = async (fileId: string) => {
    setFiles(files.filter((file) => file.id !== fileId));
    await ungroupFiles({ data: { fileIds: [fileId] } });
    onChanged();
  };

  const current = { ...group, files, title, caption, description };

  return (
    <Modal open onOpenChange={(open) => !open && (saveWords(), onClose())} className="max-w-xl">
      <div className="flex max-h-[84vh] flex-col gap-4 overflow-y-auto [&>*]:shrink-0">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            {group.createdBy === "agent" && (
              <Robot size={16} className="text-muted-foreground" aria-label="Made by an agent" />
            )}
            {title || "Untitled group"}
          </ModalTitle>
          <ModalDescription>
            {files.length ? selectionSummary(files) : "Empty"} · drag to reorder
            {saving && " · saving…"}
          </ModalDescription>
        </ModalHeader>

        <div
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 pt-2"
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes("Files")) event.preventDefault();
          }}
          onDrop={(event) => {
            if (!event.dataTransfer.files.length) return;
            event.preventDefault();
            onUpload([...event.dataTransfer.files]);
          }}
        >
          {files.map((file, index) => (
            <div
              key={file.id}
              draggable
              onDragStart={() => setDragged(index)}
              onDragOver={(event) => {
                if (dragged === null) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                if (dragged === null) return;
                event.preventDefault();
                move(dragged, index);
                setDragged(null);
              }}
              onDragEnd={() => setDragged(null)}
              className={`group relative shrink-0 cursor-grab active:cursor-grabbing ${dragged === index ? "opacity-40" : ""}`}
            >
              <FileThumb file={file} size="md" />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 font-mono text-[10px] text-white">
                {index + 1}
              </span>
              <button
                type="button"
                aria-label={`Take ${file.name} out of the group`}
                onClick={() => void takeOut(file.id)}
                className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-foreground text-background opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X size={11} weight="bold" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="grid size-14 shrink-0 place-items-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            aria-label="Upload files into this group"
          >
            <UploadSimple size={18} />
          </button>
          <input
            ref={input}
            type="file"
            multiple
            accept="video/*,image/*"
            hidden
            onChange={(event) => {
              if (event.target.files?.length) onUpload([...event.target.files]);
              event.target.value = "";
            }}
          />
        </div>

        <label className="grid gap-1.5 text-[13px] font-medium">
          Title
          <Input
            value={title}
            placeholder="Untitled group"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={saveWords}
          />
        </label>
        <label className="grid gap-1.5 text-[13px] font-medium">
          Caption
          <Textarea
            rows={3}
            value={caption}
            placeholder="What the post says"
            onChange={(event) => setCaption(event.target.value)}
            onBlur={saveWords}
          />
        </label>
        <label className="grid gap-1.5 text-[13px] font-medium">
          Description
          <Textarea
            rows={2}
            value={description}
            placeholder="The longer text, where the platform has one"
            onChange={(event) => setDescription(event.target.value)}
            onBlur={saveWords}
          />
        </label>

        <div className="flex items-center gap-2 pt-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="More">
                  <DotsThree weight="bold" />
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="min-w-56">
              <DropdownMenuItem onClick={() => onDelete(false)}>
                <X /> Ungroup — keep the files
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(true)}>
                <Trash /> Delete the group and its files
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" className="ml-auto" onClick={() => (saveWords(), onClose())}>
            Done
          </Button>
          <Button disabled={!files.length} onClick={() => (saveWords(), onPublish(current))}>
            <PaperPlaneTilt weight="fill" /> Publish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
