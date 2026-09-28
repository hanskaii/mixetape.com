import { useRef, useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { DotsThree, PaperPlaneTilt, Robot, Trash, UploadSimple, X } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Field } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Modal, ModalDescription, ModalHeader, ModalTitle } from "#/components/ui/modal";
import { Textarea } from "#/components/ui/textarea";
import type { GroupView } from "#/modules/library/groups.service";
import { saveGroup, ungroupFiles } from "#/modules/library/library.fn";
import { colors, radius } from "../../../../../components/ui/tokens.stylex";
import { selectionSummary } from "../-lib/format";
import { FileThumb } from "./file-thumb";

const styles = stylex.create({
  modal: { maxWidth: "36rem" },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    maxHeight: "84vh",
    overflowY: "auto",
  },
  keep: { flexShrink: 0 },
  title: { alignItems: "center", display: "flex", gap: "0.5rem" },
  agent: { color: colors.mutedForeground },
  strip: {
    display: "flex",
    flexShrink: 0,
    gap: "0.5rem",
    marginInline: "-0.25rem",
    overflowX: "auto",
    paddingBlock: "0.5rem 0.25rem",
    paddingInline: "0.25rem",
  },
  thumb: {
    "--reveal": { default: "0", ":hover": "1", ":focus-within": "1" },
    cursor: { default: "grab", ":active": "grabbing" },
    flexShrink: 0,
    position: "relative",
  },
  dragged: { opacity: 0.4 },
  number: {
    backgroundColor: "rgb(0 0 0 / 0.6)",
    borderRadius: radius.sm,
    bottom: "0.25rem",
    color: "white",
    fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
    fontSize: "0.625rem",
    left: "0.25rem",
    paddingInline: "0.25rem",
    position: "absolute",
  },
  remove: {
    alignItems: "center",
    backgroundColor: colors.foreground,
    borderRadius: radius.full,
    borderStyle: "none",
    color: colors.background,
    cursor: "pointer",
    display: "flex",
    height: "1.25rem",
    justifyContent: "center",
    opacity: "var(--reveal)",
    padding: 0,
    position: "absolute",
    right: "-0.375rem",
    top: "-0.375rem",
    transitionDuration: "150ms",
    transitionProperty: "opacity",
    width: "1.25rem",
  },
  add: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: { default: colors.border, ":hover": colors.mutedForeground },
    borderRadius: radius.lg,
    borderStyle: "dashed",
    borderWidth: "2px",
    color: { default: colors.mutedForeground, ":hover": colors.foreground },
    cursor: "pointer",
    display: "flex",
    flexShrink: 0,
    height: "3.5rem",
    justifyContent: "center",
    width: "3.5rem",
  },
  hidden: { display: "none" },
  menu: { minWidth: "14rem" },
  footer: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    gap: "0.5rem",
    paddingTop: "0.25rem",
  },
  push: { marginInlineStart: "auto" },
});

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

  const close = () => {
    saveWords();
    onClose();
  };

  return (
    <Modal open onOpenChange={(open) => !open && close()} style={styles.modal}>
      <div {...stylex.props(styles.body)}>
        <div {...stylex.props(styles.keep)}>
          <ModalHeader>
            <ModalTitle>
              <span {...stylex.props(styles.title)}>
                {group.createdBy === "agent" && (
                  <Robot size={16} aria-label="Made by an agent" {...stylex.props(styles.agent)} />
                )}
                {title || "Untitled group"}
              </span>
            </ModalTitle>
            <ModalDescription>
              {files.length ? selectionSummary(files) : "Empty"} · drag to reorder
              {saving && " · saving…"}
            </ModalDescription>
          </ModalHeader>
        </div>

        <div
          {...stylex.props(styles.strip)}
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
                if (dragged !== null) event.preventDefault();
              }}
              onDrop={(event) => {
                if (dragged === null) return;
                event.preventDefault();
                move(dragged, index);
                setDragged(null);
              }}
              onDragEnd={() => setDragged(null)}
              {...stylex.props(styles.thumb, dragged === index && styles.dragged)}
            >
              <FileThumb file={file} size="md" />
              <span {...stylex.props(styles.number)}>{index + 1}</span>
              <button
                type="button"
                aria-label={`Take ${file.name} out of the group`}
                onClick={() => void takeOut(file.id)}
                {...stylex.props(styles.remove)}
              >
                <X size={11} weight="bold" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => input.current?.click()}
            aria-label="Upload files into this group"
            {...stylex.props(styles.add)}
          >
            <UploadSimple size={18} />
          </button>
          <input
            ref={input}
            type="file"
            multiple
            accept="video/*,image/*"
            {...stylex.props(styles.hidden)}
            onChange={(event) => {
              if (event.target.files?.length) onUpload([...event.target.files]);
              event.target.value = "";
            }}
          />
        </div>

        <Field label="Title" style={styles.keep}>
          <Input
            value={title}
            placeholder="Untitled group"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={saveWords}
          />
        </Field>
        <Field label="Caption" style={styles.keep}>
          <Textarea
            rows={3}
            value={caption}
            placeholder="What the post says"
            onChange={(event) => setCaption(event.target.value)}
            onBlur={saveWords}
          />
        </Field>
        <Field label="Description" style={styles.keep}>
          <Textarea
            rows={2}
            value={description}
            placeholder="The longer text, where the platform has one"
            onChange={(event) => setDescription(event.target.value)}
            onBlur={saveWords}
          />
        </Field>

        <div {...stylex.props(styles.footer)}>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="More">
                  <DotsThree weight="bold" />
                </Button>
              }
            />
            <DropdownMenuContent align="start" style={styles.menu}>
              <DropdownMenuItem onClick={() => onDelete(false)}>
                <X /> Ungroup — keep the files
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(true)}>
                <Trash /> Delete the group and its files
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" style={styles.push} onClick={close}>
            Done
          </Button>
          <Button
            disabled={!files.length}
            onClick={() => {
              saveWords();
              onPublish({ ...group, files, title, caption, description });
            }}
          >
            <PaperPlaneTilt weight="fill" /> Publish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
