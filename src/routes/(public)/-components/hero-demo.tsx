import * as stylex from "@stylexjs/stylex";
import { CheckCircle, Robot } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { colors } from "../../../components/ui/tokens.stylex";
import { Bubble, BubbleContent } from "../../../components/ui/bubble";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "../../../components/ui/message";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "../../../components/ui/message-scroller";

type Step =
  | { type: "agent"; text: string }
  | { type: "tool"; name: string; args: string; result: string };

type Example = { prompt: string; steps: Step[] };

// These are illustrative MCP exchanges. Tool names and input fields match mixetape's tools.
const examples: Example[] = [
  {
    prompt: "Are my channels connected? What posts are scheduled for tomorrow?",
    steps: [
      { type: "agent", text: "I’ll check your connected channels and tomorrow’s queue." },
      {
        type: "tool",
        name: "list_accounts",
        args: "{}",
        result: "YouTube, Facebook, Instagram · connected",
      },
      {
        type: "tool",
        name: "list_posts",
        args: '{ status: ["scheduled"], from: "2026-09-28", to: "2026-09-29" }',
        result: "2 posts · 17:30 YouTube · 18:00 Instagram",
      },
      {
        type: "agent",
        text: "All 3 channels are connected. Two posts are queued for tomorrow: YouTube at 17:30 and Instagram at 18:00 WIB.",
      },
    ],
  },
  {
    prompt: "Change my YouTube video title to “The 3 A.M. Reset That Worked”.",
    steps: [
      { type: "agent", text: "I’ll find the published video, update its title, and verify it." },
      {
        type: "tool",
        name: "list_posts",
        args: '{ status: ["published"], limit: 10 }',
        result: "post_241 · YouTube · The 3 A.M. Reset",
      },
      {
        type: "tool",
        name: "edit_published_post",
        args: '{ id: "post_241", metadata: { title: "The 3 A.M. Reset That Worked" } }',
        result: "YouTube title updated",
      },
      {
        type: "tool",
        name: "get_post",
        args: '{ id: "post_241" }',
        result: "Published · “The 3 A.M. Reset That Worked”",
      },
      { type: "agent", text: "Done. The new title is live on YouTube." },
    ],
  },
  {
    prompt:
      "Schedule the 30-second vertical cut on YouTube, Facebook Reels, and Instagram for Friday, 17:30 WIB.",
    steps: [
      {
        type: "agent",
        text: "I’ll use the same cut with each channel’s publishing format and schedule them together.",
      },
      {
        type: "tool",
        name: "list_accounts",
        args: "{}",
        result: "yt_01 · fb_01 · ig_01 · connected",
      },
      {
        type: "tool",
        name: "create_post",
        args: '{ accountId: "yt_01", mediaUrl: "r2://cuts/reset-30s.mp4", scheduledAt: "2026-10-02T17:30:00+07:00", metadata: { title: "The 3 A.M. Reset" } }',
        result: "YouTube · scheduled 17:30 WIB",
      },
      {
        type: "tool",
        name: "create_post",
        args: '{ accountId: "fb_01", mediaUrl: "r2://cuts/reset-30s.mp4", scheduledAt: "2026-10-02T17:30:00+07:00", metadata: { format: "reel" } }',
        result: "Facebook Reel · scheduled 17:30 WIB",
      },
      {
        type: "tool",
        name: "create_post",
        args: '{ accountId: "ig_01", mediaUrl: "r2://cuts/reset-30s.mp4", scheduledAt: "2026-10-02T17:30:00+07:00", caption: "A better start to the day.", metadata: { shareToFeed: true } }',
        result: "Instagram Reel · scheduled 17:30 WIB",
      },
      {
        type: "agent",
        text: "All three are scheduled for Friday at 17:30 WIB, with YouTube metadata and Reel settings for Facebook and Instagram.",
      },
    ],
  },
  {
    prompt: "Where did viewers leave the last Short? Use the tighter cut for Friday.",
    steps: [
      { type: "agent", text: "I’ll check retention before scheduling the revised cut." },
      {
        type: "tool",
        name: "get_post_analytics",
        args: '{ id: "post_091" }',
        result: "0:03 · 38% of viewers still watching",
      },
      {
        type: "agent",
        text: "Most viewers left in the first three seconds. I’ll schedule the cut that opens with the payoff.",
      },
      {
        type: "tool",
        name: "create_post",
        args: '{ accountId: "yt_01", mediaUrl: "r2://cuts/reset-hook-first.mp4", scheduledAt: "2026-10-02T17:30:00+07:00", metadata: { title: "The 3 A.M. Reset" } }',
        result: "YouTube · scheduled Friday, 17:30 WIB",
      },
      {
        type: "agent",
        text: "The tighter cut is queued for Friday. mixetape will publish it on time.",
      },
    ],
  },
];

const enter = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(5px)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const styles = stylex.create({
  visual: {
    color: colors.foreground,
    height: { default: "440px", "@media (min-width: 640px)": "500px" },
    justifySelf: "center",
    maxHeight: "500px",
    maxWidth: "560px",
    minWidth: 0,
    overflow: "hidden",
    width: "100%",
  },
  tool: {
    animationName: enter,
    animationDuration: "220ms",
    animationTimingFunction: "ease-out",
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

function StreamingText({
  text,
  playing,
  onComplete,
}: {
  text: string;
  playing: boolean;
  onComplete: () => void;
}) {
  const words = text.match(/\S+\s*/g) ?? [];
  const [count, setCount] = useState(0);
  const completed = useRef(false);

  useEffect(() => {
    if (!playing || count >= words.length) return;
    const timer = window.setTimeout(() => setCount((value) => value + 1), 75);
    return () => window.clearTimeout(timer);
  }, [count, playing, words.length]);

  useEffect(() => {
    if (count < words.length || completed.current) return;
    completed.current = true;
    onComplete();
  }, [count, onComplete, words.length]);

  return <>{words.slice(0, count).join("")}</>;
}

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

export function HeroDemo() {
  const visualRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepDone, setStepDone] = useState(false);
  const example = examples[exampleIndex];
  const active = visible && pageVisible;
  const current = example.steps[stepIndex];

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.15,
    });
    if (visualRef.current) observer.observe(visualRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibilityChange);
    onVisibilityChange();
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!active || reducedMotion) return;
    if (!stepDone && current.type === "tool") {
      const timer = window.setTimeout(() => setStepDone(true), 850);
      return () => window.clearTimeout(timer);
    }
    if (!stepDone) return;
    const isLast = stepIndex === example.steps.length - 1;
    const timer = window.setTimeout(
      () => {
        if (isLast) {
          setExampleIndex((index) => (index + 1) % examples.length);
          setStepIndex(0);
        } else {
          setStepIndex((index) => index + 1);
        }
        setStepDone(false);
      },
      isLast ? 2400 : 500,
    );
    return () => window.clearTimeout(timer);
  }, [active, current.type, example.steps.length, reducedMotion, stepDone, stepIndex]);

  const finishAgent = useCallback(() => setStepDone(true), []);
  const lastVisibleStep = reducedMotion ? example.steps.length - 1 : stepIndex;

  return (
    <div
      ref={visualRef}
      {...stylex.props(styles.visual)}
      aria-label="Automatically playing examples of an agent using mixetape tools"
    >
      <MessageScrollerProvider key={exampleIndex} autoScroll defaultScrollPosition="end">
        <MessageScroller>
          <MessageScrollerViewport aria-label="Agent and mixetape MCP examples">
            <MessageScrollerContent className="gap-4 pb-4">
              <MessageScrollerItem messageId={`${exampleIndex}-request`}>
                <Message align="end">
                  <MessageAvatar className="size-8">U</MessageAvatar>
                  <MessageContent>
                    <MessageHeader>You</MessageHeader>
                    <Bubble>
                      <BubbleContent>{example.prompt}</BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
              {example.steps.slice(0, lastVisibleStep + 1).map((step, index) => (
                <MessageScrollerItem key={index} messageId={`${exampleIndex}-${index}`}>
                  {step.type === "tool" ? (
                    <ToolStep step={step} done={reducedMotion || index < stepIndex || stepDone} />
                  ) : (
                    <Message>
                      <MessageAvatar className="size-8">
                        <Robot size={17} weight="bold" />
                      </MessageAvatar>
                      <MessageContent>
                        {index === 0 && <MessageHeader>Agent</MessageHeader>}
                        <Bubble variant="secondary">
                          <BubbleContent>
                            {reducedMotion || index < stepIndex ? (
                              step.text
                            ) : (
                              <StreamingText
                                key={`${exampleIndex}-${index}`}
                                text={step.text}
                                playing={active}
                                onComplete={finishAgent}
                              />
                            )}
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  )}
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  );
}
