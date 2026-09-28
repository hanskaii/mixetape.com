import { useState } from "react";
import { ArrowDown, ArrowUp, SpinnerGap, X } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { Modal, ModalDescription, ModalHeader, ModalTitle } from "#/components/ui/modal";
import type { JsonValue } from "#/database/schema";
import type { ItemView } from "#/modules/library/library.service";
import { createContent, updateContent } from "#/modules/library/library.fn";
import type { FileView } from "#/modules/storage/files.service";
import { FileThumb } from "./file-thumb";
import { fileSummary } from "../-lib/format";

type Metadata = Record<string, JsonValue>;

const field = "grid gap-1.5 text-[13px] font-medium";
const hint = "text-xs font-normal text-muted-foreground";

/**
 * Writes or edits a content item: its text, its files in order, and each platform's
 * overrides. Opens with files already chosen when made from a selection.
 */
export function ContentModal({
  item,
  files: initialFiles = [],
  onClose,
  onSaved,
}: {
  item?: ItemView;
  files?: FileView[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const metadata: Metadata = item?.metadata ?? {};
  const [title, setTitle] = useState(item?.title ?? "");
  const [caption, setCaption] = useState(item?.caption ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [tags, setTags] = useState(
    Array.isArray(metadata.tags)
      ? metadata.tags.filter((tag) => typeof tag === "string").join(", ")
      : "",
  );
  const [platforms, setPlatforms] = useState(
    metadata.platforms ? JSON.stringify(metadata.platforms, null, 2) : "",
  );
  const [files, setFiles] = useState<FileView[]>(item?.files ?? initialFiles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const move = (index: number, by: number) =>
    setFiles((current) => {
      const next = [...current];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    let overrides: JsonValue | undefined;
    try {
      overrides = platforms.trim() ? (JSON.parse(platforms) as JsonValue) : undefined;
    } catch {
      setError('Platform overrides must be JSON, e.g. { "youtube": { "title": "…" } }');
      return;
    }
    // Keys this form does not edit (an agent's thumbnailUrl, firstComment…) are kept.
    const { tags: _tags, platforms: _platforms, ...rest } = metadata;
    const tagList = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const data = {
      title,
      caption,
      description,
      fileIds: files.map((file) => file.id),
      metadata: {
        ...rest,
        ...(tagList.length && { tags: tagList }),
        ...(overrides !== undefined && { platforms: overrides }),
      },
    };
    setBusy(true);
    try {
      if (item) await updateContent({ data: { id: item.id, ...data } });
      else await createContent({ data });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the content");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} className="max-w-xl">
      <form onSubmit={save} className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto">
        <ModalHeader>
          <ModalTitle>{item ? "Edit content" : "New content"}</ModalTitle>
          <ModalDescription>
            The files and words for a post, ready for an agent or you to schedule.
          </ModalDescription>
        </ModalHeader>

        <label className={field}>
          Title
          <Input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        </label>
        <label className={field}>
          Caption
          <Textarea rows={3} value={caption} onChange={(event) => setCaption(event.target.value)} />
        </label>
        <label className={field}>
          Description
          <Textarea
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className={field}>
          Tags
          <Input
            placeholder="history, rome, shorts"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
          <span className={hint}>Separated by commas.</span>
        </label>

        <div className={field}>
          Files
          {files.length ? (
            <ul className="divide-y divide-border rounded-xl ring-1 ring-border">
              {files.map((file, index) => (
                <li key={file.id} className="flex items-center gap-2.5 px-2.5 py-2">
                  <FileThumb file={file} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{file.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {fileSummary(file)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Move ${file.name} up`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Move ${file.name} down`}
                    disabled={index === files.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Take ${file.name} out`}
                    onClick={() => setFiles(files.filter((other) => other.id !== file.id))}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <span className={hint}>
              No file. Select files in the Files tab, then press New content.
            </span>
          )}
        </div>

        <label className={field}>
          Platform overrides
          <Textarea
            rows={4}
            spellCheck={false}
            className="font-mono text-xs"
            placeholder={'{\n  "youtube": { "title": "A longer title for YouTube" }\n}'}
            value={platforms}
            onChange={(event) => setPlatforms(event.target.value)}
          />
          <span className={hint}>
            JSON, per platform. Anything not overridden comes from the fields above.
          </span>
        </label>

        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy && <SpinnerGap className="animate-spin" />} {item ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
