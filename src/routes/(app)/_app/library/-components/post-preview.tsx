import { useState } from "react";
import * as stylex from "@stylexjs/stylex";
import {
  BookmarkSimple,
  CaretLeft,
  CaretRight,
  ChatCircle,
  DotsThree,
  Globe,
  Heart,
  PaperPlaneTilt,
  Play,
  Repeat,
  ShareFat,
  ThumbsUp,
} from "@phosphor-icons/react";
import type { FileView } from "#/modules/storage/files.service";
import { colors, radius } from "../../../../../components/ui/tokens.stylex";
import { formatDuration } from "../-lib/format";
import { MediaImage } from "./media-image";

type Channel = { name: string; avatar: string | null };

export type PreviewProps = {
  provider: string;
  /** What the post is there: "Reel", "Short", "Carousel", "Album"… */
  label: string;
  channel: Channel | null;
  files: FileView[];
  caption: string;
  title: string;
  description: string;
};

const styles = stylex.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius["2xl"],
    borderStyle: "solid",
    borderWidth: "1px",
    color: colors.foreground,
    fontSize: "0.8125rem",
    lineHeight: 1.45,
    overflow: "hidden",
  },
  head: { alignItems: "center", display: "flex", gap: "0.5rem", padding: "0.625rem 0.75rem" },
  avatar: {
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    color: colors.mutedForeground,
    display: "grid",
    flexShrink: 0,
    fontSize: "0.75rem",
    fontWeight: 600,
    height: "2rem",
    objectFit: "cover",
    placeItems: "center",
    width: "2rem",
  },
  small: { height: "1.5rem", width: "1.5rem" },
  who: { display: "grid", flexGrow: 1, lineHeight: 1.2, minWidth: 0 },
  name: {
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sub: {
    alignItems: "center",
    color: colors.mutedForeground,
    display: "flex",
    fontSize: "0.6875rem",
    gap: "0.25rem",
  },
  muted: { color: colors.mutedForeground },
  text: {
    margin: 0,
    overflow: "hidden",
    paddingBlock: "0 0.625rem",
    paddingInline: "0.75rem",
    whiteSpace: "pre-wrap",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 4,
    display: "-webkit-box",
  },
  placeholder: { color: colors.mutedForeground, fontStyle: "italic" },
  bold: { fontWeight: 600 },
  actions: {
    alignItems: "center",
    color: colors.foreground,
    display: "flex",
    gap: "0.875rem",
    padding: "0.625rem 0.75rem",
  },
  push: { marginInlineStart: "auto" },
  bar: {
    borderTopColor: colors.border,
    borderTopStyle: "solid",
    borderTopWidth: "1px",
    color: colors.mutedForeground,
    display: "flex",
    fontSize: "0.75rem",
    fontWeight: 500,
    justifyContent: "space-around",
    paddingBlock: "0.5rem",
  },
  barItem: { alignItems: "center", display: "flex", gap: "0.375rem" },
  // ── media ──
  slides: { backgroundColor: "#000", overflow: "hidden", position: "relative", width: "100%" },
  arrow: {
    alignItems: "center",
    backgroundColor: "rgb(255 255 255 / 0.85)",
    borderRadius: radius.full,
    borderStyle: "none",
    color: "#111",
    cursor: "pointer",
    display: "flex",
    height: "1.5rem",
    justifyContent: "center",
    padding: 0,
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    width: "1.5rem",
  },
  prev: { left: "0.5rem" },
  next: { right: "0.5rem" },
  count: {
    backgroundColor: "rgb(0 0 0 / 0.6)",
    borderRadius: radius.full,
    color: "white",
    fontSize: "0.6875rem",
    paddingInline: "0.5rem",
    position: "absolute",
    right: "0.5rem",
    top: "0.5rem",
  },
  dots: { display: "flex", gap: "0.25rem", justifyContent: "center", paddingTop: "0.5rem" },
  dot: {
    backgroundColor: colors.border,
    borderRadius: radius.full,
    height: "0.375rem",
    width: "0.375rem",
  },
  dotOn: { backgroundColor: colors.primary },
  play: {
    alignItems: "center",
    backgroundColor: "rgb(0 0 0 / 0.5)",
    borderRadius: radius.full,
    color: "white",
    display: "flex",
    height: "2.5rem",
    justifyContent: "center",
    left: "50%",
    position: "absolute",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: "2.5rem",
  },
  time: {
    backgroundColor: "rgb(0 0 0 / 0.75)",
    borderRadius: radius.sm,
    bottom: "0.375rem",
    color: "white",
    fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
    fontSize: "0.6875rem",
    paddingInline: "0.25rem",
    position: "absolute",
    right: "0.375rem",
  },
  // ── vertical (Reels, Shorts, TikTok) ──
  vertical: {
    aspectRatio: "9 / 16",
    backgroundColor: "#000",
    borderRadius: radius["2xl"],
    color: "white",
    marginInline: "auto",
    maxHeight: "30rem",
    overflow: "hidden",
    position: "relative",
  },
  shade: {
    backgroundImage: "linear-gradient(to top, rgb(0 0 0 / 0.75), transparent 55%)",
    inset: 0,
    position: "absolute",
  },
  overlay: {
    bottom: "0.75rem",
    display: "grid",
    gap: "0.375rem",
    left: "0.75rem",
    position: "absolute",
    right: "3rem",
  },
  overlayWho: { alignItems: "center", display: "flex", fontWeight: 600, gap: "0.5rem" },
  overlayText: {
    display: "-webkit-box",
    fontSize: "0.75rem",
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
  },
  rail: {
    alignItems: "center",
    bottom: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    position: "absolute",
    right: "0.625rem",
  },
  tag: {
    backgroundColor: "rgb(0 0 0 / 0.5)",
    borderRadius: radius.full,
    fontSize: "0.6875rem",
    fontWeight: 600,
    left: "0.625rem",
    paddingInline: "0.5rem",
    position: "absolute",
    top: "0.625rem",
  },
  // ── YouTube video ──
  ytInfo: { display: "flex", gap: "0.625rem", padding: "0.75rem" },
  ytTitle: {
    display: "-webkit-box",
    fontSize: "0.875rem",
    fontWeight: 600,
    lineHeight: 1.35,
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
  },
  // ── Facebook album ──
  album: { display: "grid", gap: "2px", gridTemplateColumns: "1fr 1fr" },
  albumTile: { aspectRatio: "1", overflow: "hidden", position: "relative" },
  albumMore: {
    alignItems: "center",
    backgroundColor: "rgb(0 0 0 / 0.55)",
    color: "white",
    display: "flex",
    fontSize: "1.25rem",
    fontWeight: 600,
    inset: 0,
    justifyContent: "center",
    position: "absolute",
  },
  // ── Threads ──
  thread: { display: "flex", gap: "0.625rem", padding: "0.75rem" },
  threadBody: { display: "grid", flexGrow: 1, gap: "0.375rem", minWidth: 0 },
  threadMedia: { display: "flex", gap: "0.375rem", overflowX: "auto" },
  threadTile: {
    borderRadius: radius.lg,
    flexShrink: 0,
    height: "10rem",
    overflow: "hidden",
  },
  // ── Pin ──
  pin: { display: "grid", gap: "0.5rem" },
  pinMedia: { borderRadius: radius["2xl"], overflow: "hidden", position: "relative" },
  pinTitle: { fontSize: "0.875rem", fontWeight: 600, margin: 0 },
  pinWho: { alignItems: "center", display: "flex", gap: "0.375rem", fontSize: "0.75rem" },
});

const ratio = (file: FileView, min: number, max: number) =>
  Math.min(Math.max(file.width && file.height ? file.width / file.height : 1, min), max);

function Avatar({ channel, small }: { channel: Channel | null; small?: boolean }) {
  if (channel?.avatar)
    return (
      <img src={channel.avatar} alt="" {...stylex.props(styles.avatar, small && styles.small)} />
    );
  return (
    <span {...stylex.props(styles.avatar, small && styles.small)}>
      {(channel?.name ?? "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** The post's text, or a faint note that there is none yet. */
function Text({ value, name }: { value: string; name?: string }) {
  return (
    <p {...stylex.props(styles.text)}>
      {name && <span {...stylex.props(styles.bold)}>{name} </span>}
      {value || <span {...stylex.props(styles.placeholder)}>No caption yet</span>}
    </p>
  );
}

/** One file at a time, with arrows and dots when there are several. */
function Slides({ files, aspect }: { files: FileView[]; aspect: number }) {
  const [at, setAt] = useState(0);
  const index = Math.min(at, files.length - 1);
  const file = files[index];
  return (
    <>
      <div {...stylex.props(styles.slides)} style={{ aspectRatio: aspect }}>
        <MediaImage file={file} width={480} />
        {file.kind === "video" && (
          <span {...stylex.props(styles.play)}>
            <Play size={16} weight="fill" />
          </span>
        )}
        {files.length > 1 && (
          <>
            <span {...stylex.props(styles.count)}>
              {index + 1}/{files.length}
            </span>
            {index > 0 && (
              <button
                type="button"
                aria-label="Previous"
                onClick={() => setAt(index - 1)}
                {...stylex.props(styles.arrow, styles.prev)}
              >
                <CaretLeft size={12} weight="bold" />
              </button>
            )}
            {index < files.length - 1 && (
              <button
                type="button"
                aria-label="Next"
                onClick={() => setAt(index + 1)}
                {...stylex.props(styles.arrow, styles.next)}
              >
                <CaretRight size={12} weight="bold" />
              </button>
            )}
          </>
        )}
      </div>
      {files.length > 1 && (
        <div {...stylex.props(styles.dots)}>
          {files.map((item, dot) => (
            <span key={item.id} {...stylex.props(styles.dot, dot === index && styles.dotOn)} />
          ))}
        </div>
      )}
    </>
  );
}

/** A Reel, a Short, a TikTok: the video upright with the words over it. */
function Vertical({ provider, label, channel, files, caption, title }: PreviewProps) {
  const text = provider === "youtube" ? title || caption : caption;
  return (
    <div {...stylex.props(styles.vertical)}>
      <MediaImage file={files[0]} width={480} />
      <span {...stylex.props(styles.shade)} />
      <span {...stylex.props(styles.tag)}>{label}</span>
      <div {...stylex.props(styles.rail)}>
        <Heart size={20} weight="fill" />
        <ChatCircle size={20} weight="fill" />
        <ShareFat size={20} weight="fill" />
      </div>
      <div {...stylex.props(styles.overlay)}>
        <span {...stylex.props(styles.overlayWho)}>
          <Avatar channel={channel} small />
          {channel?.name ?? "Your channel"}
        </span>
        <span {...stylex.props(styles.overlayText)}>{text || "No caption yet"}</span>
      </div>
    </div>
  );
}

/**
 * How the post will look on its platform — near enough to judge the crop, the order of a
 * carousel and whether the words read right, without pretending to be pixel-exact.
 */
export function PostPreview(props: PreviewProps) {
  const { provider, label, channel, files, caption, title, description } = props;
  if (!files.length) return null;
  const vertical = label === "Reel" || label === "Short" || provider === "tiktok";
  if (vertical && files.length === 1 && files[0].kind === "video") return <Vertical {...props} />;

  const name = channel?.name ?? "Your channel";

  if (provider === "youtube")
    return (
      <div {...stylex.props(styles.card)}>
        <div {...stylex.props(styles.slides)} style={{ aspectRatio: 16 / 9 }}>
          <MediaImage file={files[0]} width={480} />
          {files[0].durationMs ? (
            <span {...stylex.props(styles.time)}>{formatDuration(files[0].durationMs)}</span>
          ) : null}
        </div>
        <div {...stylex.props(styles.ytInfo)}>
          <Avatar channel={channel} />
          <div {...stylex.props(styles.who)}>
            <span {...stylex.props(styles.ytTitle, !title && styles.placeholder)}>
              {title || "No title yet"}
            </span>
            <span {...stylex.props(styles.sub)}>{name} · Scheduled</span>
          </div>
        </div>
      </div>
    );

  if (provider === "facebook")
    return (
      <div {...stylex.props(styles.card)}>
        <div {...stylex.props(styles.head)}>
          <Avatar channel={channel} />
          <div {...stylex.props(styles.who)}>
            <span {...stylex.props(styles.name)}>{name}</span>
            <span {...stylex.props(styles.sub)}>
              Scheduled · <Globe size={11} />
            </span>
          </div>
          <DotsThree size={18} />
        </div>
        <Text value={description || caption} />
        {files.length > 1 ? (
          <div {...stylex.props(styles.album)}>
            {files.slice(0, 4).map((file, index) => (
              <div key={file.id} {...stylex.props(styles.albumTile)}>
                <MediaImage file={file} width={480} />
                {index === 3 && files.length > 4 && (
                  <span {...stylex.props(styles.albumMore)}>+{files.length - 4}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Slides files={files} aspect={ratio(files[0], 0.8, 1.91)} />
        )}
        <div {...stylex.props(styles.bar)}>
          <span {...stylex.props(styles.barItem)}>
            <ThumbsUp size={15} /> Like
          </span>
          <span {...stylex.props(styles.barItem)}>
            <ChatCircle size={15} /> Comment
          </span>
          <span {...stylex.props(styles.barItem)}>
            <ShareFat size={15} /> Share
          </span>
        </div>
      </div>
    );

  if (provider === "threads")
    return (
      <div {...stylex.props(styles.card)}>
        <div {...stylex.props(styles.thread)}>
          <Avatar channel={channel} />
          <div {...stylex.props(styles.threadBody)}>
            <span {...stylex.props(styles.name)}>{name}</span>
            <span>{caption || <span {...stylex.props(styles.placeholder)}>No text yet</span>}</span>
            <div {...stylex.props(styles.threadMedia)}>
              {files.map((file) => (
                <div
                  key={file.id}
                  {...stylex.props(styles.threadTile)}
                  style={{ width: `${10 * ratio(file, 0.56, 1.78)}rem` }}
                >
                  <MediaImage file={file} width={480} />
                </div>
              ))}
            </div>
            <div {...stylex.props(styles.actions)} style={{ padding: 0 }}>
              <Heart size={17} />
              <ChatCircle size={17} />
              <Repeat size={17} />
              <PaperPlaneTilt size={17} />
            </div>
          </div>
        </div>
      </div>
    );

  if (provider === "pinterest")
    return (
      <div {...stylex.props(styles.pin)}>
        <div {...stylex.props(styles.pinMedia)}>
          <Slides files={files} aspect={ratio(files[0], 0.56, 1.5)} />
        </div>
        <p {...stylex.props(styles.pinTitle, !title && styles.placeholder)}>
          {title || "No title yet"}
        </p>
        <span {...stylex.props(styles.pinWho)}>
          <Avatar channel={channel} small /> {name}
        </span>
      </div>
    );

  // Instagram, and the shape most feeds share.
  return (
    <div {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.head)}>
        <Avatar channel={channel} />
        <div {...stylex.props(styles.who)}>
          <span {...stylex.props(styles.name)}>{name}</span>
          <span {...stylex.props(styles.sub)}>{label}</span>
        </div>
        <DotsThree size={18} />
      </div>
      <Slides files={files} aspect={files.length > 1 ? 0.8 : ratio(files[0], 0.8, 1.91)} />
      <div {...stylex.props(styles.actions)}>
        <Heart size={20} />
        <ChatCircle size={20} />
        <PaperPlaneTilt size={20} />
        <BookmarkSimple size={20} {...stylex.props(styles.push)} />
      </div>
      <Text value={caption} name={name} />
    </div>
  );
}
