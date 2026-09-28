import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { Field } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Select } from "#/components/ui/select";
import { Switch } from "#/components/ui/switch";
import { Textarea } from "#/components/ui/textarea";
import type { JsonValue } from "#/database/schema";
import type { Field as FieldSpec } from "#/modules/social/fields";
import { colors, radius } from "../../../../../components/ui/tokens.stylex";

type Values = Record<string, JsonValue>;

const styles = stylex.create({
  grid: {
    display: "grid",
    gap: "0.875rem",
    gridTemplateColumns: { default: "1fr", "@media (min-width: 640px)": "1fr 1fr" },
  },
  wide: { gridColumn: { default: null, "@media (min-width: 640px)": "span 2" } },
  toggle: {
    alignItems: "center",
    backgroundColor: `color-mix(in oklab, ${colors.muted} 60%, transparent)`,
    borderRadius: radius.xl,
    cursor: "pointer",
    display: "flex",
    gap: "0.75rem",
    justifyContent: "space-between",
    paddingBlock: "0.625rem",
    paddingInline: "0.75rem",
  },
  toggleText: { display: "grid", gap: "0.125rem" },
  toggleLabel: { fontSize: "0.8125rem", fontWeight: 500 },
  hint: { color: colors.mutedForeground, fontSize: "0.6875rem", lineHeight: 1.45 },
  none: { color: colors.mutedForeground, fontSize: "0.75rem", margin: 0 },
});

/** A list typed as words separated by commas; kept as typed until the field is left. */
function TagsInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState(value.join(", "));
  return (
    <Input
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
  fields: FieldSpec[];
  values: Values;
  /** The shared caption, shown where the platform's own caption is empty. */
  caption: string;
  onChange: (key: string, value: JsonValue | undefined) => void;
}) {
  if (!fields.length)
    return <p {...stylex.props(styles.none)}>Nothing more to set for this platform.</p>;
  return (
    <div {...stylex.props(styles.grid)}>
      {fields.map((field) => {
        const value = values[field.key];
        const text = typeof value === "string" ? value : "";
        const hint = field.caption ? undefined : field.hint;

        if (field.type === "boolean")
          return (
            <label key={field.key} {...stylex.props(styles.toggle)}>
              <span {...stylex.props(styles.toggleText)}>
                <span {...stylex.props(styles.toggleLabel)}>{field.label}</span>
                {hint && <span {...stylex.props(styles.hint)}>{hint}</span>}
              </span>
              <Switch
                checked={value === true}
                onCheckedChange={(checked) => onChange(field.key, checked ? true : undefined)}
              />
            </label>
          );

        const wide = field.type === "textarea" || field.type === "tags";
        return (
          <Field
            key={field.key}
            label={field.label}
            hint={hint}
            length={field.maxLength ? text.length : undefined}
            maxLength={field.maxLength}
            style={wide && styles.wide}
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
              <TagsInput
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
    </div>
  );
}
