"use client"

import { useRef, useState } from "react"
import type { Activity, Schedule, Settings } from "@/lib/types"
import type { Template } from "@/lib/templates"
import { Command, Console, SCREEN_HEIGHT, useTerminal, type LegendKey } from "./Machine"
import { ActivitiesTerminal, HoursTerminal, MealsTerminal } from "./Terminals"
import { TemplateLibrary } from "./TemplateLibrary"

const STEP_COUNT = 3

/** The entry line of request 01, and each of its parameter steps, by index. */
const ACTIVITY_LEGENDS: Record<"line" | number, LegendKey[]> = {
  line: [
    ["Enter", "Next field", true],
    ["← →", "Field"],
    ["Del", "Delete line"],
  ],
  0: [
    ["Space", "Pick day", true],
    ["Enter", "Next"],
    ["Esc", "Back"],
  ],
  1: [
    ["Enter", "Next", true],
    ["Space", "Pick"],
    ["Esc", "Back"],
  ],
  2: [
    ["Enter", "Add", true],
    ["Space", "Pick"],
    ["Esc", "Back"],
  ],
}

/** Requests 02–03. */
const LEGENDS: LegendKey[][] = [
  [],
  [
    ["↑ ↓", "Adjust", true],
    ["Enter", "Next field"],
    ["Esc", "Back"],
  ],
  [
    ["Space", "Pick meal", true],
    ["↑ ↓", "Adjust"],
    ["Enter", "Make me a robot"],
  ],
]

/** The template library, browsing and then confirming a replacement. */
const LIBRARY_LEGEND: LegendKey[] = [
  ["↑ ↓", "Choose", true],
  ["Enter", "Load"],
  ["Esc", "Back"],
]
const CONFIRM_LEGEND: LegendKey[] = [
  ["Y", "Replace", true],
  ["N", "Keep mine"],
]

/**
 * The first run, fed to the machine one request at a time: what to do, the
 * operating hours, meals. Every answer lands in the same settings
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
  onPickTemplate,
}: {
  settings: Settings
  schedule: Schedule
  onPatchSettings: (patch: Partial<Settings>) => void
  onAddActivity: (activity: Omit<Activity, "id">) => void
  onUpdateActivity: (id: string, patch: Partial<Activity>) => void
  onRemoveActivity: (id: string) => void
  onDone: () => void
  onPickTemplate: (template: Template) => void
}) {
  const [step, setStep] = useState(0)
  // The template library opens on this same screen, over request 01.
  const [library, setLibrary] = useState(false)
  const [asking, setAsking] = useState<Template | null>(null)
  // The add-activity line's own step, so the legend can follow it into the parameters.
  const [flowStep, setFlowStep] = useState<number | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const last = step === STEP_COUNT - 1
  const canGoOn = step !== 0 || settings.activities.length > 0

  const forward = () => {
    if (!canGoOn) return
    if (last) onDone()
    else setStep(step + 1)
  }
  const back = () => setStep(Math.max(step - 1, 0))

  const closeLibrary = () => {
    setAsking(null)
    setLibrary(false)
  }

  useTerminal(root, {
    onEnter: library ? undefined : forward,
    onEscape: library ? closeLibrary : back,
    focusKey: library ? "library" : step,
  })

  if (library) {
    return (
      <div ref={root}>
        <Console captions={["Input terminal", "Template library"]} legend={asking ? CONFIRM_LEGEND : LIBRARY_LEGEND}>
          <div className={`flex ${SCREEN_HEIGHT} flex-col sm:overflow-y-auto`}>
            <TemplateLibrary
              replacing={settings.activities.length}
              asking={asking}
              onAsk={setAsking}
              onLoad={onPickTemplate}
              onCancel={closeLibrary}
            />
          </div>
        </Console>
      </div>
    )
  }

  return (
    <div ref={root}>
      <Console
        captions={["Input terminal", `Request ${pad(step + 1)} / ${pad(STEP_COUNT)}`]}
        legend={step === 0 ? ACTIVITY_LEGENDS[flowStep ?? "line"] : LEGENDS[step]}
      >
        <div className={`flex ${SCREEN_HEIGHT} flex-col sm:overflow-y-auto`}>
          {step === 0 && (
            <ActivitiesTerminal
              settings={settings}
              schedule={schedule}
              onAddActivity={onAddActivity}
              onUpdateActivity={onUpdateActivity}
              onRemoveActivity={onRemoveActivity}
              onEmptyEnter={forward}
              onStepChange={setFlowStep}
            />
          )}
          {step === 1 && <HoursTerminal settings={settings} onPatchSettings={onPatchSettings} />}
          {step === 2 && <MealsTerminal settings={settings} onPatchSettings={onPatchSettings} />}

          <div className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-ink/30 pt-5">
            {step === 0 ? (
              <Command onClick={() => setLibrary(true)} secondary>
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
      </Console>
    </div>
  )
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
