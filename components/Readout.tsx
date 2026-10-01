"use client"

import { useRef, useState } from "react"
import { from12, to12, type Period } from "@/lib/locale"
import { useDisplay } from "./Display"
import { advance } from "./Machine"

/**
 * A number on the screen that is set, not typed into a box: ↑ ↓ step it,
 * digits overwrite it (a partial entry shows as "1_"), Enter or leaving it
 * commits. `arrows` adds ▲ ▼ above and below for the mouse.
 *
 * Typing finishes the entry by itself as soon as no further digit could fit:
 * in hours, 7 can only mean 07, so it is taken and the cursor moves on.
 */
export function Readout({
  label,
  value,
  onChange,
  max,
  min = 0,
  step = 1,
  width = 2,
  wrap = false,
  arrows = false,
  disabled = false,
  invalid = false,
  horizontal = false,
  keysOnly = false,
}: {
  label: string
  /** Null shows dashes: nothing entered yet. */
  value: number | null
  onChange: (v: number) => void
  max: number
  min?: number
  step?: number
  width?: number
  wrap?: boolean
  arrows?: boolean
  disabled?: boolean
  /** Enter refuses to move on from it (see useTerminal). */
  invalid?: boolean
  /**
   * Set along a horizontal scale: ← → step it, and ↑ ↓ are left to the
   * screen to move between fields.
   */
  horizontal?: boolean
  /**
   * Set only with digits and + −: the arrows are left to the screen, for a
   * readout sitting among lines of choices that ↑ ↓ walk through.
   */
  keysOnly?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const field = useRef<HTMLInputElement>(null)

  const fit = (n: number) => {
    if (wrap) return ((((n - min) % (max - min + 1)) + (max - min + 1)) % (max - min + 1)) + min
    return Math.min(Math.max(n, min), max)
  }
  const nudge = (by: number) => {
    setDraft(null)
    onChange(fit((value ?? min) + by))
  }
  const commit = (text: string | null) => {
    if (text) onChange(Math.min(Math.max(Number(text), min), max))
    setDraft(null)
  }
  const type = (digits: string) => {
    let next = draft ?? ""
    for (const digit of digits) {
      next += digit
      // Full, or any further digit would overshoot: the entry is complete.
      if (next.length >= width || Number(next) * 10 > max) {
        commit(next)
        // After the render, so leaving doesn't re-commit the stale partial,
        // and only if the value was accepted.
        setTimeout(() => {
          const el = field.current
          if (el && el.getAttribute("aria-invalid") !== "true") advance(el)
        }, 0)
        return
      }
    }
    setDraft(next)
  }

  const input = (
    <input
      ref={field}
      data-nav
      data-readout
      inputMode="numeric"
      aria-label={label}
      aria-invalid={invalid}
      disabled={disabled}
      value={draft !== null ? draft.padEnd(width, "_") : value === null ? "-".repeat(width) : String(value).padStart(width, "0")}
      onKeyDown={(e) => {
        const up = keysOnly ? null : horizontal ? "ArrowRight" : "ArrowUp"
        const down = keysOnly ? null : horizontal ? "ArrowLeft" : "ArrowDown"
        if (e.key === up || e.key === "+") {
          e.preventDefault()
          nudge(step)
        } else if (e.key === down || e.key === "-") {
          e.preventDefault()
          nudge(-step)
        } else if (/^\d$/.test(e.key)) {
          e.preventDefault()
          type(e.key)
        } else if (e.key === "Backspace") {
          e.preventDefault()
          setDraft(draft ? draft.slice(0, -1) || null : null)
        } else if (e.key === "Enter") {
          // Commit, and let Enter carry on to the next field.
          commit(draft)
        }
      }}
      // Virtual keyboards and pastes arrive as inserted text, not keys; take their digits here.
      onChange={(e) => {
        const inserted = (e.nativeEvent as InputEvent).data ?? e.target.value.slice(-1)
        const digits = inserted.replace(/\D/g, "")
        if (digits) type(digits)
      }}
      onBlur={() => commit(draft)}
      style={{ width: `${width}ch` }}
      className="bg-transparent text-center caret-transparent disabled:opacity-100"
    />
  )

  if (!arrows) return input
  return (
    <span className="flex flex-col items-center">
      <button type="button" tabIndex={-1} onClick={() => nudge(step)} aria-label={`${label} up`} className="px-3 text-[26px] text-ink/40 hover:text-ink">
        ▲
      </button>
      {input}
      <button type="button" tabIndex={-1} onClick={() => nudge(-step)} aria-label={`${label} down`} className="px-3 text-[26px] text-ink/40 hover:text-ink">
        ▼
      </button>
    </span>
  )
}

/**
 * A clock time as readouts, following the clock setting: "07 : 30" in 24h,
 * "07 : 30 AM" in 12h with the period as a field of its own. Stored as
 * "HH:MM" in 24h either way. Null shows dashes until something is set.
 */
export function ClockReadout({
  label,
  value,
  onChange,
  minuteStep = 5,
  defaultPeriod = "am",
  arrows = false,
  disabled = false,
  periodClassName = "",
  keysOnly = false,
}: {
  label: string
  value: string | null
  onChange: (v: string) => void
  minuteStep?: number
  /** Which half of the day an hour typed into an empty clock means. */
  defaultPeriod?: Period
  arrows?: boolean
  disabled?: boolean
  periodClassName?: string
  /** Leave ↑ ↓ to the screen: set with digits, + − (and A / P / Space for the half of the day). */
  keysOnly?: boolean
}) {
  const { clock } = useDisplay()
  const [h24, m] = value ? value.split(":").map(Number) : [null, null]
  // An AM/PM chosen before any hour is set, so it is not lost.
  const [pendingPeriod, setPendingPeriod] = useState<Period>(defaultPeriod)
  const period: Period = h24 === null ? pendingPeriod : to12(h24).period
  const set = (hour24: number, minute: number) => onChange(`${pad(hour24)}:${pad(minute)}`)

  const minutes = (
    <Readout
      label={`${label} minutes`}
      value={m}
      max={59}
      step={minuteStep}
      wrap
      arrows={arrows}
      keysOnly={keysOnly}
      disabled={disabled}
      onChange={(v) => set(h24 ?? from12(12, period), v)}
    />
  )

  if (clock === "24h") {
    return (
      <>
        <Readout label={`${label} hours`} value={h24} max={23} wrap arrows={arrows} keysOnly={keysOnly} disabled={disabled} onChange={(v) => set(v, m ?? 0)} />
        <span className="px-[0.1em] opacity-50">:</span>
        {minutes}
      </>
    )
  }

  const setPeriod = (p: Period) => {
    if (h24 === null) setPendingPeriod(p)
    else set(from12(to12(h24).hour, p), m ?? 0)
  }
  return (
    <>
      <Readout
        label={`${label} hours`}
        value={h24 === null ? null : to12(h24).hour}
        min={1}
        max={12}
        wrap
        arrows={arrows}
        keysOnly={keysOnly}
        disabled={disabled}
        onChange={(v) => set(from12(v, period), m ?? 0)}
      />
      <span className="px-[0.1em] opacity-50">:</span>
      {minutes}
      <PeriodField
        label={`${label} AM or PM`}
        period={period}
        unset={h24 === null}
        disabled={disabled}
        keysOnly={keysOnly}
        onChange={setPeriod}
        className={periodClassName}
      />
    </>
  )
}

/**
 * AM / PM as one selectable field: Space or ↑ ↓ flip it, A or P set it (and
 * move on), Enter moves on like any field.
 */
function PeriodField({
  label,
  period,
  unset,
  disabled,
  keysOnly = false,
  onChange,
  className,
}: {
  label: string
  period: Period
  unset: boolean
  disabled: boolean
  keysOnly?: boolean
  onChange: (p: Period) => void
  className: string
}) {
  const flip = () => onChange(period === "am" ? "pm" : "am")
  return (
    <button
      type="button"
      data-nav
      data-enter="next"
      aria-label={label}
      disabled={disabled}
      onClick={flip}
      onKeyDown={(e) => {
        if (!keysOnly && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
          e.preventDefault()
          flip()
        } else if (e.key === "a" || e.key === "A" || e.key === "p" || e.key === "P") {
          e.preventDefault()
          onChange(e.key.toLowerCase() === "a" ? "am" : "pm")
          const el = e.currentTarget
          setTimeout(() => advance(el), 0)
        }
      }}
      className={`ml-[0.25em] self-center px-[0.15em] uppercase disabled:opacity-100 ${unset ? "opacity-60" : ""} ${className}`}
    >
      {period === "am" ? "AM" : "PM"}
    </button>
  )
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
