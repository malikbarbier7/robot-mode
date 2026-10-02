"use client"

import { useEffect, useRef, useState } from "react"
import type { Activity, Schedule, Settings } from "@/lib/types"
import { mealsOf } from "@/lib/meals"
import { Command, Console, SCREEN_HEIGHT, useTerminal } from "./Machine"

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
 * from the real input and the real result. Enter or a click skips to the end.
 * Once complete, the screen goes on by itself to draw the week in, as a draft
 * to adjust before it is printed.
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
    ["Available time", schedule.budget.allocatableMinutesPerWeek, "MIN"],
  ]

  const readEnd = lines.length * LINE_MS + COUNT_MS
  const total = readEnd + STAGES.length * STAGE_MS

  const [t, setT] = useState(0)
  // When the clock started. Skipping moves it back, so the timer lands on the end by itself.
  const started = useRef(0)
  const complete = t >= total

  useEffect(() => {
    started.current = performance.now()
    const id = setInterval(() => {
      const elapsed = performance.now() - started.current
      setT(elapsed)
      if (elapsed >= total) clearInterval(id)
    }, 40)
    return () => clearInterval(id)
    // Runs once: the schedule is already solved, this only paces the reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const root = useRef<HTMLDivElement>(null)
  const skip = () => {
    started.current = performance.now() - total
    setT(total)
  }
  useTerminal(root, { onEnter: complete ? onDone : skip, focusKey: complete })

  // A beat on the result, then on to the week.
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  useEffect(() => {
    if (!complete) return
    const t = window.setTimeout(() => done.current(), 1400)
    return () => clearTimeout(t)
  }, [complete])

  const allocated = schedule.blocks.reduce((n, b) => n + b.endMinute - b.startMinute, 0)
  const conflicts = schedule.unplaced.length

  return (
    <div ref={root}>
      <Console
        captions={["Process 04", complete ? `Draft ready · ${schedule.blocks.length} blocks` : "Do not switch off the unit"]}
        legend={[["Enter", complete ? "Show the draft" : "Skip", true]]}
      >
        <div
          onClick={skip}
          className={`flex ${SCREEN_HEIGHT} cursor-pointer flex-col font-crt text-[18px] uppercase leading-[1.15] tracking-[0.06em] sm:text-[22px]`}
        >
          {complete ? (
            <div className="flex flex-1 flex-col justify-center">
              <div className="text-ink/60">Process complete</div>
              <div className="mt-4 space-y-0.5">
                <div>{allocated} minutes allocated</div>
                <div>07 days generated</div>
                <div className={conflicts > 0 ? "text-ink" : ""}>
                  {pad(conflicts)} {conflicts === 1 ? "conflict" : "conflicts"}
                  {conflicts > 0 && <span className="text-ink/60"> — see output</span>}
                </div>
              </div>
              <div className="mt-10 text-[44px] leading-[0.95] tracking-[0.04em] sm:text-[68px]">
                Your week has been
                <br />
                generated.
              </div>
              <div className="mt-6 text-ink/60">
                Drawing the draft<span className="blink">_</span>
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

          <div className="mt-auto flex justify-end border-t border-ink/30 pt-5">
            <Command keyName="Enter" onClick={complete ? onDone : skip} primary={complete}>
              {complete ? "Show the draft ▶" : "Skip"}
            </Command>
          </div>
        </div>
      </Console>
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
  ].filter(Boolean).length
}

function clamp(n: number): number {
  return Math.min(Math.max(n, 0), 1)
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
