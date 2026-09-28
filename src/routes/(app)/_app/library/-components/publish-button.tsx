import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import { CalendarBlank, CaretDown, Check, PaperPlaneTilt, SpinnerGap } from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { colors, radius } from "../../../../../components/ui/tokens.stylex";

const turn = stylex.keyframes({ to: { transform: "rotate(360deg)" } });

const styles = stylex.create({
  // The when and the button read as one control.
  group: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: "1px",
    display: "flex",
    flexGrow: { default: 1, "@media (min-width: 640px)": 0 },
    height: "2.5rem",
    minWidth: 0,
    overflow: "hidden",
  },
  when: {
    alignItems: "center",
    backgroundColor: { default: colors.card, ":hover": colors.muted },
    borderStyle: "none",
    color: colors.foreground,
    cursor: "pointer",
    display: "flex",
    flexGrow: 1,
    fontSize: "0.8125rem",
    fontWeight: 500,
    gap: "0.5rem",
    minWidth: { default: 0, "@media (min-width: 640px)": "11rem" },
    outline: { default: "none", ":focus-visible": `2px solid ${colors.ring}` },
    outlineOffset: "-2px",
    paddingInline: "0.75rem",
    whiteSpace: "nowrap",
  },
  whenText: { flexGrow: 1, overflow: "hidden", textAlign: "start", textOverflow: "ellipsis" },
  caret: { color: colors.mutedForeground, flexShrink: 0 },
  go: { borderRadius: 0, flexShrink: 0, height: "100%", paddingInline: "1rem" },
  spin: {
    animationDuration: "900ms",
    animationIterationCount: "infinite",
    animationName: turn,
    animationTimingFunction: "linear",
  },
  menu: { gap: "0.25rem", padding: "0.375rem", width: "17rem" },
  option: {
    alignItems: "center",
    backgroundColor: { default: "transparent", ":hover": colors.muted },
    borderRadius: radius.md,
    borderStyle: "none",
    color: colors.foreground,
    cursor: "pointer",
    display: "flex",
    fontSize: "0.8125rem",
    gap: "0.625rem",
    paddingBlock: "0.5rem",
    paddingInline: "0.625rem",
    textAlign: "start",
    width: "100%",
  },
  optionText: { display: "grid", flexGrow: 1, gap: "0.125rem" },
  optionHint: { color: colors.mutedForeground, fontSize: "0.6875rem" },
  tick: { color: colors.foreground, flexShrink: 0 },
  date: { marginInline: "0.25rem", width: "calc(100% - 0.5rem)" },
  zone: {
    color: colors.mutedForeground,
    fontSize: "0.6875rem",
    margin: "0.25rem 0.625rem 0.25rem",
  },
});

const format = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * When and go, as one compact control: on the left the moment ("Now", or a date that
 * opens the picker), on the right the button that publishes or schedules.
 */
export function PublishButton({
  when,
  at,
  onWhen,
  onAt,
  count,
  disabled,
  busy,
  onSubmit,
}: {
  when: "now" | "later";
  at: string;
  onWhen: (when: "now" | "later") => void;
  onAt: (at: string) => void;
  /** Channels it will go to. */
  count: number;
  disabled: boolean;
  busy: boolean;
  onSubmit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const time = new Date(at);
  const label =
    when === "now" ? "Now" : Number.isNaN(time.getTime()) ? "Pick a time" : format.format(time);
  const Icon = when === "now" ? PaperPlaneTilt : CalendarBlank;

  return (
    <div {...stylex.props(styles.group)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button type="button" aria-label={`When: ${label}`} {...stylex.props(styles.when)}>
              <Icon size={16} />
              <span {...stylex.props(styles.whenText)}>{label}</span>
              <CaretDown size={13} {...stylex.props(styles.caret)} />
            </button>
          }
        />
        <PopoverContent side="top" align="start" style={styles.menu}>
          <button
            type="button"
            onClick={() => {
              onWhen("now");
              setOpen(false);
            }}
            {...stylex.props(styles.option)}
          >
            <PaperPlaneTilt size={16} />
            <span {...stylex.props(styles.optionText)}>
              Now
              <span {...stylex.props(styles.optionHint)}>
                Live once each platform has processed it
              </span>
            </span>
            {when === "now" && <Check size={14} weight="bold" {...stylex.props(styles.tick)} />}
          </button>
          <button type="button" onClick={() => onWhen("later")} {...stylex.props(styles.option)}>
            <CalendarBlank size={16} />
            <span {...stylex.props(styles.optionText)}>
              Schedule
              <span {...stylex.props(styles.optionHint)}>Goes live at the time you pick</span>
            </span>
            {when === "later" && <Check size={14} weight="bold" {...stylex.props(styles.tick)} />}
          </button>
          {when === "later" && (
            <>
              <Input
                type="datetime-local"
                aria-label="Goes live"
                value={at}
                onChange={(event) => onAt(event.target.value)}
                style={styles.date}
              />
              <p {...stylex.props(styles.zone)}>
                {Intl.DateTimeFormat().resolvedOptions().timeZone} — each platform gets it early
                enough to be ready on time.
              </p>
            </>
          )}
        </PopoverContent>
      </Popover>
      <Button onClick={onSubmit} disabled={disabled} style={styles.go}>
        {busy && <SpinnerGap {...stylex.props(styles.spin)} />}
        {when === "now" ? "Publish" : "Schedule"}
        {count > 1 ? ` · ${count}` : ""}
      </Button>
    </div>
  );
}
