"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import type { Schedule, Settings } from "@/lib/types"
import { parseTime } from "@/lib/scheduler/time"
import { formatClock, formatSpan, weekOrder } from "@/lib/locale"
import { dayTimeline, isoWeek } from "@/lib/printout"
import { useDisplay } from "./Display"
import { Printer } from "./Printer"

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

/**
 * The week as the machine prints it: a timetable on continuous-feed paper,
 * one day after another. Blocks can still be picked, to lock or remove them.
 *
 * With `feed`, the sheet is printed in front of you first: it feeds out of
 * the printer's slot a line at a time while the head shuttles. The page stays
 * where it is.
 */
export function Printout({
  settings,
  schedule,
  selectedId,
  onSelect,
  feed = false,
  onFed,
  onReplay,
}: {
  settings: Settings
  schedule: Schedule
  selectedId: string | null
  onSelect: (id: string | null) => void
  feed?: boolean
  onFed?: () => void
  /** Print it again (the printer's Form feed key). */
  onReplay?: () => void
}) {
  const sheet = useRef<HTMLElement>(null)
  const { shift, finish } = usePaperFeed(sheet, feed, onFed)
  const printing = shift !== null

  // Stamped once, when the sheet comes out of the machine.
  const { clock, weekStart } = useDisplay()
  const [printedAt] = useState(() => new Date())
  const { week, year } = isoWeek(printedAt)

  const wake = parseTime(settings.wakeTime)
  let sleep = parseTime(settings.sleepTime)
  if (sleep <= wake) sleep += 1440

  return (
    <div className="px-4 py-10 sm:px-6">
      <Printer printing={printing} onPrint={() => window.print()} onFormFeed={() => onReplay?.()} />

      {/* A click on the paper while it prints finishes it. */}
      {/* While printing, the paper still inside the printer (above the slot) is hidden. */}
      <div
        className={`relative mx-auto max-w-[680px] ${printing ? "overflow-hidden" : ""}`}
        onPointerDown={() => printing && finish()}
      >
      <article
        ref={sheet}
        style={printing ? { transform: `translateY(${shift}px)` } : undefined}
        className="sheet px-12 py-10 font-mono text-[13px] uppercase leading-relaxed sm:px-16"
      >
        <Rule char="=" />
        <header className="py-3 text-center">
          <div className="font-display text-[20px] font-semibold tracking-[0.3em]">Robot Mode</div>
          <div className="tracking-[0.2em] text-ink/60">
            Week {week} / {year}
          </div>
        </header>
        <Rule char="=" />

        {weekOrder(weekStart).map((day, i) => (
          <section key={day} className="mt-7">
            {i > 0 && <Rule char="-" className="mb-7" />}
            <h2 className="font-semibold tracking-[0.2em]">{DAY_NAMES[day]}</h2>
            <ol className="mt-3">
              {dayTimeline(
                schedule.blocks.filter((b) => b.day === day),
                wake,
                sleep,
              ).map((row) => {
                const time = (
                  <span className={`${clock === "12h" ? "w-24" : "w-16"} shrink-0 tabular-nums`}>
                    {formatClock(row.minute, clock)}
                  </span>
                )
                if (row.kind === "block") {
                  const { block } = row
                  const picked = block.id === selectedId
                  return (
                    <li key={block.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(picked ? null : block.id)}
                        className={`-mx-2 flex w-[calc(100%+1rem)] items-baseline gap-2 px-2 text-left uppercase ${
                          picked ? "bg-ink text-paper" : "hover:bg-ink/[0.07]"
                        }`}
                      >
                        {time}
                        <span className="min-w-0 flex-1 truncate">
                          {block.name}
                          {block.locked && " ■"}
                        </span>
                        <span className={`tabular-nums ${picked ? "" : "text-ink/45"}`}>
                          {formatSpan(block.endMinute - block.startMinute)}
                        </span>
                      </button>
                    </li>
                  )
                }
                return (
                  <li key={`${row.kind}-${row.minute}`} className="flex items-baseline gap-2">
                    {time}
                    <span className="flex-1">{row.kind}</span>
                  </li>
                )
              })}
            </ol>
          </section>
        ))}

        {schedule.unplaced.length > 0 && (
          <section className="mt-7">
            <Rule char="-" className="mb-7" />
            <h2 className="font-semibold tracking-[0.2em] text-alert">Unresolved</h2>
            <ol className="mt-3">
              {schedule.unplaced.map((u) => (
                <li key={u.activityId} className="flex gap-2">
                  <span className="w-16 shrink-0 tabular-nums">
                    {u.sessionsPlaced}/{u.sessionsRequested}
                  </span>
                  <span>{u.name}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <Rule char="=" className="mt-10" />
        <footer className="pt-3 text-[11px] tracking-[0.14em] text-ink/55">
          <div>Automatically generated</div>
          <div className="tabular-nums">
            {String(printedAt.getDate()).padStart(2, "0")} {MONTHS[printedAt.getMonth()]} {printedAt.getFullYear()} ·{" "}
            {formatClock(printedAt.getHours() * 60 + printedAt.getMinutes(), clock)}
          </div>
          <div>Unit RM-01</div>
        </footer>
      </article>
      </div>
    </div>
  )
}

/** A line of repeated characters, the way an impact printer draws a rule. */
function Rule({ char, className = "" }: { char: string; className?: string }) {
  return (
    <div aria-hidden className={`overflow-hidden whitespace-nowrap leading-none text-ink/60 ${className}`}>
      {char.repeat(200)}
    </div>
  )
}

/** One printed line, roughly: the paper advances in steps of this, like a dot-matrix. */
const LINE_PX = 22
/** Feed speed, with the whole sheet kept between 2 and 5 seconds. */
const FEED_PX_PER_SEC = 650

/**
 * Runs the printing animation while `active`, as paper feeding out of the
 * slot: `shift` is how far the sheet sits above its resting place (px, zero or
 * negative), stepping down a line at a time, or null when it isn't printing.
 * The bottom leaves the slot first, so the text reads upright as it descends
 * and the header lands last. The page is left where it is. Any key, or
 * `finish()`, completes it at once; reduced motion skips it entirely.
 */
function usePaperFeed(
  sheet: RefObject<HTMLElement | null>,
  active: boolean,
  onDone?: () => void,
): { shift: number | null; finish: () => void } {
  const [shift, setShift] = useState<number | null>(null)
  const done = useRef(onDone)
  const stop = useRef<() => void>(() => {})
  useEffect(() => {
    done.current = onDone
  })

  useEffect(() => {
    const el = sheet.current
    if (!active || !el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      done.current?.()
      return
    }

    const height = el.offsetHeight
    const duration = Math.min(Math.max((height / FEED_PX_PER_SEC) * 1000, 2000), 5000)
    const start = performance.now()
    let frame = 0
    let settle = 0
    let stopped = false

    const finish = () => {
      if (stopped) return
      stopped = true
      cancelAnimationFrame(frame)
      clearTimeout(settle)
      window.removeEventListener("keydown", finish)
      setShift(null)
      done.current?.()
    }
    stop.current = finish
    window.addEventListener("keydown", finish)

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const fed = Math.min(Math.ceil((progress * height) / LINE_PX) * LINE_PX, height)
      setShift(fed - height)
      if (progress < 1) frame = requestAnimationFrame(tick)
      else settle = window.setTimeout(finish, 400)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      clearTimeout(settle)
      window.removeEventListener("keydown", finish)
    }
  }, [active, sheet])

  // Still inside the printer from the moment printing is asked for, so the full sheet never flashes first.
  return { shift: shift ?? (active ? -100_000 : null), finish: () => stop.current() }
}
