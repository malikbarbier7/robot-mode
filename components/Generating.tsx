"use client"

import { useEffect, useState } from "react"
import type { Activity, Schedule, Settings } from "@/lib/types"
import { mealsOf } from "@/lib/meals"
import { Screen } from "./Machine"

/** When each readout line appears, and how long its number takes to count up. */
const LINE_MS = 200
const COUNT_MS = 400
const STAGE_MS = 620
const BAR_CELLS = 20

/** Each is something the solver genuinely does, in the order it does it. */
const STAGES = ["Checking constraints", "Allocating time", "Balancing load", "Resolving conflicts", "Optimizing sequence"]

/**
 * The solver finishes in about 30ms. This is deliberate theatre: the week is
 * the payoff, and it lands better with a beat before it. Every figure is read
 * from the real input and the real result. A click on the screen skips to the
 * end; the week is only shown when VIEW is pressed.
 */
export function Generating({
  settings,
  schedule,
  onDone,
}: {
  settings: Settings
  schedule: Schedule
  onDone: () => void
}) {
  const activities = settings.activities
  const lines: [string, number, string?][] = [
    ["Activities", activities.length],
    ["Constraints", activities.reduce((n, a) => n + constraintCount(a), 0)],
    ["Fixed events", activities.filter((a) => a.fixedAt).length],
    ["Meals", mealsOf(settings).filter((m) => m.enabled).length],
    ["Free time", settings.minFreeMinutesPerDay, "MIN"],
    ["Available time", schedule.budget.allocatableMinutesPerWeek, "MIN"],
  ]

  const readEnd = lines.length * LINE_MS + COUNT_MS
  const total = readEnd + STAGES.length * STAGE_MS

  const [t, setT] = useState(0)
  const complete = t >= total

  useEffect(() => {
    const started = performance.now()
    const id = setInterval(() => {
      const elapsed = performance.now() - started
      setT(elapsed)
      if (elapsed >= total) clearInterval(id)
    }, 40)
    return () => clearInterval(id)
    // Runs once: the schedule is already solved, this only paces the reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allocated = schedule.blocks.reduce((n, b) => n + b.endMinute - b.startMinute, 0)
  const conflicts = schedule.unplaced.length

  return (
    <div className="mx-auto w-full max-w-[1000px] px-6 py-8">
      <Screen
        caption={
          <>
            <span>Process 04</span>
            <span>{complete ? "Output ready" : "Working — click the screen to skip"}</span>
          </>
        }
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => setT(total)}
          onKeyDown={(e) => e.key === "Enter" && setT(total)}
          className="min-h-[440px] cursor-pointer font-crt text-[20px] uppercase leading-[1.15] sm:text-[24px] tracking-[0.06em]"
        >
          {complete ? (
            <div className="flex min-h-[440px] flex-col justify-center">
              <div className="text-ink/60">Process complete</div>
              <div className="mt-4 space-y-0.5">
                <div>{allocated} minutes allocated</div>
                <div>07 days generated</div>
                <div className={conflicts > 0 ? "text-ink" : ""}>
                  {pad(conflicts)} {conflicts === 1 ? "conflict" : "conflicts"}
                  {conflicts > 0 && <span className="text-ink/60"> — see output</span>}
                </div>
              </div>
              <div className="mt-10 text-[48px] leading-[0.95] tracking-[0.04em] sm:text-[80px]">
                Your week has been
                <br />
                generated.
              </div>
              <div className="mt-6 text-ink/60">
                Output ready<span className="blink">_</span>
              </div>
            </div>
          ) : (
            <>
              <div className="text-ink/60">System input complete</div>
              <div className="mt-4">Analyzing input</div>
              <dl className="mt-2">
                {lines.map(([name, value, unit], i) => {
                  const shown = t - i * LINE_MS
                  const counted = Math.round(value * clamp(shown / COUNT_MS))
                  return (
                    <div key={name} className={`flex items-baseline gap-2 ${shown > 0 ? "" : "invisible"}`}>
                      <dt>{name}</dt>
                      <span className="flex-1 overflow-hidden whitespace-nowrap text-ink/35">
                        {".".repeat(80)}
                      </span>
                      <dd className="tabular-nums">
                        {pad(counted)}
                        {unit && ` ${unit}`}
                      </dd>
                    </div>
                  )
                })}
              </dl>

              <div className="mt-6 space-y-1">
                {STAGES.map((stage, i) => {
                  const ratio = clamp((t - readEnd - i * STAGE_MS) / STAGE_MS)
                  if (t < readEnd + i * STAGE_MS) return null
                  const filled = Math.round(ratio * BAR_CELLS)
                  return (
                    <div key={stage} className="flex items-baseline gap-4 whitespace-nowrap">
                      <span className="w-[250px] shrink-0">
                        {stage}
                        {ratio < 1 ? "..." : ""}
                      </span>
                      <span className="min-w-0 flex-1 overflow-hidden tracking-normal">
                        {"█".repeat(filled)}
                        <span className="text-ink/25">{"░".repeat(BAR_CELLS - filled)}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">{String(Math.round(ratio * 100)).padStart(3, "0")}%</span>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6">
                Calculating<span className="blink">_</span>
              </div>
            </>
          )}
        </div>
      </Screen>

      <div className="mt-6 flex items-center justify-between gap-4">
        <span className="label text-ink/60">
          {complete ? `${schedule.blocks.length} blocks placed` : "Do not switch off the unit"}
        </span>
        <button type="button" onClick={onDone} disabled={!complete} className="key key-dark px-12 py-4 text-[13px]">
          View ▶
        </button>
      </div>
    </div>
  )
}

/** Everything the user pinned down beyond name, length and count. */
function constraintCount(activity: Activity): number {
  return [
    activity.allowedDays !== undefined,
    activity.window !== undefined,
    activity.fixedAt !== undefined,
    (activity.bufferMinutes ?? 0) > 0,
    activity.priority !== "medium",
  ].filter(Boolean).length
}

function clamp(n: number): number {
  return Math.min(Math.max(n, 0), 1)
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
