"use client"

import { useEffect, useRef, useState } from "react"
import type { Schedule, Settings } from "@/lib/types"
import { formatHours } from "@/lib/duration"

const TOTAL_MS = 4600

/**
 * The solver finishes in about 30ms. This is deliberate theatre: the week is
 * the payoff, and it lands better with a beat before it. Every line describes
 * something the engine genuinely does, and a click skips straight to the week.
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
  const sessions = settings.activities.reduce((n, a) => n + a.sessionsPerWeek, 0)
  const fixed = settings.activities.filter((a) => a.fixedAt).length

  const steps = [
    "Reading your constraints",
    `Protecting sleep${fixed > 0 ? ` and ${fixed} fixed block${fixed === 1 ? "" : "s"}` : ""}`,
    `Placing ${sessions} session${sessions === 1 ? "" : "s"} by priority`,
    "Spreading them across seven days",
    `Reserving ${formatHours(settings.minFreeMinutesPerDay)} of free time a day`,
    "Comparing 20 arrangements",
    "Keeping the best one",
  ]

  const [visible, setVisible] = useState(0)
  const [progress, setProgress] = useState(0)
  const done = useRef(false)

  const finish = () => {
    if (done.current) return
    done.current = true
    onDone()
  }

  useEffect(() => {
    const started = performance.now()
    const id = setInterval(() => {
      const elapsed = performance.now() - started
      const ratio = Math.min(elapsed / TOTAL_MS, 1)
      setProgress(ratio)
      setVisible(Math.min(Math.floor(ratio * steps.length) + 1, steps.length))
      if (ratio >= 1) {
        clearInterval(id)
        finish()
      }
    }, 60)
    return () => clearInterval(id)
    // Runs once: the schedule is already solved, this only paces the reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <button
      type="button"
      onClick={finish}
      title="Click to skip"
      className="flex h-full w-full cursor-pointer flex-col items-start justify-center px-10 text-left"
    >
      <div className="mx-auto w-full max-w-[620px]">
        <h2 className="font-display text-6xl leading-none">Building your week</h2>

        <ol className="mt-10 space-y-2.5">
          {steps.map((step, i) => (
            <li
              key={step}
              className={`flex items-baseline gap-3 font-mono text-[13px] transition-opacity duration-300 ${
                i < visible ? "opacity-100" : "opacity-0"
              }`}
            >
              <span className={i < visible - 1 ? "text-ink" : "text-ink/40"}>
                {i < visible - 1 ? "▪" : "▸"}
              </span>
              <span className={i < visible - 1 ? "text-ink/55" : "text-ink"}>{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-12 h-3 border border-ink/40">
          <div className="h-full bg-ink" style={{ width: `${progress * 100}%` }} />
        </div>

        <div className="label mt-3 flex justify-between text-ink/40">
          <span>{schedule.blocks.length} blocks placed</span>
          <span>Click to skip</span>
        </div>
      </div>
    </button>
  )
}
