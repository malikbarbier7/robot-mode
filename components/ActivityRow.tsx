"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import type { Activity, Day, Priority } from "@/lib/types"
import { WINDOW_PRESETS } from "@/lib/draft"
import { formatSpan, weekOrder } from "@/lib/locale"
import { useDisplay } from "./Display"
import { ClockReadout, Readout } from "./Readout"

const DAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const
const ALL: Day[] = [0, 1, 2, 3, 4, 5, 6]
const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"]
const BUFFERS = [15, 30, 45, 60]

/**
 * One activity on a terminal screen: a line that unfolds into its settings.
 * Everything in it is a terminal item (`data-nav`), so the screen's keys reach
 * all of it: ↑ ↓ line to line, ← → along a line, Space or Enter to pick, digits
 * or ↑ ↓ on a readout. Esc folds it back into its line.
 */
export function ActivityRow({
  activity,
  placed,
  onChange,
  onRemove,
  defaultOpen = false,
}: {
  activity: Activity
  placed: number
  onChange: (patch: Partial<Activity>) => void
  onRemove: () => void
  /** Start with the settings showing. */
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const line = useRef<HTMLButtonElement>(null)
  const short = placed < activity.sessionsPerWeek

  return (
    <div
      className="border-b border-ink/15"
      onKeyDown={(e) => {
        // Esc anywhere in the settings folds them back into the line.
        if (e.key === "Escape" && open) {
          e.preventDefault()
          setOpen(false)
          line.current?.focus()
        }
      }}
    >
      <button
        ref={line}
        type="button"
        data-nav
        data-activity={activity.id}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault()
            // The selection moves on to whatever follows, as in a terminal list.
            const items = [...(e.currentTarget.closest(".crt")?.querySelectorAll<HTMLElement>("[data-nav]") ?? [])]
            items[items.indexOf(e.currentTarget) + 1]?.focus()
            onRemove()
          }
        }}
        title={open ? "Fold" : "Length, days, priority, preferred time"}
        className="flex w-full items-baseline gap-5 py-2 text-left font-crt text-[34px] leading-tight hover:bg-ink/[0.07]"
      >
        <span className="text-ink/60">{open ? "▼" : ">"}</span>
        <span className="min-w-0 flex-1 truncate uppercase">
          {activity.name}
          {activity.extraOf && <span className="text-ink/50"> · extra</span>}
        </span>
        {short && (
          <span className="border border-ink px-1.5 text-[22px]" title={`Only ${placed} of ${activity.sessionsPerWeek} fit`}>
            {placed}/{activity.sessionsPerWeek} FIT
          </span>
        )}
        <span className="w-32 text-right tabular-nums">{formatSpan(activity.durationMinutes)}</span>
        <span className="w-32 text-right tabular-nums">
          {activity.sessionsPerWeek === 7 ? "DAILY" : `${String(activity.sessionsPerWeek).padStart(2, "0")}/WEEK`}
        </span>
      </button>

      {open && <Settings activity={activity} onChange={onChange} onRemove={onRemove} />}
    </div>
  )
}

/** A labelled line of the settings, so ↑ ↓ step from one to the next. */
function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="w-40 shrink-0 text-[24px] tracking-[0.12em] text-ink/55">{label}</span>
      {children}
    </div>
  )
}

/** A choice on a line: lit when chosen, picked with Space, Enter or a click. */
function Chip({ on, onClick, children, wide = false }: { on: boolean; onClick: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <button
      type="button"
      data-nav
      aria-pressed={on}
      onClick={onClick}
      className={`border px-3 py-0.5 text-[26px] uppercase ${wide ? "" : "min-w-[2.6rem]"} ${
        on ? "border-ink bg-ink/20 text-ink" : "border-ink/30 text-ink/50 hover:border-ink"
      }`}
    >
      {children}
    </button>
  )
}

function Settings({
  activity,
  onChange,
  onRemove,
}: {
  activity: Activity
  onChange: (patch: Partial<Activity>) => void
  onRemove: () => void
}) {
  const { weekStart } = useDisplay()
  // The box can be emptied to retype, but the activity keeps its name until there is a new one.
  const [name, setName] = useState(activity.name)
  const [atMode, setAtMode] = useState(activity.fixedAt !== undefined)
  const timeField = useRef<HTMLSpanElement>(null)

  // Switching on "Always at" hands the cursor to its time, ready to type.
  useEffect(() => {
    if (atMode && !activity.fixedAt) timeField.current?.querySelector<HTMLElement>("[data-readout]")?.focus()
  }, [atMode, activity.fixedAt])

  const minutes = activity.durationMinutes
  const setLength = (next: number) => {
    if (next > 0) onChange({ durationMinutes: next })
  }

  const days = activity.allowedDays ?? ALL
  const anyDay = activity.allowedDays === undefined
  const toggleDay = (day: Day) => {
    // From ANY, a day picked is the first day chosen, not the one day taken away.
    if (anyDay) return onChange({ allowedDays: [day] })
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort()
    // None left means none chosen: back to any day. All seven is the same thing.
    onChange({ allowedDays: next.length === 0 || next.length === 7 ? undefined : (next as Day[]) })
  }

  const presetOn = (w: { start: string; end: string }) =>
    !activity.fixedAt && activity.window?.start === w.start && activity.window?.end === w.end

  return (
    <div className="space-y-4 pb-6 pl-12 pt-2 font-crt uppercase">
      <Line label="Name">
        <input
          data-nav
          aria-label="Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (e.target.value.trim()) onChange({ name: e.target.value })
          }}
          onBlur={() => setName(activity.name)}
          className="min-w-0 flex-1 border-b border-ink/40 bg-transparent text-[28px] uppercase"
        />
      </Line>

      <Line label="Length">
        <span className="flex items-baseline text-[34px] tabular-nums">
          <Readout
            keysOnly label="Length, hours" value={Math.floor(minutes / 60)} max={23} onChange={(h) => setLength(h * 60 + (minutes % 60))} />
          <span className="ml-1 mr-3 text-[20px] text-ink/60">H</span>
          <Readout
            keysOnly
            label="Length, minutes"
            value={minutes % 60}
            max={45}
            step={15}
            wrap
            onChange={(m) => setLength(Math.floor(minutes / 60) * 60 + m)}
          />
          <span className="ml-1 text-[20px] text-ink/60">M</span>
        </span>
        <span className="ml-8 w-auto text-[24px] tracking-[0.12em] text-ink/55">Per week</span>
        <span className="flex items-baseline text-[34px] tabular-nums">
          <Readout
            keysOnly
            label="Times a week"
            value={activity.sessionsPerWeek}
            min={1}
            max={28}
            onChange={(n) => onChange({ sessionsPerWeek: n })}
          />
          <span className="ml-1 text-[20px] text-ink/60">×</span>
        </span>
      </Line>

      <Line label="Days">
        <Chip on={anyDay} onClick={() => onChange({ allowedDays: undefined })} wide>
          Any
        </Chip>
        {weekOrder(weekStart).map((day) => (
          <Chip key={day} on={!anyDay && days.includes(day)} onClick={() => toggleDay(day)}>
            {DAY_INITIALS[day]}
          </Chip>
        ))}
      </Line>

      <Line label="Priority">
        {PRIORITIES.map((p) => (
          <Chip key={p} on={activity.priority === p} onClick={() => onChange({ priority: p })} wide>
            {p}
          </Chip>
        ))}
      </Line>

      <Line label="Buffer">
        <Chip on={!activity.bufferMinutes} onClick={() => onChange({ bufferMinutes: undefined })} wide>
          None
        </Chip>
        {BUFFERS.map((b) => (
          <Chip key={b} on={activity.bufferMinutes === b} onClick={() => onChange({ bufferMinutes: b })} wide>
            {b}m
          </Chip>
        ))}
      </Line>

      <Line label="When">
        <Chip
          on={!activity.window && !activity.fixedAt && !atMode}
          onClick={() => {
            setAtMode(false)
            onChange({ window: undefined, fixedAt: undefined })
          }}
          wide
        >
          Any time
        </Chip>
        {WINDOW_PRESETS.map((w) => (
          <Chip
            key={w.label}
            on={!atMode && presetOn(w)}
            onClick={() => {
              setAtMode(false)
              onChange({ window: { start: w.start, end: w.end }, fixedAt: undefined })
            }}
            wide
          >
            {w.label}
          </Chip>
        ))}
        <Chip on={atMode} onClick={() => setAtMode(true)} wide>
          Always at
        </Chip>
        {atMode && (
          <span ref={timeField} className={`flex items-baseline text-[34px] tabular-nums ${activity.fixedAt ? "" : "text-ink/40"}`}>
            <ClockReadout
              keysOnly
              label="Always at"
              value={activity.fixedAt?.start ?? null}
              onChange={(start) => onChange({ fixedAt: { start }, window: undefined })}
              periodClassName="text-[20px]"
            />
          </span>
        )}
      </Line>

      <div className="flex flex-wrap items-center gap-6 pt-2">
        <button type="button" data-nav onClick={onRemove} className="border border-ink/40 px-3 py-0.5 text-[24px] uppercase hover:border-ink">
          Remove activity
        </button>
        <span className="text-[20px] tracking-[0.1em] text-ink/45">↑ ↓ line · ← → choice · Space pick · digits or + − set a number · Esc fold</span>
      </div>
    </div>
  )
}
