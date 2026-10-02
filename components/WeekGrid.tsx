"use client"

import { useWords } from "@/lib/words"
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import type { Day, PlacedBlock, Schedule, Settings } from "@/lib/types"
import { DAY_NAMES, parseTime } from "@/lib/scheduler/time"
import { formatClock, localizeTimes, weekOrder } from "@/lib/locale"
import { isoWeek } from "@/lib/printout"
import { useDisplay } from "./Display"
import { Paper } from "./Paper"

/** An hour's height when there is room to spare, and the least it may shrink to. */
const MAX_HOUR_PX = 34
const MIN_HOUR_PX = 16

/**
 * The week as the plotter draws it: a chart on the same continuous paper as
 * the printout, so both views come out of the machine. Picking a session goes
 * to it on the screen, as on the printout.
 */
export function WeekGrid({
  settings,
  schedule,
  selectedId,
  onSelect,
  feed = false,
  onFed,
  onTear,
  tearing = false,
  empty = false,
  never = false,
  onFormFeed,
  filed,
}: {
  settings: Settings
  schedule: Schedule
  selectedId: string | null
  onSelect: (id: string | null) => void
  feed?: boolean
  onFed?: () => void
  onTear?: () => void
  tearing?: boolean
  /** Torn off and not printed again yet: the printer stands empty. */
  empty?: boolean
  /** Nothing printed yet: the week is still a draft on the screen. */
  never?: boolean
  /** The empty slot's PRINT key. */
  onFormFeed?: () => void
  /** A sheet from the binder: its own week, and no plotter above it. */
  filed?: { week: number; year: number }
}) {
  const frame = useRef<HTMLDivElement>(null)
  const hourPx = useHourFit(frame, settings)
  const [now] = useState(() => isoWeek(new Date()))
  const { week, year } = filed ?? now
  const words = useWords()

  return (
    <div ref={frame}>
    <Paper
      compact
      // The plotter is never narrower than its chart, so on a phone the two scroll sideways together.
      printer={{ ...words.printers.plotter, width: "max-w-[1080px] min-w-[620px] sm:min-w-[700px]" }}
      width="max-w-[1000px] min-w-[620px] sm:min-w-[700px]"
      className="sheet px-5 py-4 font-mono uppercase sm:px-12"
      feed={feed}
      onFed={onFed}
      onTear={onTear}
      tearing={tearing}
      empty={empty}
      never={never}
      onFormFeed={onFormFeed}
      bare={!!filed}
    >
      <div className="mb-2 flex items-baseline justify-between border-b border-ink/60 pb-1 text-[11px] tracking-[0.2em]">
        <span className="font-display text-[15px] font-semibold tracking-[0.3em]">{words.name}</span>
        <span className="text-ink/60">
          Week {week} / {year} · Plot
        </span>
      </div>
      <WeekChart settings={settings} blocks={schedule.blocks} hourPx={hourPx} selectedId={selectedId} onSelect={onSelect} />
    </Paper>
    </div>
  )
}

/**
 * An hour's height, as tall as the room allows, so the whole day fits above
 * the terminal without scrolling. `frame` is everything drawn around the
 * chart (printer, margins, headings); only the hours give.
 */
export function useHourFit(frame: RefObject<HTMLElement | null>, settings: Pick<Settings, "wakeTime" | "sleepTime">): number {
  const { wake, sleep } = dayBounds(settings)
  const hoursAwake = (sleep - wake) / 60
  const [hourPx, setHourPx] = useState(MAX_HOUR_PX)
  useLayoutEffect(() => {
    const el = frame.current
    const room = el?.closest("main")
    if (!el || !room) return
    const fit = () => {
      // Everything that isn't the hours (printer, margins, headings, anything above the grid) stays as it is.
      const body = el.querySelector<HTMLElement>("[data-hours]")?.offsetHeight ?? 0
      const above = el.getBoundingClientRect().top - room.getBoundingClientRect().top + room.scrollTop
      const chrome = el.offsetHeight - body + above
      const next = Math.floor((room.clientHeight - chrome - 4) / hoursAwake)
      setHourPx(Math.min(MAX_HOUR_PX, Math.max(MIN_HOUR_PX, next)))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(room)
    return () => observer.disconnect()
  }, [frame, hoursAwake])
  return hourPx
}

/** Wake and sleep as minutes from midnight; a bedtime after midnight runs past 1440. */
export function dayBounds(settings: Pick<Settings, "wakeTime" | "sleepTime">): { wake: number; sleep: number } {
  const wake = parseTime(settings.wakeTime)
  let sleep = parseTime(settings.sleepTime)
  if (sleep <= wake) sleep += 1440
  return { wake, sleep }
}

/** Where a session would go while it is being moved on the screen. */
export type Ghost = { day: Day; startMinute: number; endMinute: number; name: string; refused?: boolean }

/**
 * The week as seven columns of hours: drawn in pen on the plotter's paper,
 * or in phosphor on the screen (`screen`), where the draft is edited. Only the
 * screen draws a session being moved (`ghost`), flashes the sessions the
 * last edit moved (`changed`), draws the week in a day at a time (`reveal`),
 * and opens the picked session's keys beside it (`picked`).
 */
export function WeekChart({
  settings,
  blocks,
  hourPx,
  selectedId,
  onSelect,
  screen = false,
  ghost,
  changed,
  reveal = false,
  picked,
}: {
  settings: Pick<Settings, "wakeTime" | "sleepTime">
  blocks: PlacedBlock[]
  hourPx: number
  selectedId: string | null
  onSelect: (id: string | null) => void
  screen?: boolean
  ghost?: Ghost | null
  changed?: ReadonlySet<string>
  reveal?: boolean
  picked?: (block: PlacedBlock, day: number) => ReactNode
}) {
  const { clock, weekStart } = useDisplay()
  const { wake, sleep } = dayBounds(settings)
  const height = ((sleep - wake) / 60) * hourPx
  const hours: number[] = []
  for (let m = Math.ceil(wake / 60) * 60; m <= sleep; m += 60) hours.push(m)

  return (
      <div className="flex">
      <div className="w-14 shrink-0">
        <div className="h-7 border-b border-ink/40" />
        <div className="relative" style={{ height }} data-hours>
          {hours.map((m) => (
            <div
              key={m}
              className="absolute right-2 text-[10px] tabular-nums text-ink/55"
              style={{ top: ((m - wake) / 60) * hourPx - 5 }}
            >
              {formatClock(m, clock, { compact: true })}
            </div>
          ))}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-7">
        {weekOrder(weekStart).map((day, column) => (
          <DayColumn
            key={day}
            hourPx={hourPx}
            day={day}
            column={column}
            height={height}
            wake={wake}
            hours={hours}
            blocks={blocks.filter((b) => b.day === day)}
            selectedId={selectedId}
            onSelect={onSelect}
            screen={screen}
            ghost={ghost?.day === day ? ghost : null}
            moving={!!ghost}
            changed={changed}
            reveal={reveal}
            picked={picked}
          />
        ))}
      </div>
      </div>
  )
}

/** How long the reveal takes to draw each day's column, one after another. */
export const REVEAL_DAY_MS = 260

function DayColumn({
  hourPx,
  day,
  column,
  height,
  wake,
  hours,
  blocks,
  selectedId,
  onSelect,
  screen,
  ghost,
  moving,
  changed,
  reveal,
  picked,
}: {
  hourPx: number
  day: Day
  column: number
  height: number
  wake: number
  hours: number[]
  blocks: PlacedBlock[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  screen: boolean
  ghost: Ghost | null
  moving: boolean
  changed?: ReadonlySet<string>
  reveal: boolean
  picked?: (block: PlacedBlock, day: number) => ReactNode
}) {
  const { clock } = useDisplay()
  const selected = blocks.find((b) => b.id === selectedId)
  return (
    <div className="border-l border-ink/40">
      <div className="flex h-7 items-center justify-center border-b border-ink/40 text-[11px] tracking-[0.2em]">
        {DAY_NAMES[day]}
      </div>
      <div className="relative" style={{ height }}>
        {hours.map((m) => (
          <div
            key={m}
            className="absolute inset-x-0 border-t border-dashed border-ink/20"
            style={{ top: ((m - wake) / 60) * hourPx }}
          />
        ))}
        {blocks.map((block, i) => (
          <Block
            key={block.id}
            hourPx={hourPx}
            block={block}
            wake={wake}
            selected={block.id === selectedId}
            onSelect={onSelect}
            screen={screen}
            // The session being moved stays where it was, dimmed, until it is put down.
            dim={moving && block.id === selectedId}
            flash={changed?.has(block.id) ?? false}
            revealAt={reveal ? column * REVEAL_DAY_MS + i * 40 : null}
          />
        ))}
        {ghost && (
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-x-[3px] z-10 overflow-hidden border-2 border-dashed px-1.5 py-1 text-[10px] uppercase leading-[1.15] ${
              ghost.refused ? "border-alert text-alert [text-shadow:none]" : "border-ink bg-ink/20"
            }`}
            style={{ top: ((ghost.startMinute - wake) / 60) * hourPx + 1, height: Math.max(((ghost.endMinute - ghost.startMinute) / 60) * hourPx - 2, 14) }}
          >
            <div className="truncate">{ghost.name}</div>
            <div className="tabular-nums opacity-80">{formatClock(ghost.startMinute, clock)}</div>
          </div>
        )}
        {selected && !moving && picked?.(selected, column)}
      </div>
    </div>
  )
}

function Block({
  hourPx,
  block,
  wake,
  selected,
  onSelect,
  screen,
  dim,
  flash,
  revealAt,
}: {
  hourPx: number
  block: PlacedBlock
  wake: number
  selected: boolean
  onSelect: (id: string | null) => void
  screen: boolean
  dim: boolean
  flash: boolean
  revealAt: number | null
}) {
  const { clock } = useDisplay()
  const top = ((block.startMinute - wake) / 60) * hourPx
  const height = ((block.endMinute - block.startMinute) / 60) * hourPx
  // Each block is drawn a pixel inside its slot, so two back to back read as two boxes, not one thick rule.
  const drawn = Math.max(height - 2, 14)
  // Too short for padding and two lines: the name alone, centred.
  const short = drawn < 26

  // Drawn in pen on paper, in phosphor on the screen: an outline; a locked block is hatched in.
  const surface = selected && !dim ? "bg-ink text-paper [text-shadow:none]" : screen ? "bg-paper" : "bg-sheet"
  const hatch = screen ? "rgb(255 178 56 / 0.22)" : "rgb(27 25 20 / 0.14)"

  return (
    <button
      type="button"
      data-block={block.id}
      onClick={() => onSelect(selected ? null : block.id)}
      title={`${block.name} — ${localizeTimes(block.reason, clock)}`}
      className={`absolute inset-x-[3px] overflow-hidden border-[1.5px] border-ink px-1.5 text-left uppercase ${
        short ? "flex items-center py-0" : "py-1"
      } ${surface} ${dim ? "opacity-35" : ""} ${flash ? "changed" : ""} ${revealAt !== null ? "draw-in" : ""}`}
      style={{
        top: top + 1,
        height: drawn,
        ...(revealAt !== null ? { animationDelay: `${revealAt}ms` } : {}),
        ...(block.locked && !(selected && !dim)
          ? { backgroundImage: `repeating-linear-gradient(45deg, ${hatch} 0 1px, transparent 1px 5px)` }
          : {}),
      }}
    >
      <div className={`truncate tracking-[0.06em] ${short ? "text-[9px] leading-[1.15]" : "text-[10px] leading-[1.15]"}`}>{block.name}</div>
      {height >= 36 && (
        <div className="font-mono text-[9px] tabular-nums opacity-65">
          {formatClock(block.startMinute, clock)}–{formatClock(block.endMinute, clock)}
        </div>
      )}
      {block.locked && (
        <span className={`absolute right-1 top-1 h-1.5 w-1.5 ${selected && !dim ? "bg-paper" : "bg-ink"}`} />
      )}
    </button>
  )
}
