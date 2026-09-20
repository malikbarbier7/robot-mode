"use client"

import { useState } from "react"
import type { Activity, Day, Priority } from "@/lib/types"
import { parseDuration } from "@/lib/duration"
import {
  STEPS,
  WINDOW_PRESETS,
  describeDraft,
  draftToActivity,
  isDraftValid,
  type Draft,
} from "@/lib/draft"

const FIELD = "border-0 border-b border-ink/25 bg-transparent px-0 py-2 text-[18px] placeholder:text-ink/30"
const DAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const
const ALL_DAYS: Day[] = [0, 1, 2, 3, 4, 5, 6]
const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"]
const BUFFERS = [15, 30, 45, 60]

/**
 * Name, duration and frequency, then an optional walk through the constraints.
 * Capturing them here is the point: preferences the engine knows up front don't
 * have to be fixed by hand after the week is generated.
 */
export function AddActivityFlow({ onAdd }: { onAdd: (activity: Omit<Activity, "id">) => void }) {
  const [name, setName] = useState("")
  const [durationText, setDurationText] = useState("")
  const [sessionsText, setSessionsText] = useState("")
  const [draft, setDraft] = useState<Draft>({ name: "", durationMinutes: 0, sessionsPerWeek: 1 })
  const [step, setStep] = useState<number | null>(null)
  const [whenMode, setWhenMode] = useState<"any" | "window" | "at">("any")

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
    setWhenMode("any")
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

  const chosen = describeDraft(current)
  const onLastStep = step === STEPS.length - 1

  return (
    <div className="mt-8 border-y-2 border-ink">
      {step !== null && (
        <div className="flex min-h-[64px] flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink/20 px-1 py-3">
          <span className="label w-20 shrink-0 text-ink/45">
            {step + 1}/{STEPS.length} {STEPS[step]}
          </span>

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
                        const nextDays = on ? base.filter((d) => d !== day) : [...base, day]
                        patch({ allowedDays: nextDays })
                      }}
                      className={`label h-8 w-8 border border-ink/40 ${on ? "bg-ink text-paper" : "text-ink/50"}`}
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
                    className={`label h-8 border border-ink/40 px-2.5 ${
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
                    className={`label h-8 border border-ink/40 px-2.5 ${
                      draft.bufferMinutes === b ? "bg-ink text-paper" : "text-ink/55"
                    }`}
                  >
                    {b}m
                  </button>
                ))}
              </div>
              <span className="label text-ink/35">each side</span>
              <Skip
                active={!draft.bufferMinutes}
                onClick={() => patch({ bufferMinutes: undefined })}
                label="No buffer"
              />
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex gap-1">
                {(
                  [
                    ["any", "Decide for me"],
                    ["window", "Preferred window"],
                    ["at", "Always at"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setWhenMode(mode)
                      // The two are exclusive, so picking one clears the other.
                      if (mode === "any") patch({ window: undefined, fixedAt: undefined })
                      if (mode === "window") patch({ fixedAt: undefined })
                      if (mode === "at") patch({ window: undefined })
                    }}
                    className={`label h-8 border px-2.5 ${
                      whenMode === mode ? "border-ink bg-ink text-paper" : "border-ink/30 text-ink/50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {whenMode === "window" && (
                <>
                  <div className="flex gap-1">
                    {WINDOW_PRESETS.map((w) => (
                      <button
                        key={w.label}
                        type="button"
                        onClick={() => patch({ window: { start: w.start, end: w.end } })}
                        className={`label h-8 border border-ink/40 px-2.5 ${
                          draft.window?.start === w.start && draft.window?.end === w.end
                            ? "bg-ink text-paper"
                            : "text-ink/55"
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="time"
                      value={draft.window?.start ?? ""}
                      onChange={(e) =>
                        patch({ window: { start: e.target.value, end: draft.window?.end ?? "23:00" } })
                      }
                      className="border-b border-ink/30 bg-transparent py-1 font-mono text-[13px] tabular-nums"
                    />
                    <span className="text-ink/35">–</span>
                    <input
                      type="time"
                      value={draft.window?.end ?? ""}
                      onChange={(e) =>
                        patch({ window: { start: draft.window?.start ?? "08:00", end: e.target.value } })
                      }
                      className="border-b border-ink/30 bg-transparent py-1 font-mono text-[13px] tabular-nums"
                    />
                  </div>
                </>
              )}

              {whenMode === "at" && (
                <>
                  <input
                    type="time"
                    value={draft.fixedAt?.start ?? ""}
                    onChange={(e) =>
                      patch({ fixedAt: e.target.value ? { start: e.target.value } : undefined })
                    }
                    className="border-b border-ink/30 bg-transparent py-1 font-mono text-[15px] tabular-nums"
                  />
                  <span className="label text-ink/35">same time every day</span>
                </>
              )}
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            {chosen.length > 0 && <span className="label text-ink/35">{chosen.join(" · ")}</span>}
            <button
              type="button"
              onClick={() => setStep((s) => (s !== null && s > 0 ? s - 1 : null))}
              className="label border border-ink/40 px-2 py-1 text-ink/55 hover:bg-ink hover:text-paper"
            >
              Back
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="flex gap-2 py-4"
      >
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
      </form>
    </div>
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
      className={`label h-8 border px-2.5 ${
        active ? "border-ink bg-ink/10 text-ink" : "border-ink/25 text-ink/45 hover:border-ink"
      }`}
    >
      {label}
    </button>
  )
}

