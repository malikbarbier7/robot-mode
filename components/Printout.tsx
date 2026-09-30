"use client"

import { useState } from "react"
import type { Day, Schedule, Settings } from "@/lib/types"
import { formatTime, parseTime } from "@/lib/scheduler/time"
import { formatDuration } from "@/lib/duration"
import { dayTimeline, isoWeek } from "@/lib/printout"

const DAYS: Day[] = [0, 1, 2, 3, 4, 5, 6]
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

/**
 * The week as the machine prints it: a timetable on continuous-feed paper,
 * one day after another. Blocks can still be picked, to lock or remove them.
 */
export function Printout({
  settings,
  schedule,
  selectedId,
  onSelect,
}: {
  settings: Settings
  schedule: Schedule
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  // Stamped once, when the sheet comes out of the machine.
  const [printedAt] = useState(() => new Date())
  const { week, year } = isoWeek(printedAt)

  const wake = parseTime(settings.wakeTime)
  let sleep = parseTime(settings.sleepTime)
  if (sleep <= wake) sleep += 1440

  return (
    <div className="px-4 py-10 sm:px-6">
      <div className="mx-auto mb-3 flex max-w-[680px] justify-between gap-4 no-print">
        <span className="label text-ink/55">Output · printer 01</span>
        <button type="button" onClick={() => window.print()} className="key px-4 py-1.5">
          Print
        </button>
      </div>

      <article className="sheet mx-auto max-w-[680px] px-12 py-10 font-mono text-[13px] uppercase leading-relaxed sm:px-16">
        <Rule char="=" />
        <header className="py-3 text-center">
          <div className="font-display text-[20px] font-semibold tracking-[0.3em]">Robot Mode</div>
          <div className="tracking-[0.2em] text-ink/60">
            Week {week} / {year}
          </div>
        </header>
        <Rule char="=" />

        {DAYS.map((day, i) => (
          <section key={day} className="mt-7">
            {i > 0 && <Rule char="-" className="mb-7" />}
            <h2 className="font-semibold tracking-[0.2em]">{DAY_NAMES[day]}</h2>
            <ol className="mt-3">
              {dayTimeline(
                schedule.blocks.filter((b) => b.day === day),
                wake,
                sleep,
              ).map((row) => {
                const time = <span className="w-16 shrink-0 tabular-nums">{formatTime(row.minute)}</span>
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
                          {formatDuration(block.endMinute - block.startMinute)}
                        </span>
                      </button>
                    </li>
                  )
                }
                return (
                  <li
                    key={`${row.kind}-${row.minute}`}
                    className={`flex items-baseline gap-2 ${row.kind === "free" ? "text-ink/40" : ""}`}
                  >
                    {time}
                    <span className="flex-1">{row.kind === "free" ? "Free time" : row.kind}</span>
                    {row.kind === "free" && <span className="tabular-nums">{formatDuration(row.minutes)}</span>}
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
            {formatTime(printedAt.getHours() * 60 + printedAt.getMinutes())}
          </div>
          <div>Unit RM-01</div>
        </footer>
      </article>
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
