"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
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
 * the printout, so both views come out of the machine. Blocks can be picked,
 * as on the printout.
 */
export function WeekGrid({
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
  onReplay?: () => void
}) {
  const { clock, weekStart } = useDisplay()
  const wake = parseTime(settings.wakeTime)
  let sleep = parseTime(settings.sleepTime)
  if (sleep <= wake) sleep += 1440

  // An hour is as tall as the room allows, so the whole day fits above the terminal without scrolling.
  const frame = useRef<HTMLDivElement>(null)
  const [hourPx, setHourPx] = useState(MAX_HOUR_PX)
  const hoursAwake = (sleep - wake) / 60
  useLayoutEffect(() => {
    const el = frame.current
    const room = el?.closest("main")
    if (!el || !room) return
    const fit = () => {
      // Everything that isn't the hours (printer, margins, headings) stays as it is.
      const body = el.querySelector<HTMLElement>("[data-hours]")?.offsetHeight ?? 0
      const chrome = el.offsetHeight - body
      const next = Math.floor((room.clientHeight - chrome - 4) / hoursAwake)
      setHourPx(Math.min(MAX_HOUR_PX, Math.max(MIN_HOUR_PX, next)))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(room)
    return () => observer.disconnect()
  }, [hoursAwake])
  const height = hoursAwake * hourPx
  const hours: number[] = []
  for (let m = Math.ceil(wake / 60) * 60; m <= sleep; m += 60) hours.push(m)

  const [{ week, year }] = useState(() => isoWeek(new Date()))

  return (
    <div ref={frame}>
    <Paper
      compact
      printer={{ name: "RM-01 · Plotter", spec: "4-pen · 7 col", width: "max-w-[1080px]" }}
      width="max-w-[1000px] min-w-[700px]"
      className="sheet px-12 py-4 font-mono uppercase"
      feed={feed}
      onFed={onFed}
      onReplay={onReplay}
    >
      <div className="mb-2 flex items-baseline justify-between border-b border-ink/60 pb-1 text-[11px] tracking-[0.2em]">
        <span className="font-display text-[15px] font-semibold tracking-[0.3em]">Robot Mode</span>
        <span className="text-ink/60">
          Week {week} / {year} · Plot
        </span>
      </div>
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
        {weekOrder(weekStart).map((day) => (
          <DayColumn
            key={day}
            hourPx={hourPx}
            day={day}
            height={height}
            wake={wake}
            hours={hours}
            blocks={schedule.blocks.filter((b) => b.day === day)}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
      </div>
    </Paper>
    </div>
  )
}

function DayColumn({
  hourPx,
  day,
  height,
  wake,
  hours,
  blocks,
  selectedId,
  onSelect,
}: {
  hourPx: number
  day: Day
  height: number
  wake: number
  hours: number[]
  blocks: PlacedBlock[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
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
        <NowLine day={day} wake={wake} height={height} hourPx={hourPx} />
        {blocks.map((block) => (
          <Block
            key={block.id}
            hourPx={hourPx}
            block={block}
            wake={wake}
            selected={block.id === selectedId}
            onSelect={onSelect}
          />
        ))}
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
}: {
  hourPx: number
  block: PlacedBlock
  wake: number
  selected: boolean
  onSelect: (id: string | null) => void
}) {
  const { clock } = useDisplay()
  const top = ((block.startMinute - wake) / 60) * hourPx
  const height = ((block.endMinute - block.startMinute) / 60) * hourPx
  // Each block is drawn a pixel inside its slot, so two back to back read as two boxes, not one thick rule.
  const drawn = Math.max(height - 2, 14)
  // Too short for padding and two lines: the name alone, centred.
  const short = drawn < 26

  // Drawn in pen: an outline on the paper; a locked block is hatched in.
  const surface = selected ? "bg-ink text-paper" : "bg-sheet"

  return (
    <button
      type="button"
      onClick={() => onSelect(selected ? null : block.id)}
      title={`${block.name} — ${localizeTimes(block.reason, clock)}`}
      className={`absolute inset-x-[3px] overflow-hidden border-[1.5px] border-ink px-1.5 text-left uppercase ${
        short ? "flex items-center py-0" : "py-1"
      } ${surface}`}
      style={{
        top: top + 1,
        height: drawn,
        ...(block.locked && !selected
          ? { backgroundImage: "repeating-linear-gradient(45deg, rgb(27 25 20 / 0.14) 0 1px, transparent 1px 5px)" }
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
        <span className={`absolute right-1 top-1 h-1.5 w-1.5 ${selected ? "bg-paper" : "bg-ink"}`} />
      )}
    </button>
  )
}

/** Where you actually are right now. Rendered after mount to keep SSR stable. */
function NowLine({ day, wake, height, hourPx }: { day: Day; wake: number; height: number; hourPx: number }) {
  const [now, setNow] = useState<{ day: number; minute: number } | null>(null)

  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setNow({ day: (d.getDay() + 6) % 7, minute: d.getHours() * 60 + d.getMinutes() })
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  if (!now || now.day !== day) return null
  const top = ((now.minute - wake) / 60) * hourPx
  if (top < 0 || top > height) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-ink" style={{ top }}>
      <div className="absolute -left-1 -top-[3px] h-2 w-2 bg-ink" />
    </div>
  )
}
