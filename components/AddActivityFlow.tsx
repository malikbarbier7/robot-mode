"use client"

import { useState } from "react"
import type { Activity, Day, Priority } from "@/lib/types"
import { parseDuration } from "@/lib/duration"
import {
  STEPS,
  WINDOW_PRESETS,
  draftToActivity,
  recapBefore,
  isDraftValid,
  type Draft,
} from "@/lib/draft"

const FIELD = "border-0 border-b border-ink/25 bg-transparent px-0 py-2 text-[18px] placeholder:text-ink/30"
const CHIP = "label h-8 border px-2.5"
const TIME = "border-b border-ink/30 bg-transparent py-1 font-mono text-[13px] tabular-nums"
const DAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const
const ALL_DAYS: Day[] = [0, 1, 2, 3, 4, 5, 6]
const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"]
const BUFFERS = [15, 30, 45, 60]

/**
 * Name, duration and frequency, then an optional walk through the constraints.
 * The steps take over the same row rather than stacking above it, so the block
 * never grows and the eye stays in one place.
 *
 * Capturing constraints here is the point: preferences the engine knows up front
 * don't have to be fixed by hand after the week is generated.
 */
export function AddActivityFlow({ onAdd }: { onAdd: (activity: Omit<Activity, "id">) => void }) {
  const [name, setName] = useState("")
  const [durationText, setDurationText] = useState("")
  const [sessionsText, setSessionsText] = useState("")
  const [draft, setDraft] = useState<Draft>({ name: "", durationMinutes: 0, sessionsPerWeek: 1 })
  const [step, setStep] = useState<number | null>(null)
  const [atMode, setAtMode] = useState(false)

  const minutes = parseDuration(durationText)
  const current: Draft = {
    ...draft,
    name,
    durationMinutes: minutes ?? 0,
    sessionsPerWeek: Number(sessionsText || "1"),
  }
  const valid = isDraftValid(current)
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))

  const reset = () => {
    setName("")
    setDurationText("")
    setSessionsText("")
    setDraft({ name: "", durationMinutes: 0, sessionsPerWeek: 1 })
    setStep(null)
    setAtMode(false)
  }

  const add = () => {
    if (!valid) return
    onAdd(draftToActivity(current))
    reset()
  }

  const next = () => {
    if (!valid) return
    setStep((s) => (s === null ? 0 : Math.min(s + 1, STEPS.length - 1)))
  }

  // Only what earlier steps decided; the current step shows its own state.
  const chosen = step === null ? [] : recapBefore(current, step)
  const fixedTime = atMode || draft.fixedAt !== undefined
  const onLastStep = step === STEPS.length - 1

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        add()
      }}
      className="mt-8 flex min-h-[80px] flex-wrap items-center gap-x-2 gap-y-2 border-y-2 border-ink py-4"
    >
      {step === null ? (
        <>
          <input
            className={`${FIELD} min-w-0 flex-1 font-sans`}
            placeholder="Gym"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className={`${FIELD} w-24 shrink-0 font-mono tabular-nums`}
            placeholder="1h15"
            value={durationText}
            onChange={(e) => setDurationText(e.target.value)}
          />
          <input
            className={`${FIELD} w-16 shrink-0 font-mono tabular-nums`}
            placeholder="4×"
            value={sessionsText}
            onChange={(e) => setSessionsText(e.target.value)}
          />
        </>
      ) : (
        <>
          <span className="label shrink-0">
            {step + 1}/{STEPS.length} {STEPS[step]}
          </span>
          {chosen.length > 0 && (
            <span className="label max-w-[140px] shrink-0 truncate text-ink/35" title={chosen.join(" · ")}>
              {chosen.join(" · ")}
            </span>
          )}

          {step === 0 && (
            <>
              <div className="flex gap-1">
                {ALL_DAYS.map((day) => {
                  const on = draft.allowedDays?.includes(day) ?? false
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const base = draft.allowedDays ?? []
                        patch({ allowedDays: on ? base.filter((d) => d !== day) : [...base, day] })
                      }}
                      className={`${CHIP} w-8 border-ink/40 px-0 ${on ? "bg-ink text-paper" : "text-ink/50"}`}
                    >
                      {DAY_INITIALS[day]}
                    </button>
                  )
                })}
              </div>
              <Skip active={!draft.allowedDays?.length} onClick={() => patch({ allowedDays: undefined })} />
            </>
          )}

          {step === 1 && (
            <>
              <div className="flex gap-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => patch({ priority: p })}
                    className={`${CHIP} border-ink/40 ${
                      draft.priority === p ? "bg-ink text-paper" : "text-ink/55"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <Skip active={!draft.priority} onClick={() => patch({ priority: undefined })} />
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex gap-1">
                {BUFFERS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => patch({ bufferMinutes: draft.bufferMinutes === b ? undefined : b })}
                    className={`${CHIP} border-ink/40 ${
                      draft.bufferMinutes === b ? "bg-ink text-paper" : "text-ink/55"
                    }`}
                  >
                    {b}m
                  </button>
                ))}
              </div>
              <Skip
                active={!draft.bufferMinutes}
                onClick={() => patch({ bufferMinutes: undefined })}
                label="No buffer"
              />
            </>
          )}

          {step === 3 && (
            <>
              <Skip
                active={!draft.window && !draft.fixedAt}
                onClick={() => {
                  setAtMode(false)
                  patch({ window: undefined, fixedAt: undefined })
                }}
              />
              {/* A fixed time and a window are exclusive, so the presets step aside. */}
              {!fixedTime &&
                WINDOW_PRESETS.map((w) => (
                  <button
                    key={w.label}
                    type="button"
                    onClick={() => patch({ window: { start: w.start, end: w.end }, fixedAt: undefined })}
                    className={`${CHIP} border-ink/40 ${
                      draft.window?.start === w.start ? "bg-ink text-paper" : "text-ink/55"
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => {
                  // Clicking it again goes back to the window presets.
                  setAtMode(!fixedTime)
                  patch({ fixedAt: undefined, window: undefined })
                }}
                className={`${CHIP} border-ink/40 ${fixedTime ? "bg-ink text-paper" : "text-ink/55"}`}
              >
                Always at
              </button>
              {fixedTime && (
                <input
                  type="time"
                  value={draft.fixedAt?.start ?? ""}
                  onChange={(e) => patch({ fixedAt: e.target.value ? { start: e.target.value } : undefined })}
                  className={`${TIME} text-[15px]`}
                />
              )}
            </>
          )}
        </>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {step !== null && (
          <button
            type="button"
            onClick={() => setStep((s) => (s !== null && s > 0 ? s - 1 : null))}
            className="label border border-ink/40 px-2 py-1 text-ink/55 hover:bg-ink hover:text-paper"
          >
            Back
          </button>
        )}
        {!onLastStep && (
          <button
            type="button"
            onClick={next}
            disabled={!valid}
            title="Set days, priority, travel buffer and preferred time"
            className="label border border-ink px-3 py-1 hover:bg-ink hover:text-paper disabled:opacity-30"
          >
            Next
          </button>
        )}
        <button
          type="submit"
          disabled={!valid}
          className="label border border-ink bg-ink px-3 py-1 text-paper hover:bg-paper hover:text-ink disabled:border-ink/25 disabled:bg-transparent disabled:text-ink/30"
        >
          Add
        </button>
      </div>
    </form>
  )
}

/** Every step can be left unanswered; the scheduler decides instead. */
function Skip({
  active,
  onClick,
  label = "Decide for me",
}: {
  active: boolean
  onClick: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${CHIP} ${active ? "border-ink bg-ink/10 text-ink" : "border-ink/25 text-ink/45 hover:border-ink"}`}
    >
      {label}
    </button>
  )
}
