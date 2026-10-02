"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useWords } from "@/lib/words"
import type { Day, PlacedBlock, Schedule, Settings } from "@/lib/types"
import { DAY_NAMES, parseTime } from "@/lib/scheduler/time"
import { formatClock, formatSpan } from "@/lib/locale"
import { dayTimeline } from "@/lib/printout"
import { Lamp } from "./Machine"

/**
 * Where Build my week goes: the machine, already switched on, at its first
 * question. A full load, not a client-side hop: the app reads the flag from the
 * address as it starts.
 */
const START = "/app?start"

/** The day the sample ticket is printed for. */
const TICKET_DAY: Day = 2

/**
 * The front door: what the machine is, what goes in, what comes out, and the
 * one key to press. Set on the same panel as the machine itself, so walking
 * through the door changes nothing but the screen.
 */
export function Landing({ settings, schedule }: { settings: Settings; schedule: Schedule }) {
  const words = useWords()

  return (
    <div className="flex min-h-dvh flex-col">
      {/* The machine's panel, as in the app, with the one key that matters always in reach. */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b-2 border-ink bg-[#cdc5b1] px-3 py-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)] sm:px-6 sm:py-2.5">
        <div className="flex items-center gap-6">
          <Nameplate />
          <span className="label hidden items-center gap-1.5 text-ink/70 sm:flex">
            <Lamp /> Power
          </span>
        </div>
        <a href={START} className="key key-dark px-3 py-1.5">
          Build my week ▶
        </a>
      </header>

      <main className="flex-1">
        <Hero settings={settings} />
        <Output settings={settings} schedule={schedule} />
        <Steps />
        <Promises />
        <FinalCall />
      </main>

      <footer className="label flex flex-wrap justify-between gap-2 border-t border-ink/40 px-4 py-2 text-ink/50 sm:px-6">
        <span>
          {words.model} · {words.boot.subtitle}
        </span>
        <span>Rev. 2.7</span>
      </footer>
    </div>
  )
}

/** The nameplate, screws and all. */
function Nameplate() {
  const words = useWords()
  return (
    <Link href="/" className="relative flex items-baseline gap-4 border-2 border-ink bg-paper px-3 py-1 sm:px-4 sm:py-1.5">
      {["left-1 top-1", "right-1 top-1", "left-1 bottom-1", "right-1 bottom-1"].map((at) => (
        <span key={at} aria-hidden className={`absolute h-1 w-1 rounded-full bg-ink/50 ${at}`} />
      ))}
      <span className="font-logo text-[17px] uppercase leading-none tracking-[0.18em] sm:text-[22px]">
        <span aria-hidden>{words.logo}</span>
        <span className="sr-only">{words.name}</span>
      </span>
      <span className="label hidden text-ink/50 sm:inline">{words.model}</span>
    </Link>
  )
}

/**
 * The screen: what the product is in one sentence, the key to press, and,
 * beside it, what someone actually types in.
 */
function Hero({ settings }: { settings: Settings }) {
  const words = useWords()
  const meals = (settings.meals ?? []).filter((m) => m.enabled)

  return (
    <section className="mx-auto w-full max-w-[1100px] pb-4 pt-6 sm:px-6 sm:pt-10">
      <div className="crt grid gap-10 px-5 py-8 sm:px-12 sm:py-12 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <div>
          <p className="label text-ink/60">
            {words.model} · {words.boot.subtitle}
          </p>
          <h1 className="mt-4 font-crt text-[46px] uppercase leading-[0.95] tracking-[0.04em] sm:text-[76px]">
            Stop deciding what to do next.
          </h1>
          <p className="mt-5 max-w-[34rem] font-mono text-[15px] leading-relaxed text-ink/85 sm:text-[16px]">
            List what you want to do each week, and Robot Mode builds the timetable around when you wake and sleep.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            {/* Inverse video: the selected line on a terminal, and the brightest thing on the screen. */}
            <a href={START}
              className="group inline-flex items-center gap-3 bg-ink px-5 py-2 font-crt text-[28px] uppercase tracking-[0.14em] text-paper [text-shadow:none] hover:bg-[#ffc560] sm:text-[32px]"
            >
              Build my week
              <span aria-hidden>▶</span>
            </a>
            <span className="font-crt text-[22px] uppercase tracking-[0.2em] text-ink/80 sm:text-[24px]">No AI · Private</span>
          </div>
        </div>

        {/* Request 01, filled in: the whole input, five lines and two times. */}
        <div aria-label="What goes in" className="border border-ink/35 font-crt text-[22px] uppercase leading-[1.25] sm:text-[24px]">
          <div className="label flex justify-between border-b border-ink/35 px-4 py-2 text-ink/60">
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
            <li className="mt-1 text-ink/70">
              &gt; <span className="blink">_</span>
            </li>
          </ul>
          <div className="flex flex-wrap justify-between gap-x-4 border-t border-ink/35 px-4 py-2 text-ink/70">
            <span>
              Wake {settings.wakeTime} · Sleep {settings.sleepTime}
            </span>
            <span>{meals.map((m) => m.name).join(" · ")}</span>
          </div>
        </div>
      </div>
      <div className="label mt-3 flex justify-between gap-4 px-4 text-ink/55 sm:px-0">
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
        <SampleTicket settings={settings} schedule={schedule} />
      </div>
    </section>
  )
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="max-w-[44rem]">
      <p className="label text-ink/55">{eyebrow}</p>
      <h2 className="mt-3 font-display text-[26px] font-semibold uppercase leading-tight tracking-[0.06em] sm:text-[34px]">
        {title}
      </h2>
      {body && <p className="mt-3 text-[16px] leading-relaxed text-ink/75">{body}</p>}
    </div>
  )
}

/** An output unit's lid, nameplate and spec, with the paper coming out under it. */
function Unit({ name, spec, className = "", children }: { name: string; spec: string; className?: string; children: ReactNode }) {
  return (
    <figure className={`min-w-0 ${className}`}>
      <div className="flex items-center justify-between gap-4 border border-black bg-[#2a2620] px-4 py-1.5">
        <span className="label border border-paper/40 px-2 py-0.5 text-paper/85">{name}</span>
        <span className="label text-paper/45">{spec}</span>
      </div>
      <div className="h-2 border-x border-b border-black bg-[#c9c1ad]" />
      {children}
    </figure>
  )
}

const HOUR_PX = 22

/** The plotter's chart of the week, as the app draws it, at a fixed scale. */
function PlottedWeek({ settings, schedule }: { settings: Settings; schedule: Schedule }) {
  const words = useWords()
  const wake = parseTime(settings.wakeTime)
  let sleep = parseTime(settings.sleepTime)
  if (sleep <= wake) sleep += 1440
  const height = ((sleep - wake) / 60) * HOUR_PX
  const hours: number[] = []
  for (let m = Math.ceil(wake / 60) * 60; m <= sleep; m += 60) hours.push(m)
  const days: Day[] = [0, 1, 2, 3, 4, 5, 6]

  return (
    <Unit name={words.printers.plotter.name} spec={words.printers.plotter.spec}>
      {/* Seven columns don't fit a phone: the sheet scrolls sideways on its own, the page doesn't. */}
      <div className="overflow-x-auto">
        <div aria-label="A sample week, plotted" role="img" className="sheet min-w-[620px] px-5 py-4 font-mono uppercase sm:px-10">
          <div className="mb-2 flex items-baseline justify-between border-b border-ink/60 pb-1 text-[11px] tracking-[0.2em]">
            <span className="font-display text-[15px] font-semibold tracking-[0.3em]">{words.name}</span>
            <span className="text-ink/60">Sample week · Plot</span>
          </div>
          <div className="flex">
            <div className="w-12 shrink-0">
              <div className="h-7 border-b border-ink/40" />
              <div className="relative" style={{ height }}>
                {hours.map((m) => (
                  <div key={m} className="absolute right-2 text-[10px] tabular-nums text-ink/55" style={{ top: ((m - wake) / 60) * HOUR_PX - 5 }}>
                    {formatClock(m, "24h")}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid flex-1 grid-cols-7">
              {days.map((day) => (
                <div key={day} className="border-l border-ink/40">
                  <div className="flex h-7 items-center justify-center border-b border-ink/40 text-[11px] tracking-[0.2em]">
                    {DAY_NAMES[day]}
                  </div>
                  <div className="relative" style={{ height }}>
                    {hours.map((m) => (
                      <div key={m} className="absolute inset-x-0 border-t border-dashed border-ink/20" style={{ top: ((m - wake) / 60) * HOUR_PX }} />
                    ))}
                    {schedule.blocks
                      .filter((b) => b.day === day)
                      .map((b) => (
                        <PlottedBlock key={b.id} block={b} wake={wake} />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Unit>
  )
}

function PlottedBlock({ block, wake }: { block: PlacedBlock; wake: number }) {
  const top = ((block.startMinute - wake) / 60) * HOUR_PX
  const height = ((block.endMinute - block.startMinute) / 60) * HOUR_PX
  const drawn = Math.max(height - 2, 13)
  const short = drawn < 26
  return (
    <div
      className={`absolute inset-x-[3px] overflow-hidden border-[1.5px] border-ink bg-sheet px-1.5 ${short ? "flex items-center" : "py-1"}`}
      style={{ top: top + 1, height: drawn }}
    >
      <div className={`truncate leading-[1.15] tracking-[0.06em] ${short ? "text-[8.5px]" : "text-[10px]"}`}>{block.name}</div>
      {height >= 36 && (
        <div className="text-[9px] tabular-nums opacity-65">
          {formatClock(block.startMinute, "24h")}–{formatClock(block.endMinute, "24h")}
        </div>
      )}
    </div>
  )
}

/** One day off the ticket printer, as a receipt to pocket. */
function SampleTicket({ settings, schedule }: { settings: Settings; schedule: Schedule }) {
  const words = useWords()
  const wake = parseTime(settings.wakeTime)
  let sleep = parseTime(settings.sleepTime)
  if (sleep <= wake) sleep += 1440
  const activityIds = new Set(settings.activities.map((a) => a.id))
  const blocks = schedule.blocks.filter((b) => b.day === TICKET_DAY)
  const tasks = blocks.filter((b) => activityIds.has(b.activityId))
  const planned = tasks.reduce((sum, b) => sum + b.endMinute - b.startMinute, 0)

  return (
    // On a phone the ticket comes first: it reads whole there, where the week has to scroll sideways.
    <Unit name={words.printers.ticket.name} spec={words.printers.ticket.spec} className="max-lg:order-first">
      <div className="px-4">
        <div className="ticket px-6 pb-7 pt-5 font-mono text-[12px] uppercase leading-relaxed">
          <div className="text-center">
            <div className="font-display text-[16px] font-semibold tracking-[0.3em]">{words.name}</div>
            <div className="tracking-[0.18em] text-ink/60">{words.sheet.ticket}</div>
            <div className="mt-1 tracking-[0.12em]">Wednesday · Sample</div>
          </div>
          <Cut />
          <ol>
            {dayTimeline(blocks, wake, sleep).map((row) => (
              <li key={row.kind === "block" ? row.block.id : row.kind} className={`flex gap-2 py-0.5 ${row.kind === "block" ? "" : "text-ink/60"}`}>
                <span className="w-12 shrink-0 tabular-nums">{formatClock(row.minute, "24h")}</span>
                <span className="min-w-0 flex-1 truncate">{row.kind === "block" ? row.block.name : row.kind}</span>
                {row.kind === "block" && <span className="tabular-nums">{formatSpan(row.block.endMinute - row.block.startMinute)}</span>}
              </li>
            ))}
          </ol>
          <Cut />
          <div className="flex justify-between">
            <span>Tasks</span>
            <span className="tabular-nums">{tasks.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Planned</span>
            <span className="tabular-nums">{formatSpan(planned)}</span>
          </div>
          <Cut />
          <div className="text-center text-[11px] tracking-[0.16em] text-ink/55">{words.sheet.motto}</div>
        </div>
      </div>
    </Unit>
  )
}

function Cut() {
  return <div aria-hidden className="my-3 border-t border-dashed border-ink/50" />
}

const STEPS = [
  { title: "List it", body: "Everything you want to do: a name, how long, how many times a week. Three fields a line." },
  { title: "Set your hours", body: "When you wake, when you sleep, and the meals to keep. Days, travel time and preferred times if you like." },
  { title: "Get your week", body: "Every session placed, nothing double-booked. Lock what's right, shuffle the rest. Print it, or export it to your calendar." },
]

/** The machine's three requests, as plates on the panel. */
function Steps() {
  return (
    <section className="border-y-2 border-ink bg-[#cdc5b1]">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-14 sm:px-6 sm:py-20">
        <SectionHead eyebrow="How it works" title="Decide once. Then stop deciding." />
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative border-2 border-ink bg-paper p-6">
              {["left-1.5 top-1.5", "right-1.5 top-1.5", "left-1.5 bottom-1.5", "right-1.5 bottom-1.5"].map((at) => (
                <span key={at} aria-hidden className={`absolute h-1 w-1 rounded-full bg-ink/45 ${at}`} />
              ))}
              <p className="label text-ink/55">Request 0{i + 1}</p>
              <h3 className="mt-2 font-display text-[18px] font-semibold uppercase tracking-[0.08em]">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink/75">{step.body}</p>
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
  { title: "Yours to keep", body: "Print the week, pocket today's ticket, or export it to Google Calendar, Apple Calendar or Outlook." },
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
            <p className="mt-3 text-[15px] leading-relaxed text-sheet/70">{p.body}</p>
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
      <p className="mx-auto mt-3 max-w-[32rem] text-[16px] leading-relaxed text-ink/75">
        Tell Robot Mode what you want to do. It figures out when.
      </p>
      <a href={START} className="key key-dark mt-8 inline-block px-8 py-3.5 text-[14px]!">
        Build my week ▶
      </a>
      <p className="label mt-4 text-[12px] text-ink/70">No AI · Private</p>
    </section>
  )
}
