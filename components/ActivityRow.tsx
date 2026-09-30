"use client"

import { useRef, useState } from "react"
import type { Activity, Day, Priority } from "@/lib/types"
import { formatDuration, parseDuration } from "@/lib/duration"
import { formatSpan, weekOrder } from "@/lib/locale"
import { useDisplay } from "./Display"
import { Button, Field, inputClass } from "./ui"

const DAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const
const ALL: Day[] = [0, 1, 2, 3, 4, 5, 6]
const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"]

export function ActivityRow({
  activity,
  placed,
  onChange,
  onRemove,
  /** "panel" is the narrow sidebar; "terminal" is a line on one of the machine's screens. */
  variant = "panel",
  defaultOpen = false,
}: {
  activity: Activity
  placed: number
  onChange: (patch: Partial<Activity>) => void
  onRemove: () => void
  variant?: "panel" | "terminal"
  /** Start with the full settings showing. */
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const line = useRef<HTMLButtonElement>(null)
  const [durationText, setDurationText] = useState(formatDuration(activity.durationMinutes))
  const short = placed < activity.sessionsPerWeek

  return (
    <div
      className="border-b border-ink/15"
      onKeyDown={(e) => {
        // Esc anywhere in the editor folds it back into its line.
        if (e.key === "Escape" && open) {
          e.preventDefault()
          setOpen(false)
          line.current?.focus()
        }
      }}
    >
      {variant === "terminal" ? (
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
          title={open ? "Hide constraints" : "Priority, days, preferred time"}
          className="flex w-full items-baseline gap-5 py-2 text-left font-crt text-[34px] leading-tight hover:bg-ink/[0.07]"
        >
          <span className="text-ink/60">{open ? "▼" : ">"}</span>
          <span className="min-w-0 flex-1 truncate uppercase">{activity.name}</span>
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
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={open ? "Hide constraints" : "Priority, days, preferred time"}
          className="flex w-full items-baseline gap-2 px-6 py-2.5 text-left hover:bg-ink/[0.04]"
        >
          <span className="label w-3 shrink-0 text-ink/40">{open ? "−" : "+"}</span>
          <span className="flex-1 truncate text-[13px]">{activity.name}</span>
          <span className="font-mono text-[11px] tabular-nums text-ink/60">
            {formatSpan(activity.durationMinutes)} · {activity.sessionsPerWeek}×
          </span>
          {short && (
            <span className="label border border-ink px-1" title={`Only ${placed} of ${activity.sessionsPerWeek} fit`}>
              {placed}/{activity.sessionsPerWeek}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className={variant === "terminal" ? "space-y-3 pb-6 pt-1" : "space-y-3 bg-ink/[0.03] px-6 pb-4 pt-1"}>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Name">
              <input
                className={`${inputClass} font-sans`}
                value={activity.name}
                onChange={(e) => onChange({ name: e.target.value })}
              />
            </Field>
            <Field label="Session">
              <input
                className={inputClass}
                value={durationText}
                onChange={(e) => {
                  setDurationText(e.target.value)
                  const parsed = parseDuration(e.target.value)
                  if (parsed && parsed > 0) onChange({ durationMinutes: parsed })
                }}
                onBlur={() => setDurationText(formatDuration(activity.durationMinutes))}
              />
            </Field>
            <Field label="Per week">
              <input
                className={inputClass}
                type="number"
                min={0}
                max={28}
                value={activity.sessionsPerWeek}
                onChange={(e) => onChange({ sessionsPerWeek: Math.max(0, Number(e.target.value)) })}
              />
            </Field>
          </div>

          <ActivityConstraints activity={activity} onChange={onChange} />

          <div className="pt-1">
            <Button onClick={onRemove}>Remove activity</Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * The constraints beyond length and count: which days, how much it matters,
 * travel time, a preferred window and a fixed time. Shared by every editor.
 */
export function ActivityConstraints({
  activity,
  onChange,
}: {
  activity: Activity
  onChange: (patch: Partial<Activity>) => void
}) {
  const { weekStart } = useDisplay()
  const days = activity.allowedDays ?? ALL
  const toggleDay = (day: Day) => {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort()
    onChange({ allowedDays: next.length === 7 ? undefined : (next as Day[]) })
  }

  return (
    <>
      <Field label="Days">
        <div className="flex gap-1">
          {weekOrder(weekStart).map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`label h-6 flex-1 border border-ink/40 ${
                days.includes(day) ? "bg-ink text-paper" : "text-ink/45"
              }`}
            >
              {DAY_INITIALS[day]}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Priority">
          <select
            className={`${inputClass} font-sans`}
            value={activity.priority}
            onChange={(e) => onChange({ priority: e.target.value as Priority })}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Travel buffer">
          <input
            className={inputClass}
            type="number"
            min={0}
            step={15}
            value={activity.bufferMinutes ?? 0}
            onChange={(e) =>
              onChange({ bufferMinutes: Number(e.target.value) > 0 ? Number(e.target.value) : undefined })
            }
          />
        </Field>
      </div>

      <Field label="Preferred window (optional)">
        <div className="flex items-center gap-2">
          <input
            className={inputClass}
            type="time"
            value={activity.window?.start ?? ""}
            onChange={(e) =>
              onChange({
                window: e.target.value
                  ? { start: e.target.value, end: activity.window?.end ?? "23:00" }
                  : undefined,
              })
            }
          />
          <span className="text-ink/40">–</span>
          <input
            className={inputClass}
            type="time"
            value={activity.window?.end ?? ""}
            onChange={(e) =>
              onChange({
                window: e.target.value
                  ? { start: activity.window?.start ?? "08:00", end: e.target.value }
                  : undefined,
              })
            }
          />
        </div>
      </Field>

      <Field label="Always at (optional)">
        <div className="flex items-center gap-2">
          <input
            className={inputClass}
            type="time"
            value={activity.fixedAt?.start ?? ""}
            onChange={(e) => onChange({ fixedAt: e.target.value ? { start: e.target.value } : undefined })}
          />
          <Button variant="bare" onClick={() => onChange({ fixedAt: undefined })}>
            clear
          </Button>
        </div>
      </Field>
    </>
  )
}
