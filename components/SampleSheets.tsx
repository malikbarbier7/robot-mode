"use client"

import type { ReactNode } from "react"
import { useWords } from "@/lib/words"
import type { Day, PlacedBlock, Schedule, Settings } from "@/lib/types"
import { DAY_NAMES, parseTime } from "@/lib/scheduler/time"
import { formatClock, formatSpan } from "@/lib/locale"
import { dayTimeline } from "@/lib/printout"

/**
 * A week the machine has solved, as it comes out of it: the plotter's chart
 * and one day's ticket, at a fixed scale, drawn the way the app prints them.
 * Used wherever a sample week is shown off the machine (the landing page, the
 * guides), always from the real engine's output.
 */

const FULL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

/** An output unit's lid, nameplate and spec, with the paper coming out under it. */
function Unit({ name, spec, className = "", children }: { name: string; spec: string; className?: string; children: ReactNode }) {
  return (
    <figure className={`min-w-0 ${className}`}>
      <div className="flex items-center justify-between gap-4 border border-black bg-[#2a2620] px-4 py-1.5">
        <span className="label border border-paper/40 px-2 py-0.5 text-paper/85">{name}</span>
        <span className="label text-paper/70">{spec}</span>
      </div>
      <div className="h-2 border-x border-b border-black bg-[#c9c1ad]" />
      {children}
    </figure>
  )
}

const HOUR_PX = 22

/** The plotter's chart of the week, as the app draws it, at a fixed scale. */
export function PlottedWeek({ settings, schedule, label = "Sample week" }: { settings: Settings; schedule: Schedule; label?: string }) {
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
            <span className="text-ink/70">{label} · Plot</span>
          </div>
          <div className="flex">
            <div className="w-12 shrink-0">
              <div className="h-7 border-b border-ink/40" />
              <div className="relative" style={{ height }}>
                {hours.map((m) => (
                  <div key={m} className="absolute right-2 text-[10px] tabular-nums text-ink/70" style={{ top: ((m - wake) / 60) * HOUR_PX - 5 }}>
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
export function SampleTicket({ settings, schedule, day }: { settings: Settings; schedule: Schedule; day: Day }) {
  const words = useWords()
  const wake = parseTime(settings.wakeTime)
  let sleep = parseTime(settings.sleepTime)
  if (sleep <= wake) sleep += 1440
  const activityIds = new Set(settings.activities.map((a) => a.id))
  const blocks = schedule.blocks.filter((b) => b.day === day)
  const tasks = blocks.filter((b) => activityIds.has(b.activityId))
  const planned = tasks.reduce((sum, b) => sum + b.endMinute - b.startMinute, 0)

  return (
    // On a phone the ticket comes first: it reads whole there, where the week has to scroll sideways.
    <Unit name={words.printers.ticket.name} spec={words.printers.ticket.spec} className="max-lg:order-first">
      <div className="px-4">
        <div className="ticket px-6 pb-7 pt-5 font-mono text-[12px] uppercase leading-relaxed">
          <div className="text-center">
            <div className="font-display text-[16px] font-semibold tracking-[0.3em]">{words.name}</div>
            <div className="tracking-[0.18em] text-ink/70">{words.sheet.ticket}</div>
            <div className="mt-1 tracking-[0.12em]">{FULL_DAYS[day]} · Sample</div>
          </div>
          <Cut />
          <ol>
            {dayTimeline(blocks, wake, sleep).map((row) => (
              <li key={row.kind === "block" ? row.block.id : row.kind} className={`flex gap-2 py-0.5 ${row.kind === "block" ? "" : "text-ink/70"}`}>
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
          <div className="text-center text-[11px] tracking-[0.16em] text-ink/70">{words.sheet.motto}</div>
        </div>
      </div>
    </Unit>
  )
}

function Cut() {
  return <div aria-hidden className="my-3 border-t border-dashed border-ink/50" />
}
