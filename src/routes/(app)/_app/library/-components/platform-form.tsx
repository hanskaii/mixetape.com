import { useState } from "react";
import { Input } from "#/components/ui/input";
import { Switch } from "#/components/ui/switch";
import { Textarea } from "#/components/ui/textarea";
import type { JsonValue } from "#/database/schema";
import type { Field } from "#/modules/social/fields";

type Values = Record<string, JsonValue>;

/**
 * One platform's own fields as a form, built from its schema. Empty means "the default":
 * the shared caption, the platform's own default — nothing is sent for it.
 */
export function PlatformForm({
  fields,
  values,
  caption,
  onChange,
}: {
  fields: Field[];
  values: Values;
  /** The shared caption, shown where the platform's own caption is empty. */
  caption: string;
  onChange: (key: string, value: JsonValue | undefined) => void;
}) {
  if (!fields.length)
    return <p className="text-xs text-muted-foreground">Nothing more to set for this platform.</p>;
  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      {fields.map((field) => {
        const value = values[field.key];
        const id = `field-${field.key}`;
        const wide = field.type === "textarea" || field.type === "tags";
        const label = (
          <span className="flex items-baseline justify-between gap-2 text-[13px] font-medium">
            {field.label}
            {field.maxLength && typeof value === "string" && (
              <span className="font-mono text-[11px] font-normal tabular-nums text-muted-foreground">
                {value.length}/{field.maxLength}
              </span>
            )}
          </span>
        );
        const hint = field.hint && (
          <span className="text-[11px] font-normal leading-snug text-muted-foreground">
            {field.hint}
          </span>
        );

        if (field.type === "boolean")
          return (
            <label
              key={field.key}
              className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2.5"
            >
              <span className="grid gap-0.5">
                <span className="text-[13px] font-medium">{field.label}</span>
                {hint}
              </span>
              <Switch
                checked={value === true}
                onCheckedChange={(checked) => onChange(field.key, checked ? true : undefined)}
              />
            </label>
          );

        return (
          <label
            key={field.key}
            htmlFor={id}
            className={`grid content-start gap-1.5 ${wide ? "sm:col-span-2" : ""}`}
          >
            {label}
            {field.type === "select" ? (
              <select
                id={id}
                value={typeof value === "string" ? value : ""}
                onChange={(event) => onChange(field.key, event.target.value || undefined)}
                className="h-9 rounded-xl border border-border bg-card px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Default</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <Textarea
                id={id}
                rows={field.caption ? 4 : 2}
                maxLength={field.maxLength}
                placeholder={field.caption ? caption || "Same as the caption" : undefined}
                value={typeof value === "string" ? value : ""}
                onChange={(event) => onChange(field.key, event.target.value || undefined)}
              />
            ) : field.type === "tags" ? (
              <TagsInput
                id={id}
                value={Array.isArray(value) ? value.filter((tag) => typeof tag === "string") : []}
                onChange={(tags) => onChange(field.key, tags.length ? tags : undefined)}
              />
            ) : (
              <Input
                id={id}
                type={field.type === "number" ? "number" : "text"}
                maxLength={field.maxLength}
                value={typeof value === "number" || typeof value === "string" ? String(value) : ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (!raw) onChange(field.key, undefined);
                  else onChange(field.key, field.type === "number" ? Number(raw) : raw);
                }}
              />
            )}
            {!field.caption && hint}
          </label>
        );
      })}
    </div>
  );
}

/** A list typed as words separated by commas; kept as typed until the field is left. */
function TagsInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [text, setText] = useState(value.join(", "));
  return (
    <Input
      id={id}
      placeholder="Separated by commas"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={() =>
        onChange(
          text
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        )
      }
    />
  );
}
