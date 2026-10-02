"use client"

import { useEffect, useRef, useState } from "react"
import type { Activity } from "@/lib/types"
import {
  STEPS,
  WINDOW_PRESETS,
  draftToActivity,
  isDraftValid,
  type Draft,
} from "@/lib/draft"
import { reject } from "./Machine"
import { ClockReadout, Readout } from "./Readout"
import { useDisplay } from "./Display"
import { weekOrder } from "@/lib/locale"

const FIELD = "border-0 border-b border-ink/25 bg-transparent px-0 py-2 text-[22px] placeholder:text-ink/30"
const CHIP = "label h-8 border px-2.5"
/** min-w keeps the slot steady when Next turns into Add on the last step. */
const PRIMARY =
  "label min-w-[64px] border border-ink bg-ink px-3 py-1 text-paper hover:bg-paper hover:text-ink disabled:border-ink/25 disabled:bg-transparent disabled:text-ink/30"
const SECONDARY =
  "label min-w-[64px] border border-ink/40 px-3 py-1 text-ink/60 hover:bg-ink hover:text-paper disabled:opacity-30"
const DAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const
const BUFFERS = [15, 30, 45, 60]

/**
 * Name, duration and frequency, then an optional walk through the constraints.
 * The steps take over the same row rather than stacking above it, so the block
 * never grows and the eye stays in one place.
 *
 * Capturing constraints here is the point: preferences the engine knows up front
 * don't have to be fixed by hand after the week is generated.
 */
export function AddActivityFlow({
  onAdd,
  onEmptyEnter,
  onStepChange,
}: {
  onAdd: (activity: Omit<Activity, "id">) => void
  /** Enter with nothing typed: the list is done. */
  onEmptyEnter?: () => void
  /** Which constraint step is showing (null on the entry line), for the screen's key legend. */
  onStepChange?: (step: number | null) => void
}) {
  const { weekStart } = useDisplay()
  const form = useRef<HTMLFormElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const sessionsInput = useRef<HTMLInputElement>(null)
  const timeField = useRef<HTMLSpanElement>(null)
  const firstTimeReadout = () => timeField.current?.querySelector<HTMLElement>("[data-readout]") ?? null
  const [name, setName] = useState("")
  // Minutes, or null until either half of the --:-- readout is touched.
  const [duration, setDuration] = useState<number | null>(null)
  const [sessionsText, setSessionsText] = useState("")
  const [draft, setDraft] = useState<Draft>({ name: "", durationMinutes: 0, sessionsPerWeek: 1 })
  const [step, setStep] = useState<number | null>(null)
  const [atMode, setAtMode] = useState(false)

  const minutes = duration ?? 0
  const setHours = (h: number) => setDuration(h * 60 + (duration ?? 0) % 60)
  const setMinutes = (m: number) => setDuration(Math.floor((duration ?? 0) / 60) * 60 + m)
  const current: Draft = {
    ...draft,
    name,
    durationMinutes: minutes,
    sessionsPerWeek: Number(sessionsText || "1"),
  }
  const valid = isDraftValid(current)
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))

  const reset = () => {
    setName("")
    setDuration(null)
    setSessionsText("")
    setDraft({ name: "", durationMinutes: 0, sessionsPerWeek: 1 })
    setStep(null)
    setAtMode(false)
    // Back to the start of the line, ready for the next one. From a constraint
    // step the name field only returns on the next render, hence the timeout.
    nameInput.current?.focus()
    setTimeout(() => nameInput.current?.focus(), 0)
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

  /** One constraint step back; from the first, back to the line where the count was typed. */
  const back = () => {
    if (step === null) return
    if (step > 0) return setStep(step - 1)
    setStep(null)
    setTimeout(() => sessionsInput.current?.focus(), 0)
  }

  const fixedTime = atMode || draft.fixedAt !== undefined
  const onLastStep = step === STEPS.length - 1

  // Each constraint step opens on its first choice, "Decide for me", so Enter alone skips it.
  useEffect(() => {
    if (step !== null) form.current?.querySelector<HTMLElement>("[data-nav]:not(:disabled)")?.focus()
    onStepChange?.(step)
  }, [step, onStepChange])

  // Switching on "Always at" hands the cursor to its time field, ready to type.
  useEffect(() => {
    if (atMode) firstTimeReadout()?.focus()
  }, [atMode])

  return (
    <form
      ref={form}
      onSubmit={(e) => {
        e.preventDefault()
        if (step !== null && !onLastStep) next()
        else add()
      }}
      onKeyDown={(e) => {
        const target = e.target as HTMLElement
        if (step === null) {
          if (e.key !== "Enter") return
          if (!name && duration === null && !sessionsText) {
            // A blank line submits nothing (its Add is disabled), so Enter is read here.
            e.preventDefault()
            onEmptyEnter?.()
          } else if (target === sessionsInput.current && valid) {
            // The count is the last field: Enter goes on to the constraints, as Next would.
            e.preventDefault()
            next()
          }
        } else if (e.key === "Escape") {
          e.preventDefault()
          back()
        } else if (e.key === "Enter" && !target.hasAttribute("data-flow-back")) {
          // A choice that opens a field of its own ("Always at") takes Enter like
          // Space, and its time readouts pass Enter on field to field (to Add).
          // Otherwise Enter confirms the step; Space picks a choice.
          if (target.hasAttribute("data-enter-toggle") || target.hasAttribute("data-readout")) return
          e.preventDefault()
          // "Always at" with no time given would quietly add an unpinned activity.
          const time = firstTimeReadout()
          if (onLastStep && fixedTime && !draft.fixedAt && time) {
            time.focus()
            return reject(time)
          }
          if (onLastStep) add()
          else next()
        }
      }}
      className="mt-8 flex min-h-[80px] flex-wrap items-center gap-x-2 gap-y-2 border-y-2 border-ink py-4"
    >
      {step === null ? (
        <>
          <input
            ref={nameInput}
            data-nav
            data-autofocus
            className={`${FIELD} min-w-0 flex-1 font-sans`}
            placeholder="Gym"
            aria-label="Activity name"
            aria-invalid={!name.trim()}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {/* Set like the other clocks: hours, then minutes. No units to type. */}
          <span
            className={`${FIELD} flex shrink-0 items-baseline font-mono tabular-nums ${duration === null ? "text-ink/30" : ""}`}
          >
            <Readout
              label="Duration, hours"
              value={duration === null ? null : Math.floor(duration / 60)}
              max={23}
              onChange={setHours}
            />
            <span className="ml-1 mr-2 text-[0.6em] opacity-60">H</span>
            <Readout
              label="Duration, minutes"
              value={duration === null ? null : duration % 60}
              max={59}
              step={15}
              onChange={setMinutes}
              invalid={!minutes}
            />
            <span className="ml-1 text-[0.6em] opacity-60">M</span>
          </span>
          <input
            data-nav
            className={`${FIELD} w-16 shrink-0 font-mono tabular-nums`}
            ref={sessionsInput}
            placeholder="4×"
            aria-label="Times per week"
            // The last field: Enter moves on to the constraints, so it only accepts a complete line.
            aria-invalid={!valid}
            value={sessionsText}
            onChange={(e) => setSessionsText(e.target.value)}
          />
        </>
      ) : (
        <>
          <span className="label shrink-0">
            {step + 1}/{STEPS.length} {STEPS[step]}
          </span>

          {step === 0 && (
            <>
              <Skip active={!draft.allowedDays?.length} onClick={() => patch({ allowedDays: undefined })} />
              <div className="flex gap-1">
                {weekOrder(weekStart).map((day) => {
                  const on = draft.allowedDays?.includes(day) ?? false
                  return (
                    <button
                      data-nav
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
              {/* On its own line under the whole row, after Back / Next. */}
              <p className="order-last basis-full font-crt text-[24px] uppercase tracking-[0.12em]">
                Space to pick day
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <Skip
                active={!draft.bufferMinutes}
                onClick={() => patch({ bufferMinutes: undefined })}
                label="No buffer"
              />
              <div className="flex gap-1">
                {BUFFERS.map((b) => (
                  <button
                    data-nav
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
            </>
          )}

          {step === 2 && (
            <>
              <Skip
                active={!draft.window && !draft.fixedAt}
                onClick={() => {
                  setAtMode(false)
                  patch({ window: undefined, fixedAt: undefined })
                }}
              />
              <button
                data-nav
                data-enter-toggle
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
                <span
                  ref={timeField}
                  className={`flex items-baseline border-b border-ink/30 py-1 font-mono text-[22px] tabular-nums ${
                    draft.fixedAt ? "" : "text-ink/30"
                  }`}
                >
                  <ClockReadout
                    label="Always at"
                    value={draft.fixedAt?.start ?? null}
                    onChange={(start) => patch({ fixedAt: { start } })}
                  />
                </span>
              )}
              {/* A fixed time and a window are exclusive, so the presets step aside. */}
              {!fixedTime &&
                WINDOW_PRESETS.map((w) => (
                  <button
                    data-nav
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
            </>
          )}
        </>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/*
         * Two fixed slots. The right one is always the forward action, so Next
         * never moves between the opening row and the first step — clicking the
         * same place twice used to land on Back.
         */}
        {/*
         * Distinct keys, and only the opening row's Add is a submit. Without
         * both, clicking Next let React reuse the same DOM node and flip its
         * type to "submit" mid-click — the browser then ran the click's default
         * action on what had become a submit button, so step 4 was skipped and
         * the activity was added instead.
         */}
        {step === null ? (
          <button key="add-now" type="submit" data-nav disabled={!valid} className={SECONDARY}>
            Add
          </button>
        ) : (
          <button
            data-nav
            key="back"
            type="button"
            data-flow-back
            data-enter-skip
            onClick={back}
            className={SECONDARY}
          >
            Back
          </button>
        )}

        {onLastStep ? (
          <button key="add-done" type="button" data-nav onClick={add} disabled={!valid} className={PRIMARY}>
            Add
          </button>
        ) : (
          <button
            data-nav
            key="next"
            type="button"
            onClick={next}
            disabled={!valid}
            title="Set days, travel buffer and preferred time"
            className={PRIMARY}
          >
            Next
          </button>
        )}
      </div>
    </form>
  )
}

/** Every step can be left unanswered; the scheduler decides instead. Always the leftmost choice. */
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
      data-nav
      type="button"
      onClick={onClick}
      className={`${CHIP} ${active ? "border-ink bg-ink/10 text-ink" : "border-ink/25 text-ink/45 hover:border-ink"}`}
    >
      {label}
    </button>
  )
}
