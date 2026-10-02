"use client"

import { useWords } from "@/lib/words"
import { useState } from "react"
import type { Schedule, Settings } from "@/lib/types"
import { parseTime } from "@/lib/scheduler/time"
import { formatClock, formatSpan, weekOrder } from "@/lib/locale"
import { dayTimeline, isoWeek } from "@/lib/printout"
import { useDisplay } from "./Display"
import { Paper } from "./Paper"

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
  onTear,
  tearing = false,
  empty = false,
  filed,
}: {
  settings: Settings
  schedule: Schedule
  selectedId: string | null
  onSelect: (id: string | null) => void
  feed?: boolean
  onFed?: () => void
  /** Print it again (the printer's Form feed key). */
  onReplay?: () => void
  onTear?: () => void
  tearing?: boolean
  /** Torn off and not printed again yet: the printer stands empty. */
  empty?: boolean
  /** A sheet from the binder: its own week, the date it was filed, and no printer above it. */
  filed?: { week: number; year: number; at: Date }
}) {
  // Stamped once, when the sheet comes out of the machine (or with the week it was filed as).
  const { clock, weekStart } = useDisplay()
  const words = useWords()
  const [now] = useState(() => new Date())
  const printedAt = filed?.at ?? now
  const { week, year } = filed ?? isoWeek(printedAt)

  const wake = parseTime(settings.wakeTime)
  let sleep = parseTime(settings.sleepTime)
  if (sleep <= wake) sleep += 1440

  return (
    <Paper
      width="max-w-[680px]"
      className="sheet px-6 py-8 font-mono text-[13px] uppercase leading-relaxed sm:px-16 sm:py-10"
      feed={feed}
      onFed={onFed}
      onReplay={onReplay}
      onTear={onTear}
      tearing={tearing}
      empty={empty}
      bare={!!filed}
    >
        <Rule char="=" />
        <header className="py-3 text-center">
          <div className="font-display text-[20px] font-semibold tracking-[0.3em]">{words.name}</div>
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
          <div>{filed ? words.sheet.filed : words.sheet.generated}</div>
          <div className="tabular-nums">
            {String(printedAt.getDate()).padStart(2, "0")} {MONTHS[printedAt.getMonth()]} {printedAt.getFullYear()} ·{" "}
            {formatClock(printedAt.getHours() * 60 + printedAt.getMinutes(), clock)}
          </div>
          <div>{words.sheet.unit}</div>
        </footer>
    </Paper>
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
