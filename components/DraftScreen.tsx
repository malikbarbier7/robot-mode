"use client"

import { useEffect, useRef, useState } from "react"
import type { PlacedBlock } from "@/lib/types"
import type { RobotMode } from "@/lib/useRobotMode"
import { DAY_NAMES } from "@/lib/scheduler/time"
import { formatClock, formatSpan, weekOrder } from "@/lib/locale"
import { dayTimeline, isoWeek } from "@/lib/printout"
import { beep } from "@/lib/sound"
import { useDisplay } from "./Display"
import { Console, SCREEN_HEIGHT } from "./Machine"
import { REVEAL_DAY_MS, WeekChart, dayBounds, useHourFit } from "./WeekGrid"

/**
 * The draft: the week on the machine's screen. It only shows: the week is
 * changed from the terminal (move, lock, remove, edit…), and every change
 * re-solves it here, live. The sessions an edit moved flash, so the re-solve
 * can be followed. The paper only changes on PRINT.
 *
 * With `reveal`, the week is drawn in a day at a time; any key or a click
 * finishes it. On a phone the screen lists the week instead.
 */
export function DraftScreen({
  rm,
  phone,
  reveal,
  onRevealed,
}: {
  rm: RobotMode
  phone: boolean
  reveal: boolean
  onRevealed: () => void
}) {
  const settings = rm.state.settings
  const blocks = rm.schedule.blocks
  // The screen is the same size as every other one; the hours fit what the line beneath them leaves.
  const frame = useRef<HTMLDivElement>(null)
  const hourPx = useHourFit(frame, settings)
  const { wake, sleep } = dayBounds(settings)
  const never = rm.state.printed === null
  const { weekStart } = useDisplay()

  // The reveal paces itself, a tick a column; any key finishes it. When the last column is drawn, the week is the user's.
  useEffect(() => {
    if (!reveal) return
    const ticks = weekOrder(weekStart).map((_, i) => window.setTimeout(() => beep(660 + i * 70, 0.03), i * REVEAL_DAY_MS))
    const done = window.setTimeout(onRevealed, 7 * REVEAL_DAY_MS + 500)
    const skip = (e: KeyboardEvent) => {
      e.preventDefault()
      onRevealed()
    }
    window.addEventListener("keydown", skip)
    return () => {
      ticks.forEach(clearTimeout)
      clearTimeout(done)
      window.removeEventListener("keydown", skip)
    }
  }, [reveal, onRevealed, weekStart])

  const changed = useMovedSessions(blocks, reveal)

  const { week } = isoWeek(new Date())

  return (
    <div className="no-print">
      <Console
        captions={[
          `Draft · week ${week}`,
          <span key="paper" className={rm.unprinted && !never ? "text-alert" : ""}>
            {never ? "Not printed yet" : rm.unprinted ? "Changed since printed · Print to update" : "Same as the paper"}
          </span>,
        ]}
      >
        <div data-room className={`${SCREEN_HEIGHT} sm:overflow-hidden`}>
        <div ref={frame} onClick={reveal ? onRevealed : undefined} className="font-mono uppercase">
          {phone ? (
            <DraftList blocks={blocks} wake={wake} sleep={sleep} reveal={reveal} changed={changed} />
          ) : (
            <WeekChart settings={settings} blocks={blocks} hourPx={hourPx} screen changed={changed} reveal={reveal} />
          )}

          {/* Changing and printing are the keyboard's: the screen only says so. */}
          <div className="mt-3 border-t border-ink/40 pt-2 font-crt text-[17px] tracking-[0.08em] text-ink/50 sm:text-[19px]">
            {reveal ? "Drawing the week · any key to skip" : "Change it from the keyboard: type a function, or HELP · PRINT puts it on paper"}
          </div>
        </div>
        </div>
      </Console>
    </div>
  )
}

/** On a phone: the draft as a list, a day after another. */
function DraftList({
  blocks,
  wake,
  sleep,
  reveal,
  changed,
}: {
  blocks: PlacedBlock[]
  wake: number
  sleep: number
  reveal: boolean
  changed: ReadonlySet<string>
}) {
  const { clock, weekStart } = useDisplay()
  return (
    <div className="space-y-3 text-[13px]">
      {weekOrder(weekStart).map((day, column) => (
        <section key={day}>
          <h3 className="border-b border-dashed border-ink/30 tracking-[0.2em] text-ink/60">{DAY_NAMES[day]}</h3>
          <ol>
            {dayTimeline(blocks.filter((b) => b.day === day), wake, sleep).map((row, i) =>
              row.kind === "block" ? (
                <li
                  key={row.block.id}
                  className={`flex items-baseline gap-2 px-1 ${changed.has(row.block.id) ? "changed" : ""} ${reveal ? "draw-in" : ""}`}
                  style={reveal ? { animationDelay: `${column * REVEAL_DAY_MS + i * 40}ms` } : undefined}
                >
                  <span className="w-14 shrink-0 tabular-nums">{formatClock(row.minute, clock)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {row.block.name}
                    {row.block.locked && " ■"}
                  </span>
                  <span className="tabular-nums opacity-70">{formatSpan(row.block.endMinute - row.block.startMinute)}</span>
                </li>
              ) : null,
            )}
          </ol>
        </section>
      ))}
    </div>
  )
}

/**
 * The sessions whose place changed since the week was last drawn: what an
 * edit, and the re-solve after it, moved. Cleared once they have flashed.
 */
function useMovedSessions(blocks: PlacedBlock[], paused: boolean): ReadonlySet<string> {
  const last = useRef<Map<string, string> | null>(null)
  const [changed, setChanged] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    const now = new Map(blocks.map((b) => [b.id, `${b.day}|${b.startMinute}|${b.endMinute}`]))
    const before = last.current
    last.current = now
    if (!before || paused) return
    const moved = new Set([...now].filter(([id, at]) => before.get(id) !== at).map(([id]) => id))
    if (moved.size === 0) return
    // Deferred a tick: the flash is a reaction to the edit, drawn after it.
    const show = window.setTimeout(() => setChanged(moved), 0)
    const clear = window.setTimeout(() => setChanged(new Set()), 950)
    return () => {
      clearTimeout(show)
      clearTimeout(clear)
    }
  }, [blocks, paused])
  return changed
}
