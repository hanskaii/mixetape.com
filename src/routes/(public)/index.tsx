import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  Check,
  Clock,
  Key,
  Play,
  PlugsConnected,
  UploadSimple,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { Button } from "#/components/ui/button";
import { useModal } from "#/components/providers/modal-providers";
import { Route as RootRoute } from "#/routes/__root";
import { siteConfig } from "#/config/site";

export const Route = createFileRoute("/(public)/")({
  head: () => ({
    meta: [
      { title: siteConfig.title },
      { name: "description", content: siteConfig.description },
      { property: "og:title", content: siteConfig.title },
      { property: "og:type", content: "website" },
    ],
  }),
  component: HomePage,
});

const steps = [
  {
    number: "01",
    icon: PlugsConnected,
    title: "Connect your channel",
    text: "Bring your own OAuth app. Your YouTube connection and quota stay under your control.",
    tone: "bg-primary text-primary-foreground",
  },
  {
    number: "02",
    icon: UploadSimple,
    title: "Set the release",
    text: "Add a video URL or upload a file, then choose the title, visibility, and go-live time.",
    tone: "bg-card text-card-foreground",
  },
  {
    number: "03",
    icon: CalendarCheck,
    title: "Let it go live",
    text: "See what's queued, check what published, and retry a failed post from one place.",
    tone: "bg-studio text-studio-foreground",
  },
] as const;

function HomePage() {
  const { session } = RootRoute.useRouteContext();
  const { openLogin } = useModal();

  return (
    <main className="px-4 pb-20 sm:px-6">
      <section className="grid items-center gap-12 pb-18 pt-20 lg:grid-cols-[minmax(0,1.12fr)_minmax(360px,.88fr)] lg:gap-16 lg:pb-24 lg:pt-24">
        <div className="relative z-10">
          <p className="eyebrow mb-6 inline-flex items-center gap-2.5 text-muted-foreground">
            <span className="size-2.5 rounded-full bg-primary ring-2 ring-foreground/15" />
            YOUR PUBLISHING DESK
          </p>
          <h1 className="max-w-[680px] font-display text-[clamp(3.5rem,7.5vw,6.5rem)] leading-[.97] font-medium tracking-[-.065em] text-foreground">
            Make the video.
            <br />
            We&apos;ll mind the <em className="editorial-serif text-editorial">clock.</em>
          </h1>
          <p className="mt-7 max-w-[560px] text-[17px] leading-[1.65] text-muted-foreground sm:text-lg">
            Upload once, choose when it goes live, and let mixetape handle the post. Your channel,
            your credentials, your schedule.
          </p>
          <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {session?.user ? (
              <Button
                size="lg"
                render={<Link to="/publish" />}
                className="h-13 w-full gap-2 rounded-xl px-6 text-base font-semibold shadow-[inset_0_-3px_0_rgba(0,0,0,.13),0_12px_28px_-16px_#b87600] sm:w-auto"
              >
                Open your studio <ArrowUpRight className="size-5" />
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => openLogin()}
                className="h-13 w-full gap-2 rounded-xl px-6 text-base font-semibold shadow-[inset_0_-3px_0_rgba(0,0,0,.13),0_12px_28px_-16px_#b87600] sm:w-auto"
              >
                Start publishing <ArrowUpRight className="size-5" />
              </Button>
            )}
            <a
              href="#how"
              className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold transition-transform hover:-translate-y-px hover:border-foreground/30 sm:w-auto"
            >
              See how it works <ArrowRight className="size-4" />
            </a>
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-3 border-t border-border pt-5 text-xs font-medium text-muted-foreground">
            <span className="eyebrow !text-[10px]">PUBLISHES TO</span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-foreground">
              <YoutubeLogo className="size-4 text-[#e62117]" weight="fill" /> YouTube
            </span>
            <span>More destinations as they become available.</span>
          </div>
        </div>

        <PublishingPreview />
      </section>

      <section id="how" className="scroll-mt-28 border-t border-border py-18 lg:py-24">
        <div className="mb-10 grid gap-6 md:grid-cols-[.85fr_1.15fr] md:items-end">
          <p className="eyebrow text-muted-foreground">HOW IT WORKS / 03 STEPS</p>
          <h2 className="max-w-[660px] font-display text-[clamp(2.6rem,5.2vw,4.5rem)] leading-[1.02] font-medium tracking-[-.055em]">
            From upload to <em className="editorial-serif text-editorial">on air.</em>
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map(({ number, icon: Icon, title, text, tone }) => (
            <article
              key={number}
              className={`group flex min-h-[340px] flex-col rounded-[22px] border border-border/70 p-6 transition-transform duration-200 hover:-translate-y-1 sm:p-7 ${tone}`}
            >
              <div className="flex items-start justify-between">
                <span className="font-mono text-xs tracking-[.16em] opacity-65">{number} / 03</span>
                <span className="grid size-12 place-items-center rounded-xl border border-current/15 bg-current/5">
                  <Icon className="size-6" weight="regular" />
                </span>
              </div>
              <div className="mt-auto">
                <h3 className="max-w-[240px] font-display text-[29px] leading-[1.08] font-medium tracking-[-.04em]">
                  {title}
                </h3>
                <p className="mt-4 max-w-[295px] text-sm leading-relaxed opacity-75">{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        id="features"
        className="scroll-mt-28 grid gap-10 border-t border-border py-18 lg:grid-cols-[.85fr_1.15fr] lg:gap-16 lg:py-24"
      >
        <div>
          <p className="eyebrow mb-5 text-muted-foreground">BUILT FOR THE WAY YOU WORK</p>
          <h2 className="max-w-[480px] font-display text-[clamp(2.7rem,5vw,4.4rem)] leading-[1.03] font-medium tracking-[-.055em]">
            A quieter way to <em className="editorial-serif text-editorial">ship.</em>
          </h2>
          <p className="mt-6 max-w-[430px] text-base leading-relaxed text-muted-foreground">
            Keep the creative work in your hands. mixetape takes care of the calendar and gives you
            a clear record of what happened.
          </p>
        </div>
        <div className="overflow-hidden rounded-[22px] border border-border bg-card">
          <FeatureRow
            icon={Clock}
            title="Publish when it matters"
            text="Schedule the go-live time and choose an upload lead so YouTube can process HD video first."
          />
          <FeatureRow
            icon={Check}
            title="Know where every post stands"
            text="Upcoming, uploaded, published, and failed posts stay visible in one queue."
          />
          <FeatureRow
            icon={Key}
            title="Bring your pipeline"
            text="Create an API key and schedule posts from the scripts you already use."
          />
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[24px] border border-[#3b3933] bg-studio px-7 py-12 text-studio-foreground sm:px-12 sm:py-14">
        <div
          className="pointer-events-none absolute -top-32 right-[-70px] size-[360px] rounded-full border border-primary/25 shadow-[0_0_0_65px_rgba(255,210,31,.045),0_0_0_130px_rgba(255,210,31,.025)]"
          aria-hidden="true"
        />
        <div className="relative z-10 max-w-[720px]">
          <p className="eyebrow mb-5 text-primary">READY WHEN YOU ARE</p>
          <h2 className="font-display text-[clamp(2.6rem,5vw,4.5rem)] leading-[1.02] font-medium tracking-[-.055em]">
            Your next release deserves{" "}
            <em className="editorial-serif text-primary">better timing.</em>
          </h2>
          <p className="mt-5 max-w-[520px] text-base text-[#bcb9b1]">
            Connect your channel, queue the video, and get back to making the next one.
          </p>
          {session?.user ? (
            <Button
              size="lg"
              render={<Link to="/publish" />}
              className="mt-8 h-12 rounded-xl px-5 font-semibold"
            >
              Go to Publish <ArrowUpRight className="size-4" />
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => openLogin()}
              className="mt-8 h-12 rounded-xl px-5 font-semibold"
            >
              Get started <ArrowUpRight className="size-4" />
            </Button>
          )}
        </div>
      </section>
    </main>
  );
}

function PublishingPreview() {
  return (
    <div
      className="relative mx-auto w-full max-w-[465px] lg:ml-auto"
      aria-label="Illustration of a scheduled YouTube post"
    >
      <div
        className="pointer-events-none absolute inset-6 rounded-full bg-primary/45 blur-[85px]"
        aria-hidden="true"
      />
      <div className="relative overflow-hidden rounded-[24px] border border-[#343432] bg-studio text-studio-foreground shadow-[0_30px_70px_-35px_rgba(17,17,15,.75)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex gap-1.5" aria-hidden="true">
              <i className="size-2 rounded-full bg-[#ff5f57]" />
              <i className="size-2 rounded-full bg-[#febc2e]" />
              <i className="size-2 rounded-full bg-[#28c840]" />
            </span>
            <span className="font-mono text-[11px] tracking-[.12em] text-white/50">
              MIXETAPE / STUDIO
            </span>
          </div>
          <span
            className="size-2 rounded-full bg-primary shadow-[0_0_14px_#ffd21f]"
            aria-hidden="true"
          />
        </div>
        <div className="relative flex min-h-[325px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_52%_47%,#313025_0%,#181816_54%,#10100f_100%)]">
          <div
            className="record-grooves relative grid size-[248px] place-items-center rounded-full border border-white/15 bg-[#181818] shadow-[0_24px_55px_rgba(0,0,0,.55)] sm:size-[290px]"
            aria-hidden="true"
          >
            <div className="grid size-24 place-items-center rounded-full border-[10px] border-primary bg-[#0b0b0b] shadow-[0_0_0_1px_rgba(255,210,31,.6)]">
              <Play className="ml-1 size-9 text-primary" weight="fill" />
            </div>
          </div>
          <span className="absolute top-6 left-6 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 font-mono text-[10px] tracking-[.15em] text-white/70">
            VIDEO / 01
          </span>
          <span className="absolute right-6 bottom-6 rounded-lg border border-primary/40 bg-[#1b1a14] px-2.5 py-1.5 font-mono text-[10px] tracking-[.08em] text-primary">
            READY TO QUEUE
          </span>
        </div>
        <div className="border-t border-white/10 px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] tracking-[.16em] text-primary uppercase">
                Scheduled post
              </p>
              <p className="mt-1 text-[17px] font-semibold tracking-tight">Your next video</p>
            </div>
            <YoutubeLogo className="size-7 text-[#ff4135]" weight="fill" aria-label="YouTube" />
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground">
              <CalendarCheck className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] tracking-[.1em] text-white/50 uppercase">
                Go live
              </p>
              <p className="text-sm font-medium">On your schedule</p>
            </div>
            <span className="rounded-md bg-primary/15 px-2 py-1 font-mono text-[10px] text-primary">
              QUEUED
            </span>
          </div>
        </div>
      </div>
      <div className="absolute -right-2 -bottom-5 hidden rotate-3 rounded-xl border border-border bg-card px-4 py-3 shadow-[0_16px_36px_-20px_rgba(0,0,0,.45)] sm:flex sm:items-center sm:gap-2">
        <span className="grid size-7 place-items-center rounded-full bg-primary">
          <Check className="size-4 text-primary-foreground" weight="bold" />
        </span>
        <span className="text-xs font-semibold">The clock is covered.</span>
      </div>
    </div>
  );
}

function FeatureRow({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Clock;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-4 border-b border-border p-5 last:border-0 sm:p-6">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/25">
        <Icon className="size-5" />
      </span>
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
