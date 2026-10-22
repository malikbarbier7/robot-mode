"use client"

import type { ReactNode } from "react"
import { useWords } from "@/lib/words"
import { PUBLISHER, PUBLISHER_X_URL, VALUE_PROP } from "@/lib/site"
import { sampleTranscript, type SampleConflict } from "@/lib/sample"
import { templateById } from "@/lib/templates"
import type { Schedule, Settings } from "@/lib/types"
import { formatSpan } from "@/lib/locale"
import { FAQ, RULES, STEPS } from "@/lib/landing"
import { Lamp } from "./Machine"
import { SiteFooter, SiteHeader, START } from "./SiteChrome"
import { PlottedWeek, SampleTicket } from "./SampleSheets"

/**
 * The front door: what the machine does, shown as five lines going in and a
 * week coming out; how it decides; what people ask before trying it; and the
 * one key to press. Set on the same panel as the machine itself, so walking
 * through the door changes nothing but the screen.
 */
export function Landing({ settings, schedule, conflict }: { settings: Settings; schedule: Schedule; conflict: SampleConflict }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1">
        <Hero />
        <InAndOut settings={settings} schedule={schedule} />
        <Steps settings={settings} schedule={schedule} />
        <Decides conflict={conflict} />
        <TheMachine settings={settings} schedule={schedule} />
        <Promises />
        <Faq />
        <FinalCall />
      </main>

      <SiteFooter />
    </div>
  )
}

/** The ready-made weeks offered from the front door, each a link that loads it into the machine. */
const TEMPLATE_IDS = ["student", "worker", "entrepreneur", "fitness", "exam", "deep-work"]

/** Where a ready-made week opens: the machine, with that week loaded and solved. */
const templateHref = (id: string) => `/app/?template=${id}`

/**
 * The machine itself, alone on the first screen: a monitor on its stand, and
 * on its screen what it does, the key to press, and the ready-made weeks for
 * anyone who would rather start from one. Everything else waits below the fold.
 */
function Hero() {
  const words = useWords()
  const templates = TEMPLATE_IDS.map(templateById).filter((t) => t !== undefined)

  return (
    <section className="flex min-h-[calc(100svh-52px)] flex-col items-center justify-center px-4 pb-6 pt-6 sm:min-h-[calc(100svh-60px)] sm:px-6 sm:pt-8">
      {/* The casing: warm plastic, lit from above, with the tube set deep in a dark bezel. */}
      <div className="monitor w-full max-w-[1080px] p-2.5 sm:p-5">
        <div className="border-2 border-t-[6px] border-[#0d0b08] bg-[#1c1915] p-2 sm:p-3.5">
          <div className="crt crt-on overflow-hidden px-5 py-7 sm:px-12 sm:py-9 lg:px-16" style={{ borderWidth: 0, outline: "none" }}>
            <p className="label text-[11px] text-ink/80">
              {words.model} · Automatic weekly scheduler · <span className="text-ink">Ready</span>
            </p>
            <h1 className="mt-5 font-crt text-[38px] uppercase leading-[1.02] tracking-[0.02em] sm:text-[56px] lg:text-[64px]">
              {VALUE_PROP.map((line, i) => (
                <span key={line} className="block">
                  {line}
                  {i === VALUE_PROP.length - 1 && (
                    <span aria-hidden className="blink">
                      _
                    </span>
                  )}
                </span>
              ))}
            </h1>
            <p className="mt-5 max-w-[40rem] font-mono text-[15px] leading-relaxed text-ink/90 sm:text-[16px]">
              List what you want to fit into your week: the gym four times, Spanish most days, deep work every weekday morning. Robot
              Mode finds a slot for every session, around your sleep, meals and fixed hours. You follow the plan.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              {/* Inverse video: the selected line on a terminal, and the brightest thing on the screen. */}
              <a
                href={START}
                className="group inline-flex items-center gap-3 bg-ink px-5 py-2 font-crt text-[28px] uppercase tracking-[0.14em] text-paper [text-shadow:none] hover:bg-[#ffc560] sm:text-[34px]"
              >
                Build my week
                <span aria-hidden>▶</span>
              </a>
              <span className="whitespace-nowrap font-crt text-[20px] uppercase tracking-[0.1em] text-ink/90 sm:text-[24px] sm:tracking-[0.16em]">Free · No AI · No account</span>
            </div>

            {/* A menu line along the foot of the screen: pick a week someone like you might want, and change it from there. */}
            <nav aria-label="Start from a ready-made week" className="mt-9 border-t border-ink/35 pt-4 font-crt uppercase">
              <p className="label text-[11px] text-ink/80">Or load a ready-made week · change anything after</p>
              <ul className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((t) => (
                  <li key={t.id}>
                    <a
                      href={templateHref(t.id)}
                      title={t.blurb}
                      className="-mx-2 flex items-center justify-between gap-3 px-2 py-0.5 text-[21px] leading-tight hover:bg-ink hover:text-paper hover:[text-shadow:none] sm:text-[22px]"
                    >
                      <span>
                        <span className="text-ink/70" aria-hidden>
                          &gt;{" "}
                        </span>
                        {t.name}
                      </span>
                      <span aria-hidden>▶</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        {/* The chin: badge, vents, the power lamp. */}
        <div aria-hidden className="flex items-center justify-between gap-4 px-2 pt-2.5 sm:px-3 sm:pt-4">
          <span className="flex items-baseline gap-2.5 border border-ink/40 bg-[#d6cdb6] px-2.5 py-0.5">
            <span className="font-logo text-[13px] uppercase tracking-[0.18em]">{words.logo}</span>
            <span className="label text-ink/70">{words.model}</span>
          </span>
          <span className="hidden flex-1 justify-center gap-1.5 sm:flex">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} className="h-3.5 w-1 border-t-2 border-ink/50 bg-ink/15" />
            ))}
          </span>
          <span className="label flex items-center gap-2 text-ink/70">
            Power <Lamp />
          </span>
        </div>
      </div>

      {/* The stand. */}
      <div aria-hidden className="h-4 w-28 border-x-2 border-ink bg-gradient-to-b from-[#9d937c] to-[#b9af97] sm:h-6 sm:w-40" />
      <div aria-hidden className="h-2.5 w-64 border-2 border-b-4 border-ink bg-gradient-to-b from-[#c9bfa6] to-[#b4aa91] sm:h-3 sm:w-96" />

      <a href="#what-it-makes" className="label mt-5 text-[11px] text-ink/70 hover:text-ink">
        ▼ See what it makes of five lines
      </a>
    </section>
  )
}

/** The whole product in one view: five lines typed in, and the week the real engine makes of them. */
function InAndOut({ settings, schedule }: { settings: Settings; schedule: Schedule }) {
  const meals = (settings.meals ?? []).filter((m) => m.enabled)
  return (
    <section id="what-it-makes" className="mx-auto w-full max-w-[1100px] scroll-mt-16 px-4 py-14 sm:px-6 sm:py-20">
      <SectionHead eyebrow="What it does" title="Five lines in. A whole week out." />
      <div className="mt-10 grid items-start gap-6 lg:grid-cols-[300px_auto_minmax(0,1fr)] lg:gap-5">
        <div>
          <p className="font-display text-[15px] font-semibold">You type five lines</p>
          {/* Request 01, filled in: the whole input, five lines and two times. */}
          <div className="crt mt-3 font-crt text-[21px] uppercase leading-[1.3]" style={{ borderWidth: 8 }}>
            <ul className="px-4 py-3">
              {settings.activities.map((a) => (
                <li key={a.id} className="grid grid-cols-[1fr_4.8rem_2.4rem] gap-2">
                  <span className="truncate">{a.name}</span>
                  <span className="tabular-nums">{formatSpan(a.durationMinutes)}</span>
                  <span className="text-right tabular-nums">{a.sessionsPerWeek}×</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-ink/35 px-4 py-2 text-ink/85">
              Wake {settings.wakeTime} · Sleep {settings.sleepTime}
              <br />
              {meals.map((m) => m.name).join(" · ")}
            </div>
          </div>
          <p className="mt-3 text-[14px] leading-relaxed text-ink/85">
            A name, how long, how many times a week. Optionally: which days, what time of day, travel time.
          </p>
        </div>

        <div aria-hidden className="flex items-center justify-center gap-3 font-crt text-[34px] leading-none lg:mt-[118px] lg:flex-col">
          <span className="lg:hidden">↓</span>
          <span className="hidden lg:inline">→</span>
          <span className="label text-[11px] text-ink/75 lg:[writing-mode:vertical-rl]">Solved in ~30 ms</span>
        </div>

        <div className="min-w-0">
          <p className="font-display text-[15px] font-semibold">It plans the whole week</p>
          <div className="mt-3">
            <PlottedWeek settings={settings} schedule={schedule} size="large" />
          </div>
          <p className="mt-3 text-[14px] leading-relaxed text-ink/85">
            Solved by the real engine from those five lines when this page was built, not drawn by hand. Deep work stays in the
            mornings, the gym spreads across the week, nothing overlaps.
          </p>
        </div>
      </div>
    </section>
  )
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body?: ReactNode }) {
  return (
    <div className="max-w-[44rem]">
      <p className="label text-[11px] text-ink/80">{eyebrow}</p>
      <h2 className="mt-3 font-display text-[27px] font-semibold leading-[1.15] tracking-[-0.01em] sm:text-[36px]">{title}</h2>
      {body && <p className="mt-3 text-[16px] leading-relaxed text-ink/85">{body}</p>}
    </div>
  )
}

/** A line as typed at the machine, set in the screen's face. */
function Typed({ children }: { children: ReactNode }) {
  return <span className="whitespace-nowrap bg-screen px-1.5 py-0.5 font-crt text-[17px] uppercase text-phosphor">{children}</span>
}

/** Copy with `lines like this` set as typed at the machine. */
function WithTyped({ text }: { text: string }) {
  return <>{text.split("`").map((part, i) => (i % 2 ? <Typed key={i}>{part}</Typed> : part))}</>
}


/** The four steps, as plates on the panel, beside the day's ticket they end in. */
function Steps({ settings, schedule }: { settings: Settings; schedule: Schedule }) {
  return (
    <section className="border-y-2 border-ink bg-[#cdc5b1]">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-14 sm:px-6 sm:py-20">
        <SectionHead
          eyebrow="How it works"
          title="Decide once. Then stop deciding."
          body="A few minutes of setup. After that, the week is planned and you just follow it."
        />
        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1fr_300px]">
          <ol className="grid gap-4 sm:grid-cols-2">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative flex flex-col border-2 border-ink bg-paper p-6">
                {["left-1.5 top-1.5", "right-1.5 top-1.5", "left-1.5 bottom-1.5", "right-1.5 bottom-1.5"].map((at) => (
                  <span key={at} aria-hidden className={`absolute h-1 w-1 rounded-full bg-ink/45 ${at}`} />
                ))}
                <p className="label text-[11px] text-ink/80">Step 0{i + 1}</p>
                <h3 className="mt-2 font-display text-[18px] font-semibold">{step.title}</h3>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink/85">{step.body}</p>
                {/* The keyboard's readout, with the line typed in. */}
                <p className="crt mt-5 overflow-hidden whitespace-nowrap px-3 py-1.5 font-crt text-[18px] uppercase" style={{ borderWidth: 4 }}>
                  <span className="text-ink/70">&gt; </span>
                  {step.line}
                </p>
              </li>
            ))}
          </ol>
          <div>
            <SampleTicket settings={settings} schedule={schedule} day={2} />
            <p className="mt-3 text-[14px] leading-relaxed text-ink/85">Wednesday of the week above, as the ticket printer gives it: the day on one strip.</p>
          </div>
        </div>
      </div>
    </section>
  )
}


/**
 * How the engine decides, beside its FIX screen on a line that can't fit the
 * sample week: why, and the ways out it has checked by re-solving.
 */
function Decides({ conflict }: { conflict: SampleConflict }) {
  return (
    <section className="mx-auto w-full max-w-[1100px] px-4 py-14 sm:px-6 sm:py-20">
      <SectionHead
        eyebrow="How it decides"
        title="A real scheduler, not a guess."
        body="A plain engine places every session by a handful of rules, tries the week twenty ways and keeps the best one."
      />
      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1fr_1.1fr]">
        <ul className="space-y-5">
          {RULES.map((r) => (
            <li key={r.title} className="border-l-2 border-ink pl-4">
              <p className="font-display text-[15px] font-semibold">{r.title}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink/85">
                <WithTyped text={r.body} />
              </p>
            </li>
          ))}
        </ul>

        <figure>
          <div className="crt px-5 py-4 font-crt uppercase sm:px-6" style={{ borderWidth: 10 }}>
            <div className="text-[22px] leading-tight">
              <span className="text-ink/70">&gt; </span>
              {conflict.line}
            </div>
            <div className="flex gap-2 pl-3 text-[17px] leading-tight text-ink/75">
              <span aria-hidden>↳</span>
              <span>{conflict.reply}</span>
            </div>
            <div className="mt-4 flex items-center justify-between border-y border-ink/35 py-1.5 text-[17px] tracking-[0.14em]">
              <span>Fix · 1 conflict</span>
              <Lamp blink />
            </div>
            <div className="mt-3 flex justify-between gap-4 text-[22px] leading-tight">
              <span>{conflict.name}</span>
              <span className="tabular-nums">
                {conflict.placed}/{conflict.requested}
              </span>
            </div>
            <p className="text-[18px] leading-tight text-ink/85">{conflict.why}</p>
            <p className="mt-4 text-[16px] tracking-[0.14em] text-ink/70">Ways out · each one checked</p>
            <ol className="mt-1 space-y-0.5 text-[20px] leading-tight">
              {conflict.fixes.map((fix, i) => (
                <li key={fix}>
                  <span className="text-ink/70">{i + 1}.</span> {fix}
                </li>
              ))}
            </ol>
          </div>
          <figcaption className="mt-3 text-[14px] leading-relaxed text-ink/85">
            When something can&apos;t fit, it says why, and offers only fixes it has tried and seen work. Here, a 6:30 run on the week
            above, which wakes at 7:00. You pick the fix.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

/** The app itself, as it looks once a week is drafted, and the keyboard it is driven from. */
function TheMachine({ settings, schedule }: { settings: Settings; schedule: Schedule }) {
  const transcript = sampleTranscript(settings, schedule).slice(1, 5)
  return (
    <section className="border-y-2 border-ink bg-[#cdc5b1]">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-14 sm:px-6 sm:py-20">
        <SectionHead
          eyebrow="The machine"
          title="One screen, one keyboard."
          body="The week is drafted on the screen. You change it by typing, in plain words or shorthand; it completes as you go and says what Enter will do before you press it. Every key is also a button."
        />
        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1.5fr_1fr]">
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element -- a static export: the screenshot is served as it is. */}
            <img
              src="/landing/machine.png"
              width={1440}
              height={900}
              alt="Robot Mode in the browser: a week drafted on the amber screen, with the keyboard unit and its function keys underneath."
              className="h-auto w-full border-2 border-ink"
            />
            <figcaption className="mt-3 text-[14px] leading-relaxed text-ink/85">The Deep work template, drafted on the screen.</figcaption>
          </figure>
          <div>
            <div className="crt px-5 py-4 font-crt uppercase" style={{ borderWidth: 8 }}>
              <ol className="space-y-2.5">
                {transcript.map(({ line, reply }) => (
                  <li key={line}>
                    <div className="text-[21px] leading-tight">
                      <span className="text-ink/70">&gt; </span>
                      {line}
                    </div>
                    <div className="flex gap-2 pl-3 text-[16px] leading-tight text-ink/75">
                      <span aria-hidden>↳</span>
                      <span>{reply}</span>
                    </div>
                  </li>
                ))}
                <li className="text-[21px] text-ink/80">
                  &gt; <span className="blink">_</span>
                </li>
              </ol>
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-ink/85">
              Answers from the real command reader, on the sample week. <Typed>help</Typed> lists every command.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

const PROMISES = [
  { title: "No AI", body: "A plain scheduling engine, no model and no prompts. Same input, same week, every time, and every block can say why it's there." },
  { title: "Private", body: "It runs in your browser. No account, no sign-up, nothing uploaded. Your week stays on your device." },
  { title: "Yours to keep", body: "Free to use. Export it to Google Calendar, Apple Calendar or Outlook, download it as a PDF, or send the setup to another device as a link." },
]

/** What the machine will never do, on a dark strip like the printer's casing. */
function Promises() {
  return (
    <section className="bg-[#2a2620] text-sheet">
      <div className="mx-auto grid w-full max-w-[1100px] gap-10 px-4 py-14 sm:px-6 sm:py-20 md:grid-cols-3">
        {PROMISES.map((p) => (
          <div key={p.title}>
            <h3 className="flex items-center gap-2.5 font-display text-[18px] font-semibold">
              <Lamp /> {p.title}
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-sheet/85">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}


function Faq() {
  return (
    <section className="mx-auto w-full max-w-[1100px] px-4 py-14 sm:px-6 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <SectionHead eyebrow="Questions" title="Before you try it." />
        <div className="border-t-2 border-ink">
          {FAQ.map((f) => (
            <details key={f.q} className="group border-b border-ink/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden className="font-crt text-[24px] leading-none transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-5 pr-8 text-[15px] leading-relaxed text-ink/85">
                <WithTyped text={f.a} />
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCall() {
  return (
    <section className="border-t-2 border-ink bg-[#cdc5b1]">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-16 text-center sm:px-6 sm:py-24">
        <h2 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.01em] sm:text-[38px]">Stop deciding. Start doing.</h2>
        <p className="mx-auto mt-3 max-w-[32rem] text-[16px] leading-relaxed text-ink/85">
          Tell it what you want to do this week. It finds the time.
        </p>
        <a href={START} className="key key-dark mt-8 inline-block px-8 py-3.5 text-[14px]!">
          Build my week ▶
        </a>
        <p className="label mt-4 text-[12px] text-ink/80">Free · No AI · No account</p>
        {PUBLISHER.x && (
          <p className="mt-8 text-[14px] text-ink/85">
            Built by{" "}
            <a href={PUBLISHER_X_URL} className="font-semibold underline underline-offset-2 hover:text-ink">
              @{PUBLISHER.x}
            </a>
. Questions and feedback welcome there.
          </p>
        )}
      </div>
    </section>
  )
}
