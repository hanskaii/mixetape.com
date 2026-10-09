import type { JsonValue } from "#/database/schema";
import { Field } from "#/components/ui/field";
import { Select } from "#/components/ui/select";
import { Spinner } from "#/components/ui/spinner";
import { Switch } from "#/components/ui/switch";
import { Textarea } from "#/components/ui/textarea";
import { cn } from "#/components/ui/utils";
import {
  BRANDED_PRIVATE,
  NO_DISCLOSURE,
  PRIVACY_LABELS,
  sharedPrivacy,
  tiktokConsent,
  type TikTokCreators,
  type Values,
} from "../-lib/tiktok-rules";

export { tiktokProblem } from "../-lib/tiktok-rules";

/**
 * TikTok's own post form, as TikTok's Direct Post rules (content-sharing guidelines) ask:
 * the account the post goes to, a privacy choice with nothing chosen for the person, the
 * interactions off until they are turned on (and greyed out where the creator turned them
 * off), the commercial content disclosure, and the AI label. The consent line sits by the
 * publish button (tiktokConsent), and tiktokProblem keeps publishing shut until the form
 * is complete.
 */

const LINKS: Record<string, string> = {
  "Branded Content Policy": "https://www.tiktok.com/legal/page/global/bc-policy/en",
  "Music Usage Confirmation":
    "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en",
};

/** The consent line with TikTok's documents linked. */
export function TikTokConsent({ values }: { values: Values }) {
  const text = tiktokConsent(values);
  const parts = text.split(/(Branded Content Policy|Music Usage Confirmation)/);
  return (
    <p className="text-xs text-muted-foreground">
      {parts.map((part, index) =>
        LINKS[part] ? (
          <a
            key={index}
            href={LINKS[part]}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}

function Check({
  label,
  hint,
  checked,
  disabled,
  title,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  title?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      title={title}
      className={cn(
        "flex items-start gap-2.5 py-2",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-foreground"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="grid gap-0.5">
        <span className="text-[13px] font-medium text-foreground">{label}</span>
        {hint && <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export function TikTokForm({
  creators,
  loading,
  failed,
  values,
  caption,
  disclose,
  onDisclose,
  onChange,
}: {
  creators: TikTokCreators | undefined;
  loading: boolean;
  failed: string | null;
  values: Values;
  /** The shared caption, used where TikTok's own is empty. */
  caption: string;
  disclose: boolean;
  onDisclose: (on: boolean) => void;
  onChange: (key: string, value: JsonValue | undefined) => void;
}) {
  if (failed) return <p className="text-xs text-destructive">{failed}</p>;
  if (loading || !creators)
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner /> Checking your TikTok account…
      </p>
    );

  const privacyOptions = sharedPrivacy(creators);
  const any = (key: "commentDisabled" | "duetDisabled" | "stitchDisabled") =>
    creators.some((creator) => creator[key]);
  const privacy = typeof values.privacyLevel === "string" ? values.privacyLevel : "";
  const title = typeof values.title === "string" ? values.title : "";
  const brandContent = values.brandContent === true;
  const brandOrganic = values.brandOrganic === true;
  const label = brandContent
    ? "Your video will be labeled as 'Paid partnership'."
    : brandOrganic
      ? "Your video will be labeled as 'Promotional content'."
      : null;
  // An interaction is on when it is not disabled; off until the person turns it on.
  const interaction = (key: string, name: string, off: boolean) => (
    <Check
      key={key}
      label={`Allow ${name}`}
      checked={!off && values[key] === false}
      disabled={off}
      title={off ? `${name} is turned off in this account's TikTok settings` : undefined}
      onChange={(checked) => onChange(key, !checked)}
    />
  );

  return (
    <div className="grid gap-4">
      {/* Who it goes to. */}
      <div className="grid gap-1.5">
        <span className="text-[13px] font-medium text-foreground">Posting to</span>
        <ul className="flex flex-wrap gap-2">
          {creators.map((creator) => (
            <li
              key={creator.accountId}
              className="flex items-center gap-2 rounded-full border border-border py-1 pr-3 pl-1"
            >
              {creator.avatarUrl ? (
                <img src={creator.avatarUrl} alt="" className="size-6 rounded-full object-cover" />
              ) : (
                <span className="size-6 rounded-full bg-muted" />
              )}
              <span className="text-[13px] font-medium text-foreground">{creator.nickname}</span>
              {creator.username && (
                <span className="text-xs text-muted-foreground">@{creator.username}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <Field
        label="Caption"
        hint="Leave empty to use the caption above"
        length={title.length}
        maxLength={2200}
      >
        <Textarea
          rows={4}
          maxLength={2200}
          placeholder={caption || "Same as the caption"}
          value={title}
          onChange={(event) => onChange("title", event.target.value || undefined)}
        />
      </Field>

      <Field label="Who can watch this video">
        <Select
          value={privacy}
          onChange={(event) => onChange("privacyLevel", event.target.value || undefined)}
        >
          <option value="" disabled>
            Choose who can watch
          </option>
          {privacyOptions.map((level) => (
            <option
              key={level}
              value={level}
              disabled={level === "SELF_ONLY" && brandContent}
              title={level === "SELF_ONLY" && brandContent ? BRANDED_PRIVATE : undefined}
            >
              {PRIVACY_LABELS[level] ?? level}
              {level === "SELF_ONLY" && brandContent ? " (not for branded content)" : ""}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-0.5">
        <span className="text-[13px] font-medium text-foreground">Allow users to</span>
        <div className="flex flex-wrap gap-x-5">
          {interaction("disableComment", "comment", any("commentDisabled"))}
          {interaction("disableDuet", "Duet", any("duetDisabled"))}
          {interaction("disableStitch", "Stitch", any("stitchDisabled"))}
        </div>
      </div>

      <div className="grid gap-2 rounded-xl border border-border p-3">
        <label className="flex cursor-pointer items-start justify-between gap-3">
          <span className="grid gap-0.5">
            <span className="text-[13px] font-medium text-foreground">Disclose video content</span>
            <span className="text-[11px] leading-snug text-muted-foreground">
              Turn on to disclose that this video promotes goods or services in exchange for
              something of value. Your video could promote yourself, a third party, or both.
            </span>
          </span>
          <Switch checked={disclose} onCheckedChange={onDisclose} />
        </label>
        {disclose && (
          <div className="grid border-t border-border pt-1">
            <Check
              label="Your brand"
              hint="You are promoting yourself or your own business. This video will be classified as Brand Organic."
              checked={brandOrganic}
              onChange={(checked) => onChange("brandOrganic", checked || undefined)}
            />
            <Check
              label="Branded content"
              hint="You are promoting another brand or a third party. This video will be classified as Branded Content."
              checked={brandContent}
              disabled={privacy === "SELF_ONLY"}
              title={privacy === "SELF_ONLY" ? BRANDED_PRIVATE : undefined}
              onChange={(checked) => onChange("brandContent", checked || undefined)}
            />
            {label ? (
              <p className="pt-1 text-xs font-medium text-foreground">{label}</p>
            ) : (
              <p className="pt-1 text-xs text-destructive">{NO_DISCLOSURE}</p>
            )}
          </div>
        )}
      </div>

      <label className="flex cursor-pointer items-start justify-between gap-3">
        <span className="grid gap-0.5">
          <span className="text-[13px] font-medium text-foreground">Made with AI</span>
          <span className="text-[11px] text-muted-foreground">Label it as AI-generated</span>
        </span>
        <Switch
          checked={values.isAigc === true}
          onCheckedChange={(checked) => onChange("isAigc", checked ? true : undefined)}
        />
      </label>
    </div>
  );
}
