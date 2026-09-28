import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { ImageSquare, X } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Field } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { Segmented } from "#/components/ui/segmented";
import { Select } from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import { Textarea } from "#/components/ui/textarea";
import type { JsonValue } from "#/database/schema";
import type { Field as FieldSpec } from "#/modules/social/fields";
import type { FileView } from "#/modules/storage/files.service";
import { colors, radius } from "../../../../../components/ui/tokens.stylex";
import { coverUrl } from "../-lib/thumbs";
import { MediaImage } from "./media-image";

type Values = Record<string, JsonValue>;

const styles = stylex.create({
  form: { display: "grid", gap: "0.875rem" },
  label: { color: colors.foreground, fontSize: "0.8125rem", fontWeight: 500 },
  block: { display: "grid", gap: "0.375rem" },
  hint: { color: colors.mutedForeground, fontSize: "0.6875rem", lineHeight: 1.45, margin: 0 },
  // The switches, together in one list.
  switches: {
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderStyle: "solid",
    borderWidth: "1px",
    display: "grid",
    overflow: "hidden",
  },
  switchRow: {
    alignItems: "center",
    borderTopColor: { default: colors.border, ":first-child": "transparent" },
    borderTopStyle: "solid",
    borderTopWidth: "1px",
    cursor: "pointer",
    display: "flex",
    gap: "0.75rem",
    justifyContent: "space-between",
    paddingBlock: "0.625rem",
    paddingInline: "0.75rem",
  },
  switchText: { display: "grid", gap: "0.125rem" },
  // Tags as chips, typed into one field.
  chips: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: { default: colors.input, ":focus-within": colors.ring },
    borderRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: "1px",
    cursor: "text",
    display: "flex",
    flexWrap: "wrap",
    gap: "0.375rem",
    minHeight: "2.25rem",
    paddingBlock: "0.3125rem",
    paddingInline: "0.5rem",
  },
  chip: {
    alignItems: "center",
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    display: "inline-flex",
    fontSize: "0.75rem",
    gap: "0.25rem",
    paddingBlock: "0.125rem",
    paddingInline: "0.5rem 0.25rem",
  },
  chipX: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderStyle: "none",
    color: colors.mutedForeground,
    cursor: "pointer",
    display: "flex",
    padding: "0.125rem",
  },
  chipInput: {
    backgroundColor: "transparent",
    borderStyle: "none",
    color: colors.foreground,
    flexGrow: 1,
    fontSize: "0.8125rem",
    minWidth: "6rem",
    outline: "none",
  },
  // The cover: the chosen image, or a button to choose one.
  cover: { alignItems: "center", display: "flex", gap: "0.625rem" },
  coverThumb: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    height: "3.5rem",
    objectFit: "cover",
    outline: `1px solid ${colors.border}`,
    outlineOffset: "-1px",
    width: "5rem",
  },
  coverFrame: { display: "block", overflow: "hidden" },
  picker: { gap: "0.5rem", width: "20rem" },
  grid: {
    display: "grid",
    gap: "0.375rem",
    gridTemplateColumns: "repeat(4, 1fr)",
    maxHeight: "16rem",
    overflowY: "auto",
  },
  pick: {
    aspectRatio: "1",
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    borderStyle: "none",
    cursor: "pointer",
    outline: { default: "none", ":focus-visible": `2px solid ${colors.ring}` },
    overflow: "hidden",
    padding: 0,
  },
  picked: { boxShadow: `0 0 0 2px ${colors.primary}` },
  empty: { color: colors.mutedForeground, fontSize: "0.75rem", margin: 0 },
});

function Tags({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const words = raw
      .split(",")
      .map((word) => word.trim())
      .filter((word) => word && !value.includes(word));
    if (words.length) onChange([...value, ...words]);
    setText("");
  };
  return (
    <div {...stylex.props(styles.chips)}>
      {value.map((tag) => (
        <span key={tag} {...stylex.props(styles.chip)}>
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((other) => other !== tag))}
            {...stylex.props(styles.chipX)}
          >
            <X size={11} weight="bold" />
          </button>
        </span>
      ))}
      <input
        value={text}
        placeholder={value.length ? "" : "Type a word, then Enter"}
        aria-label="Add a tag"
        onChange={(event) => {
          if (event.target.value.includes(",")) add(event.target.value);
          else setText(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add(text);
          } else if (event.key === "Backspace" && !text && value.length)
            onChange(value.slice(0, -1));
        }}
        onBlur={() => add(text)}
        {...stylex.props(styles.chipInput)}
      />
    </div>
  );
}

/** A cover chosen from the images at hand: the ones being published, then the library's. */
function Cover({
  value,
  images,
  onChange,
}: {
  value: string | undefined;
  images: FileView[];
  onChange: (url: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const chosen = images.find((image) => coverUrl(image.publicUrl) === value);
  return (
    <div {...stylex.props(styles.cover)}>
      {value &&
        (chosen ? (
          <span {...stylex.props(styles.coverThumb, styles.coverFrame)}>
            <MediaImage file={chosen} width={160} />
          </span>
        ) : (
          <img src={value} alt="" {...stylex.props(styles.coverThumb)} />
        ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button type="button" size="sm" variant="outline">
              <ImageSquare /> {value ? "Change" : "Choose an image"}
            </Button>
          }
        />
        <PopoverContent side="top" align="start" style={styles.picker}>
          {images.length ? (
            <div {...stylex.props(styles.grid)}>
              {images.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  aria-label={image.name}
                  onClick={() => {
                    onChange(coverUrl(image.publicUrl));
                    setOpen(false);
                  }}
                  {...stylex.props(styles.pick, chosen?.id === image.id && styles.picked)}
                >
                  <MediaImage file={image} width={160} />
                </button>
              ))}
            </div>
          ) : (
            <p {...stylex.props(styles.empty)}>
              No image yet — upload one to your library, then choose it here.
            </p>
          )}
        </PopoverContent>
      </Popover>
      {value && (
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange(undefined)}>
          Remove
        </Button>
      )}
    </div>
  );
}

/**
 * One platform's own settings as a form built from its schema: the caption, the few
 * choices, a cover from the library, the switches together at the end. Empty means "the
 * platform's default" — nothing is sent for it.
 */
export function PlatformForm({
  fields,
  values,
  caption,
  images,
  onChange,
}: {
  fields: FieldSpec[];
  values: Values;
  /** The shared caption, shown where the platform's own caption is empty. */
  caption: string;
  /** Images a cover can be chosen from. */
  images: FileView[];
  onChange: (key: string, value: JsonValue | undefined) => void;
}) {
  const switches = fields.filter((field) => field.type === "switch");
  const rest = fields.filter((field) => field.type !== "switch");
  if (!fields.length)
    return <p {...stylex.props(styles.empty)}>Nothing more to set for this platform.</p>;

  return (
    <div {...stylex.props(styles.form)}>
      {rest.map((field) => {
        const value = values[field.key];
        const text = typeof value === "string" ? value : "";

        if (field.type === "choice")
          return (
            <div key={field.key} {...stylex.props(styles.block)}>
              <span {...stylex.props(styles.label)}>{field.label}</span>
              <Segmented
                label={field.label}
                value={text}
                // Choosing the chosen option again goes back to the platform's default.
                onChange={(next) => onChange(field.key, next === text ? undefined : next)}
                options={field.options ?? []}
              />
              {field.hint && <p {...stylex.props(styles.hint)}>{field.hint}</p>}
            </div>
          );

        if (field.type === "image")
          return (
            <div key={field.key} {...stylex.props(styles.block)}>
              <span {...stylex.props(styles.label)}>{field.label}</span>
              <Cover
                value={text || undefined}
                images={images}
                onChange={(url) => onChange(field.key, url)}
              />
            </div>
          );

        return (
          <Field
            key={field.key}
            label={field.label}
            hint={field.hint}
            length={field.maxLength ? text.length : undefined}
            maxLength={field.maxLength}
          >
            {field.type === "select" ? (
              <Select
                value={text}
                onChange={(event) => onChange(field.key, event.target.value || undefined)}
              >
                <option value="">Default</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            ) : field.type === "textarea" ? (
              <Textarea
                rows={field.caption ? 4 : 2}
                maxLength={field.maxLength}
                placeholder={field.caption ? caption || "Same as the caption" : undefined}
                value={text}
                onChange={(event) => onChange(field.key, event.target.value || undefined)}
              />
            ) : field.type === "tags" ? (
              <Tags
                value={Array.isArray(value) ? value.filter((tag) => typeof tag === "string") : []}
                onChange={(tags) => onChange(field.key, tags.length ? tags : undefined)}
              />
            ) : (
              <Input
                type={field.type === "number" ? "number" : "text"}
                maxLength={field.maxLength}
                value={typeof value === "number" ? String(value) : text}
                onChange={(event) => {
                  const raw = event.target.value;
                  onChange(
                    field.key,
                    !raw ? undefined : field.type === "number" ? Number(raw) : raw,
                  );
                }}
              />
            )}
          </Field>
        );
      })}

      {switches.length > 0 && (
        <div {...stylex.props(styles.switches)}>
          {switches.map((field) => (
            <label key={field.key} {...stylex.props(styles.switchRow)}>
              <span {...stylex.props(styles.switchText)}>
                <span {...stylex.props(styles.label)}>{field.label}</span>
                {field.hint && <span {...stylex.props(styles.hint)}>{field.hint}</span>}
              </span>
              <Switch
                checked={values[field.key] === true}
                onCheckedChange={(checked) => onChange(field.key, checked ? true : undefined)}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
