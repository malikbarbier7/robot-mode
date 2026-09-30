"use client"

import { useRef, useState } from "react"
import type { Activity, Schedule, Settings } from "@/lib/types"
import { Command, Legend, Screen, useTerminal } from "./Machine"
import { ActivitiesTerminal, FreeTimeTerminal, HoursTerminal, MealsTerminal } from "./Terminals"

const STEP_COUNT = 4

/** What the panel's legend lists on each request. */
const LEGENDS: [string, string][][] = [
  [
    ["Enter", "Next field · next parameter"],
    ["← →", "Field"],
    ["Space", "Pick"],
    ["Esc", "Parameter back"],
    ["Del", "Delete line"],
  ],
  [
    ["Enter", "Next field"],
    ["← →", "Field"],
    ["↑ ↓", "Adjust"],
    ["0–9", "Type"],
    ["Esc", "Back"],
  ],
  [
    ["Enter", "Next field"],
    ["← →", "Field"],
    ["↑ ↓", "Adjust · line"],
    ["Space", "Switch"],
    ["Esc", "Back"],
  ],
  [
    ["↑ ↓", "Adjust"],
    ["0–9", "Type"],
    ["Enter", "Next · make me a robot"],
    ["Esc", "Back"],
  ],
]

/**
 * The first run, fed to the machine one request at a time: what to do, the
 * operating hours, meals, free time. Every answer lands in the same settings
 * the output side panel edits, so the week that follows is built from these.
 *
 * It is driven like a terminal: the commands are on the screen and the
 * keyboard reaches everything. The mouse still works, but nothing needs it.
 */
export function Setup({
  settings,
  schedule,
  onPatchSettings,
  onAddActivity,
  onUpdateActivity,
  onRemoveActivity,
  onDone,
  onOpenTemplates,
}: {
  settings: Settings
  schedule: Schedule
  onPatchSettings: (patch: Partial<Settings>) => void
  onAddActivity: (activity: Omit<Activity, "id">) => void
  onUpdateActivity: (id: string, patch: Partial<Activity>) => void
  onRemoveActivity: (id: string) => void
  onDone: () => void
  onOpenTemplates: () => void
}) {
  const [step, setStep] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const last = step === STEP_COUNT - 1
  const canGoOn = step !== 0 || settings.activities.length > 0

  const forward = () => {
    if (!canGoOn) return
    if (last) onDone()
    else setStep(step + 1)
  }
  const back = () => setStep(Math.max(step - 1, 0))

  useTerminal(root, { onEnter: forward, onEscape: back, focusKey: step })

  return (
    <div ref={root} className="mx-auto w-full max-w-[1440px] px-6 py-6">
      <Screen
        padding="px-6 py-6 sm:px-14 sm:py-12"
        caption={
          <>
            <span>Input terminal</span>
            <span className="tabular-nums">
              Request {pad(step + 1)} / {pad(STEP_COUNT)}
            </span>
          </>
        }
      >
        <div className="flex min-h-[max(480px,calc(100vh-350px))] flex-col">
          {step === 0 && (
            <ActivitiesTerminal
              settings={settings}
              schedule={schedule}
              onAddActivity={onAddActivity}
              onUpdateActivity={onUpdateActivity}
              onRemoveActivity={onRemoveActivity}
              onEmptyEnter={forward}
            />
          )}
          {step === 1 && <HoursTerminal settings={settings} onPatchSettings={onPatchSettings} />}
          {step === 2 && <MealsTerminal settings={settings} onPatchSettings={onPatchSettings} />}
          {step === 3 && <FreeTimeTerminal settings={settings} onPatchSettings={onPatchSettings} />}

          <div className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-ink/30 pt-5">
            {step === 0 ? (
              <Command onClick={onOpenTemplates} secondary>
                Load a template
              </Command>
            ) : (
              <Command keyName="Esc" onClick={back} secondary>
                ◀ Back
              </Command>
            )}
            {last ? (
              <Command keyName="Enter" onClick={onDone} primary>
                Make me a robot ▶
              </Command>
            ) : (
              <Command keyName="Enter" onClick={forward} disabled={!canGoOn}>
                Continue ▶
              </Command>
            )}
          </div>
        </div>
      </Screen>

      <Legend keys={LEGENDS[step]} />
    </div>
  )
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
