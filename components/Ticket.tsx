"use client"

import type { Schedule, Settings } from "@/lib/types"
import { parseTime } from "@/lib/scheduler/time"
import { formatClock, formatSpan } from "@/lib/locale"
import { dayTimeline } from "@/lib/printout"
import { momentOf } from "@/lib/today"
import { useDisplay } from "./Display"
import { Paper } from "./Paper"

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

/**
 * Today, as a receipt from the machine's ticket printer: the day's lines,
 * what is on now, and what has been done. Small enough to keep on a phone or
 * print and pocket. Blocks can be picked, as on the other views.
 */
export function Ticket({
  settings,
  schedule,
  now,
  doneIds,
  selectedId,
  onSelect,
  feed = false,
  onFed,
  onReplay,
}: {
  settings: Settings
  schedule: Schedule
  /** The current time; the ticket follows it, line by line. */
  now: Date
  doneIds: Set<string>
  selectedId: string | null
  onSelect: (id: string | null) => void
  feed?: boolean
  onFed?: () => void
  onReplay?: () => void
}) {
  const { clock } = useDisplay()
  const moment = momentOf(now)
  const wake = parseTime(settings.wakeTime)
  let sleep = parseTime(settings.sleepTime)
  if (sleep <= wake) sleep += 1440

  const activityIds = new Set(settings.activities.map((a) => a.id))
  const blocks = schedule.blocks.filter((b) => b.day === moment.day)
  const tasks = blocks.filter((b) => activityIds.has(b.activityId))
  const done = tasks.filter((b) => doneIds.has(b.id)).length
  const planned = tasks.reduce((sum, b) => sum + b.endMinute - b.startMinute, 0)

  return (
    <Paper
      printer={{ name: "RM-01 · Ticket", spec: "Thermal · 58 mm", width: "max-w-[460px]" }}
      width="max-w-[360px]"
      className="ticket px-7 pb-8 pt-6 font-mono text-[12px] uppercase leading-relaxed"
      feed={feed}
      onFed={onFed}
      onReplay={onReplay}
    >
      <header className="text-center">
        <div className="font-display text-[16px] font-semibold tracking-[0.3em]">Robot Mode</div>
        <div className="tracking-[0.18em] text-ink/60">Daily ticket</div>
        <div className="mt-1 tracking-[0.12em]">
          {DAYS[moment.day]} {String(now.getDate()).padStart(2, "0")} {MONTHS[now.getMonth()]} {now.getFullYear()}
        </div>
      </header>
      <Cut />

      <ol>
        {dayTimeline(blocks, wake, sleep).map((row) => {
          const time = <span className={`${clock === "12h" ? "w-[4.5rem]" : "w-12"} shrink-0 tabular-nums`}>{formatClock(row.minute, clock)}</span>
          if (row.kind !== "block") {
            return (
              <li key={row.kind} className="flex gap-2 py-0.5 text-ink/60">
                {time}
                <span>{row.kind}</span>
              </li>
            )
          }
          const { block } = row
          const live = block.startMinute <= moment.minute && moment.minute < block.endMinute
          const past = block.endMinute <= moment.minute
          const isDone = doneIds.has(block.id)
          const picked = block.id === selectedId
          return (
            <li key={block.id}>
              <button
                type="button"
                onClick={() => onSelect(picked ? null : block.id)}
                className={`-mx-2 flex w-[calc(100%+1rem)] items-baseline gap-2 px-2 py-0.5 text-left uppercase ${
                  picked || live ? "bg-ink text-paper" : past ? "text-ink/45 hover:bg-ink/[0.07]" : "hover:bg-ink/[0.07]"
                }`}
              >
                {time}
                <span className="min-w-0 flex-1 truncate">
                  {block.name}
                  {block.locked && " ■"}
                </span>
                <span className="tabular-nums">
                  {isDone ? "✓ " : live ? "◀ " : ""}
                  {live ? `${formatSpan(block.endMinute - moment.minute)} left` : formatSpan(block.endMinute - block.startMinute)}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <Cut />
      <div className="flex justify-between">
        <span>Tasks</span>
        <span className="tabular-nums">
          {done} / {tasks.length} done
        </span>
      </div>
      <div className="flex justify-between">
        <span>Planned</span>
        <span className="tabular-nums">{formatSpan(planned)}</span>
      </div>
      <Cut />
      <div className="text-center text-[11px] tracking-[0.16em] text-ink/55">Wake · Execute · Sleep · Repeat</div>
    </Paper>
  )
}

/** A dashed line across the ticket, the way a receipt separates its parts. */
function Cut() {
  return <div aria-hidden className="my-3 border-t border-dashed border-ink/50" />
}
