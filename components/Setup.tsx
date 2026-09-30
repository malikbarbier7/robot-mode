"use client"

import { useState } from "react"
import type { Activity, Schedule, Settings } from "@/lib/types"
import { Screen } from "./Machine"
import { ActivitiesTerminal, FreeTimeTerminal, HoursTerminal, MealsTerminal } from "./Terminals"

const STEP_COUNT = 4

/**
 * The first run, fed to the machine one request at a time: what to do, the
 * operating hours, meals, free time. Every answer lands in the same settings
 * the input console edits, so the week that follows is built from exactly these.
 *
 * The questions appear on the screen; the keys that move between them are on
 * the panel around it.
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
  const activities = settings.activities
  const last = step === STEP_COUNT - 1
  const canGoOn = step !== 0 || activities.length > 0

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-6">
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
        <div className="min-h-[max(480px,calc(100vh-350px))]">
          {step === 0 && (
            <ActivitiesTerminal
              settings={settings}
              schedule={schedule}
              onAddActivity={onAddActivity}
              onUpdateActivity={onUpdateActivity}
              onRemoveActivity={onRemoveActivity}
            />
          )}
          {step === 1 && <HoursTerminal settings={settings} onPatchSettings={onPatchSettings} />}
          {step === 2 && <MealsTerminal settings={settings} onPatchSettings={onPatchSettings} />}
          {step === 3 && <FreeTimeTerminal settings={settings} onPatchSettings={onPatchSettings} />}
        </div>
      </Screen>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="label text-ink/60">
          {step === 0 && activities.length === 0 ? (
            <>
              No input?{" "}
              <button type="button" onClick={onOpenTemplates} className="text-ink underline underline-offset-4">
                Load a template
              </button>
            </>
          ) : (
            `Input ${pad(step + 1)} / ${pad(STEP_COUNT)} · ${step === 0 ? `${pad(activities.length)} recorded` : "accepted"}`
          )}
        </div>

        <div className="flex items-center gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="key px-6 py-3">
              ◀ Back
            </button>
          )}
          {!last && (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canGoOn}
              className="key key-dark px-8 py-3"
            >
              Enter ▶
            </button>
          )}
        </div>
      </div>

      {last && (
        <button type="button" onClick={onDone} className="key key-dark mt-8 w-full py-7 text-[18px] tracking-[0.3em]">
          Make me a robot
        </button>
      )}
    </div>
  )
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
