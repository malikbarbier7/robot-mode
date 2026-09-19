"use client"

import { useEffect, useState } from "react"
import type { Day, PlacedBlock, Schedule, Settings } from "@/lib/types"
import { DAY_NAMES, formatTime, parseTime } from "@/lib/scheduler/time"

const HOUR_PX = 48
const DAYS: Day[] = [0, 1, 2, 3, 4, 5, 6]

export function WeekGrid({
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
  const wake = parseTime(settings.wakeTime)
  let sleep = parseTime(settings.sleepTime)
  if (sleep <= wake) sleep += 1440

  const height = ((sleep - wake) / 60) * HOUR_PX
  const hours: number[] = []
  for (let m = Math.ceil(wake / 60) * 60; m <= sleep; m += 60) hours.push(m)

  return (
    <div className="flex min-w-[720px]">
      <div className="w-14 shrink-0">
        <div className="h-9 border-b border-ink/20" />
        <div className="relative" style={{ height }}>
          {hours.map((m) => (
            <div
              key={m}
              className="label absolute right-2 text-ink/45 tabular-nums"
              style={{ top: ((m - wake) / 60) * HOUR_PX - 5 }}
            >
              {formatTime(m)}
            </div>
          ))}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-7">
        {DAYS.map((day) => (
          <DayColumn
            key={day}
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
  )
}

function DayColumn({
  day,
  height,
  wake,
  hours,
  blocks,
  selectedId,
  onSelect,
}: {
  day: Day
  height: number
  wake: number
  hours: number[]
  blocks: PlacedBlock[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <div className="border-l border-ink/20">
      <div className="label flex h-9 items-center justify-center border-b border-ink/20 text-ink/70">
        {DAY_NAMES[day]}
      </div>
      <div className="relative" style={{ height }}>
        {hours.map((m) => (
          <div
            key={m}
            className="absolute inset-x-0 h-px bg-ink/12"
            style={{ top: ((m - wake) / 60) * HOUR_PX }}
          />
        ))}
        <NowLine day={day} wake={wake} height={height} />
        {blocks.map((block) => (
          <Block
            key={block.id}
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
  block,
  wake,
  selected,
  onSelect,
}: {
  block: PlacedBlock
  wake: number
  selected: boolean
  onSelect: (id: string | null) => void
}) {
  const top = ((block.startMinute - wake) / 60) * HOUR_PX
  const height = ((block.endMinute - block.startMinute) / 60) * HOUR_PX

  const surface = selected ? "bg-ink text-paper" : block.locked ? "bg-ink/15" : "bg-ink/[0.045]"

  return (
    <button
      type="button"
      onClick={() => onSelect(selected ? null : block.id)}
      title={`${block.name} — ${block.reason}`}
      className={`absolute inset-x-px overflow-hidden border border-ink px-1.5 py-1 text-left ${surface}`}
      style={{ top, height: Math.max(height, 14) }}
    >
      <div className="truncate text-[11px] leading-[1.15]">{block.name}</div>
      {height >= 36 && (
        <div className="font-mono text-[9px] tabular-nums opacity-65">
          {formatTime(block.startMinute)}–{formatTime(block.endMinute)}
        </div>
      )}
      {block.locked && (
        <span className={`absolute right-1 top-1 h-1.5 w-1.5 ${selected ? "bg-paper" : "bg-ink"}`} />
      )}
    </button>
  )
}

/** Where you actually are right now. Rendered after mount to keep SSR stable. */
function NowLine({ day, wake, height }: { day: Day; wake: number; height: number }) {
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
  const top = ((now.minute - wake) / 60) * HOUR_PX
  if (top < 0 || top > height) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-ink" style={{ top }}>
      <div className="absolute -left-1 -top-[3px] h-2 w-2 bg-ink" />
    </div>
  )
}
