"use client"

import { useWords } from "@/lib/words"
import { VALUE_PROP } from "@/lib/site"
import type { Schedule, Settings } from "@/lib/types"
import { formatSpan } from "@/lib/locale"
import { Lamp } from "./Machine"
import { SiteFooter, SiteHeader, START } from "./SiteChrome"
import { PlottedWeek, SampleTicket } from "./SampleSheets"

/**
 * The front door: what the machine is, what goes in, what comes out, and the
 * one key to press. Set on the same panel as the machine itself, so walking
 * through the door changes nothing but the screen.
 */
export function Landing({ settings, schedule }: { settings: Settings; schedule: Schedule }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1">
        <Hero settings={settings} />
        <Output settings={settings} schedule={schedule} />
        <Steps />
        <Promises />
        <FinalCall />
      </main>

      <SiteFooter />
    </div>
  )
}

/**
 * The screen: the value proposition, a beat a line, the key to press, and,
 * beside it, what someone actually types in.
 */
function Hero({ settings }: { settings: Settings }) {
  const words = useWords()
  const meals = (settings.meals ?? []).filter((m) => m.enabled)

  return (
    <section className="mx-auto w-full max-w-[1100px] pb-4 pt-6 sm:px-6 sm:pt-10">
      <div className="crt grid gap-10 px-5 py-8 sm:px-12 sm:py-12 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div>
          <p className="label text-ink/75">
            {words.model} · {words.boot.subtitle}
          </p>
          <h1 className="mt-4 font-crt text-[31px] uppercase leading-[1.05] tracking-[0.03em] sm:text-[50px]">
            {VALUE_PROP.map((line) => (
              <span key={line} className="block lg:whitespace-nowrap">
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-5 max-w-[34rem] font-mono text-[15px] leading-relaxed text-ink/90 sm:text-[16px]">
            Stop deciding what to do next. Robot Mode places every session of your week around when you wake, sleep and eat. You
            follow the paper.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            {/* Inverse video: the selected line on a terminal, and the brightest thing on the screen. */}
            <a href={START}
              className="group inline-flex items-center gap-3 bg-ink px-5 py-2 font-crt text-[28px] uppercase tracking-[0.14em] text-paper [text-shadow:none] hover:bg-[#ffc560] sm:text-[32px]"
            >
              Build my week
              <span aria-hidden>▶</span>
            </a>
            <span className="font-crt text-[22px] uppercase tracking-[0.2em] text-ink/90 sm:text-[24px]">Free · No AI · Private</span>
          </div>
          <p className="mt-4 font-mono text-[13px] text-ink/75">Driven from the keyboard: best on a computer, works on a phone.</p>
        </div>

        {/* Request 01, filled in: the whole input, five lines and two times. */}
        <div aria-label="What goes in" className="border border-ink/35 font-crt text-[22px] uppercase leading-[1.25] sm:text-[24px]">
          <div className="label flex justify-between border-b border-ink/35 px-4 py-2 text-ink/75">
            <span>Request 01</span>
            <span>What do you want to do?</span>
          </div>
          <ul className="px-4 py-3">
            {settings.activities.map((a) => (
              <li key={a.id} className="grid grid-cols-[1fr_5.5rem_3rem] gap-2 sm:grid-cols-[1fr_6.5rem_3.5rem]">
                <span className="truncate">{a.name}</span>
                <span className="tabular-nums">{formatSpan(a.durationMinutes)}</span>
                <span className="text-right tabular-nums">{a.sessionsPerWeek}×</span>
              </li>
            ))}
            <li className="mt-1 text-ink/80">
              &gt; <span className="blink">_</span>
            </li>
          </ul>
          <div className="flex flex-wrap justify-between gap-x-4 border-t border-ink/35 px-4 py-2 text-ink/80">
            <span>
              Wake {settings.wakeTime} · Sleep {settings.sleepTime}
            </span>
            <span>{meals.map((m) => m.name).join(" · ")}</span>
          </div>
        </div>
      </div>
      <div className="label mt-3 flex justify-between gap-4 px-4 text-ink/70 sm:px-0">
        <span>{words.boot.display}</span>
        <span className="text-right">{words.boot.screen}</span>
      </div>
    </section>
  )
}

/** What comes out: the plotted week, and the day's ticket, from the input above. */
function Output({ settings, schedule }: { settings: Settings; schedule: Schedule }) {
  return (
    <section className="mx-auto w-full max-w-[1100px] px-4 py-14 sm:px-6 sm:py-20">
      <SectionHead
        eyebrow="What comes out"
        title="Your whole week, placed. Today, on a ticket."
        body="The lines on the screen above, solved by the real engine. Every session has a slot, around meals, travel time and each other."
      />

      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1fr_320px]">
        <PlottedWeek settings={settings} schedule={schedule} />
        <SampleTicket settings={settings} schedule={schedule} day={2} />
      </div>
    </section>
  )
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="max-w-[44rem]">
      <p className="label text-ink/70">{eyebrow}</p>
      <h2 className="mt-3 font-display text-[26px] font-semibold uppercase leading-tight tracking-[0.06em] sm:text-[34px]">
        {title}
      </h2>
      {body && <p className="mt-3 text-[16px] leading-relaxed text-ink/85">{body}</p>}
    </div>
  )
}

/** The value proposition's four beats, each with what is actually typed at the machine's keyboard. */
const STEPS = [
  {
    title: VALUE_PROP[0],
    body: "Type what you want to do, a line each: a name, how long, how many times a week. Then your hours and meals.",
    line: "gym 1h15 4x",
  },
  {
    title: VALUE_PROP[1],
    body: "Every session gets a slot, around your hours, meals, travel time and each other. Nothing double-booked. Change anything by typing.",
    line: "move gym mon to tue",
  },
  {
    title: VALUE_PROP[2],
    body: "PRINT puts the draft on paper. Tear the sheet off to file it, download it as a PDF, or export the week to your calendar.",
    line: "print",
  },
  {
    title: VALUE_PROP[3],
    body: "Follow the paper. Today's ticket is the day on one strip. When the week is over, tear it off and the next one starts.",
    line: "today",
  },
]

/** The four beats, as plates on the panel, each with a line typed at the keyboard's readout. */
function Steps() {
  return (
    <section className="border-y-2 border-ink bg-[#cdc5b1]">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-14 sm:px-6 sm:py-20">
        <SectionHead
          eyebrow="How it works"
          title="Decide once. Then stop deciding."
          body="No buttons to hunt for: you type at the machine's keyboard, in shorthand or plain words, and it completes as you go. HELP lists everything."
        />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative flex flex-col border-2 border-ink bg-paper p-6">
              {["left-1.5 top-1.5", "right-1.5 top-1.5", "left-1.5 bottom-1.5", "right-1.5 bottom-1.5"].map((at) => (
                <span key={at} aria-hidden className={`absolute h-1 w-1 rounded-full bg-ink/45 ${at}`} />
              ))}
              <p className="label text-ink/70">Step 0{i + 1}</p>
              <h3 className="mt-2 font-display text-[17px] font-semibold uppercase tracking-[0.08em]">{step.title}</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink/85">{step.body}</p>
              {/* The keyboard's readout, with the line typed in. */}
              <p className="crt mt-5 px-3 py-1.5 font-crt text-[20px] uppercase" style={{ borderWidth: 4 }}>
                <span className="text-ink/70">&gt; </span>
                {step.line}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const PROMISES = [
  { title: "No AI", body: "A plain scheduling engine, no model and no prompts. Same input, same week, every time, and every block can say why it's there." },
  { title: "Private", body: "It runs in your browser. No account, no sign-up, nothing uploaded. Your week stays on your device." },
  { title: "Yours to keep", body: "Free to use. Print the week, download it as a PDF, pocket today's ticket, or export it to Google Calendar, Apple Calendar or Outlook." },
]

/** What the machine will never do, on a dark strip like the printer's casing. */
function Promises() {
  return (
    <section className="bg-[#2a2620] text-sheet">
      <div className="mx-auto grid w-full max-w-[1100px] gap-10 px-4 py-14 sm:px-6 sm:py-20 md:grid-cols-3">
        {PROMISES.map((p) => (
          <div key={p.title}>
            <h3 className="flex items-center gap-2.5 font-display text-[18px] font-semibold uppercase tracking-[0.12em]">
              <Lamp /> {p.title}
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed text-sheet/80">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function FinalCall() {
  return (
    <section className="mx-auto w-full max-w-[1100px] px-4 py-16 text-center sm:px-6 sm:py-24">
      <h2 className="font-display text-[26px] font-semibold uppercase leading-tight tracking-[0.06em] sm:text-[36px]">
        Wake. Execute. Sleep. Repeat.
      </h2>
      <p className="mx-auto mt-3 max-w-[32rem] text-[16px] leading-relaxed text-ink/85">
        Write your week. The robot decides when. You print it, and you execute.
      </p>
      <a href={START} className="key key-dark mt-8 inline-block px-8 py-3.5 text-[14px]!">
        Build my week ▶
      </a>
      <p className="label mt-4 text-[12px] text-ink/80">Free · No AI · Private</p>
    </section>
  )
}
