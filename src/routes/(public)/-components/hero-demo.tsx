import * as stylex from "@stylexjs/stylex";
import { CheckCircle, Robot } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { colors } from "../../../components/ui/tokens.stylex";
import { Bubble, BubbleContent } from "../../../components/ui/bubble";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "../../../components/ui/message";

type Step =
  | { type: "agent"; text: string }
  | { type: "tool"; name: string; args: string; result: string };

type Example = { prompt: string; steps: Step[] };

// Illustrative MCP exchanges, kept short; tool names and input fields match mixetape's tools.
const examples: Example[] = [
  {
    prompt: "Are my channels connected? What's scheduled for tomorrow?",
    steps: [
      { type: "agent", text: "I'll check your channels and tomorrow's queue." },
      {
        type: "tool",
        name: "list_accounts",
        args: "{}",
        result: "YouTube, Facebook, Instagram · connected",
      },
      {
        type: "tool",
        name: "list_posts",
        args: '{ status: ["scheduled"], from: "2026-10-09", to: "2026-10-10" }',
        result: "2 posts · 17:30 YouTube · 18:00 Instagram",
      },
      {
        type: "agent",
        text: "All 3 channels are connected. Two posts go out tomorrow, at 17:30 and 18:00.",
      },
    ],
  },
  {
    prompt: "Schedule the vertical cut on YouTube, Facebook and Instagram, Friday 17:30.",
    steps: [
      { type: "agent", text: "Same cut, each channel's format, one time." },
      {
        type: "tool",
        name: "publish_files",
        args: '{ fileIds: ["file_30s"], accountIds: ["yt_01", "fb_01", "ig_01"], scheduledAt: "2026-10-16T17:30+07:00" }',
        result: "3 posts · scheduled Friday 17:30",
      },
      { type: "agent", text: "Done. All three go out Friday at 17:30." },
    ],
  },
  {
    prompt: "Where did viewers leave the last Short?",
    steps: [
      {
        type: "tool",
        name: "get_post_analytics",
        args: '{ id: "post_091" }',
        result: "0:03 · 38% of viewers still watching",
      },
      {
        type: "agent",
        text: "Most left in the first three seconds. Open with the payoff next time.",
      },
    ],
  },
];

// How long each step stays before the next: a tool runs, then shows its result.
const TOOL_RUNNING_MS = 800;
const STEP_MS = 1100;
const EXAMPLE_PAUSE_MS = 2600;

const enter = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(5px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const styles = stylex.create({
  // Newest message at the bottom; older ones slide up and out of the clipped top, so the
  // demo needs no scroll container.
  visual: {
    color: colors.foreground,
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    height: { default: "440px", "@media (min-width: 640px)": "500px" },
    justifyContent: "flex-end",
    justifySelf: "center",
    maxWidth: "560px",
    minWidth: 0,
    overflow: "hidden",
    paddingBlockEnd: "1rem",
    width: "100%",
  },
  item: {
    animationDuration: "220ms",
    animationName: enter,
    animationTimingFunction: "ease-out",
    flexShrink: 0,
  },
  tool: {
    borderColor: colors.border,
    borderRadius: "12px",
    borderStyle: "solid",
    borderWidth: "1px",
    fontSize: "0.76rem",
    marginInlineStart: "2.5rem",
    maxWidth: "calc(100% - 2.5rem)",
    overflow: "hidden",
  },
  toolHeader: {
    alignItems: "center",
    display: "flex",
    gap: "0.5rem",
    paddingBlock: "0.45rem",
    paddingInline: "0.7rem",
  },
  toolDot: {
    backgroundColor: colors.primary,
    borderRadius: "50%",
    height: "0.4rem",
    width: "0.4rem",
  },
  toolName: { fontFamily: '"Geist Mono Variable", ui-monospace, monospace', fontWeight: 600 },
  toolSource: { color: colors.mutedForeground, fontSize: "0.65rem", marginInlineStart: "auto" },
  toolArgs: {
    color: colors.mutedForeground,
    fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
    fontSize: "0.66rem",
    lineHeight: 1.5,
    margin: 0,
    overflowWrap: "anywhere",
    paddingBlock: "0 0.55rem",
    paddingInline: "0.7rem",
    whiteSpace: "pre-wrap",
  },
  toolResult: {
    alignItems: "center",
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: "1px",
    color: colors.foreground,
    display: "flex",
    gap: "0.4rem",
    minHeight: "2rem",
    paddingBlock: "0.4rem",
    paddingInline: "0.7rem",
  },
  pending: { color: colors.mutedForeground },
  // Readable on both themes; the same green as the connect page's success mark.
  check: { color: "#10b981", flexShrink: 0 },
});

function ToolStep({ step, done }: { step: Extract<Step, { type: "tool" }>; done: boolean }) {
  return (
    <div {...stylex.props(styles.tool)}>
      <div {...stylex.props(styles.toolHeader)}>
        <span {...stylex.props(styles.toolDot)} aria-hidden="true" />
        <span {...stylex.props(styles.toolName)}>{step.name}</span>
        <span {...stylex.props(styles.toolSource)}>mixetape · MCP</span>
      </div>
      <pre {...stylex.props(styles.toolArgs)}>
        <code>{step.args}</code>
      </pre>
      <div {...stylex.props(styles.toolResult, !done && styles.pending)}>
        {done ? (
          <>
            <CheckCircle
              size={14}
              weight="fill"
              aria-hidden="true"
              {...stylex.props(styles.check)}
            />
            <span>{step.result}</span>
          </>
        ) : (
          <span className="shimmer" role="status">
            Running…
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The hero's demo: an agent working through mixetape's tools, one step at a time. One timer
 * drives it, and it stops while off screen, in a hidden tab, or with reduced motion (which
 * shows the first example whole).
 */
export function HeroDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  // Steps shown so far, and whether the last one (a tool) has its result.
  const [shown, setShown] = useState(1);
  const [toolDone, setToolDone] = useState(false);
  const example = examples[exampleIndex];

  useEffect(() => {
    let onScreen = false;
    const update = () => setPlaying(onScreen && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    if (ref.current) observer.observe(ref.current);
    document.addEventListener("visibilitychange", update);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReducedMotion(motion.matches);
    onMotion();
    motion.addEventListener("change", onMotion);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      motion.removeEventListener("change", onMotion);
    };
  }, []);

  useEffect(() => {
    if (!playing || reducedMotion) return;
    const last = example.steps[shown - 1];
    const timer = window.setTimeout(
      () => {
        if (last.type === "tool" && !toolDone) return setToolDone(true);
        setToolDone(false);
        if (shown < example.steps.length) return setShown(shown + 1);
        setExampleIndex((exampleIndex + 1) % examples.length);
        setShown(1);
      },
      last.type === "tool" && !toolDone
        ? TOOL_RUNNING_MS
        : shown < example.steps.length
          ? STEP_MS
          : EXAMPLE_PAUSE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [playing, reducedMotion, example, exampleIndex, shown, toolDone]);

  const steps = reducedMotion ? example.steps : example.steps.slice(0, shown);

  return (
    <div
      ref={ref}
      aria-label="Automatically playing examples of an agent using mixetape tools"
      {...stylex.props(styles.visual)}
    >
      <div key={`${exampleIndex}-prompt`} {...stylex.props(styles.item)}>
        <Message align="end">
          <MessageAvatar className="size-8">U</MessageAvatar>
          <MessageContent>
            <MessageHeader>You</MessageHeader>
            <Bubble>
              <BubbleContent>{example.prompt}</BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>
      </div>
      {steps.map((step, index) => (
        <div key={`${exampleIndex}-${index}`} {...stylex.props(styles.item)}>
          {step.type === "tool" ? (
            <ToolStep step={step} done={reducedMotion || index < shown - 1 || toolDone} />
          ) : (
            <Message>
              <MessageAvatar className="size-8">
                <Robot size={17} weight="bold" />
              </MessageAvatar>
              <MessageContent>
                {index === 0 && <MessageHeader>Agent</MessageHeader>}
                <Bubble variant="secondary">
                  <BubbleContent>{step.text}</BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
          )}
        </div>
      ))}
    </div>
  );
}
