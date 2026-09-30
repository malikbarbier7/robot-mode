"use client"

import { useMemo, useRef, useState } from "react"
import { BlockBar } from "@/components/BlockBar"
import { Boot } from "@/components/Boot"
import { BudgetBar } from "@/components/BudgetBar"
import { DefinePanel } from "@/components/DefinePanel"
import { Generating } from "@/components/Generating"
import { Lamp, Rail, type Phase } from "@/components/Machine"
import { Printout } from "@/components/Printout"
import { Setup } from "@/components/Setup"
import { Templates } from "@/components/Templates"
import { WeekGrid } from "@/components/WeekGrid"
import { Button } from "@/components/ui"
import { downloadIcs, downloadText } from "@/lib/ics"
import { fromJson, toJson } from "@/lib/storage"
import { useRobotMode } from "@/lib/useRobotMode"
import { suggestFixes } from "@/lib/suggest"

type View = "boot" | "setup" | "print" | "week" | "templates" | "generating"

export default function Page() {
  const rm = useRobotMode()
  // Null until the user navigates, so the landing screen can follow the saved
  // state once it hydrates: the idle machine before a week exists, the
  // printout after.
  const [chosenView, setView] = useState<View | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [fixing, setFixing] = useState<string | null>(null)

  const empty = rm.state.settings.activities.length === 0
  const generated = rm.state.generated === true
  const home: View = generated ? "print" : "boot"
  // Once the first run has started it stays on its path, whatever it saves.
  if (chosenView === null && rm.hydrated && home === "boot") setView("boot")
  const view: View = chosenView ?? home
  // The week and everything that edits it only exist on the two output views.
  const showWeekChrome = generated && onOutput(view)

  // The machine's own screens get the side rail; the working views need the room.
  const [phase, status]: [Phase, string] =
    view === "boot"
      ? ["idle", "Ready"]
      : view === "setup" || view === "templates"
        ? ["input", "Awaiting input"]
        : view === "generating"
          ? ["process", "Processing"]
          : ["output", rm.schedule.unplaced.length > 0 ? "Output · check" : "Output ready"]
  const onMachineScreen = view === "boot" || view === "setup" || view === "generating"

  const selected = rm.schedule.blocks.find((b) => b.id === selectedId) ?? null
  const weekEdits = rm.state.locked.length + rm.state.skipped.length + (rm.notBefore ? 1 : 0)

  // Only worked out when asked: each suggestion costs a trial solve to verify.
  const suggestions = useMemo(() => {
    const conflict = rm.schedule.unplaced.find((u) => u.activityId === fixing)
    return conflict ? suggestFixes(rm.state.settings, conflict) : []
  }, [fixing, rm.schedule.unplaced, rm.state.settings])

  const generate = () => {
    setSelectedId(null)
    setView("generating")
  }

  const pickTemplate = (template: Parameters<typeof rm.applyTemplate>[0]) => {
    if (!empty && !window.confirm(`Replace your list with "${template.name}"?`)) return
    rm.applyTemplate(template)
    setSelectedId(null)
    // A template with activities goes straight to the reveal; a blank one has
    // nothing to schedule, so it drops you into the questions to start writing.
    setView(template.settings.activities.length > 0 ? "generating" : "setup")
  }

  const importJson = async (file: File) => {
    const parsed = fromJson(await file.text())
    if (!parsed) {
      window.alert("That file isn't a Robot Mode export.")
      return
    }
    rm.replaceState(parsed)
    setView(parsed.generated ? "print" : "boot")
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b-2 border-ink px-6 py-3 no-print">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <button type="button" onClick={() => setView(home)} className="flex items-baseline gap-4 text-left">
            <h1 className="font-display text-[22px] font-semibold uppercase leading-none tracking-[0.3em]">
              Robot Mode
            </h1>
            <span className="label text-ink/50">RM-01</span>
          </button>

          {showWeekChrome && (
            <OutputSwitch grid={view === "week"} onChange={(grid) => setView(grid ? "week" : "print")} />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="label mr-3 hidden items-center gap-2 text-ink/60 md:flex">
            Power <Lamp />
            <span className="ml-2 text-ink">{status}</span>
          </span>
          {showWeekChrome && (
            <>
              <Button onClick={rm.shuffle} disabled={empty} title="Same constraints, different arrangement">
                Shuffle
              </Button>
              <Button
                onClick={rm.freshWeek}
                disabled={weekEdits === 0}
                title={
                  weekEdits === 0
                    ? "Nothing to clear: no locked blocks, removed blocks or missed sessions"
                    : `Unlock ${rm.state.locked.length} block(s), restore ${rm.state.skipped.length} removed, and undo today's replan`
                }
              >
                Clear edits{weekEdits > 0 ? ` (${weekEdits})` : ""}
              </Button>
              <Button
                variant="solid"
                disabled={empty}
                onClick={() => downloadIcs(rm.schedule.blocks, { sequence: rm.bumpExport() })}
              >
                Export .ics
              </Button>
            </>
          )}

          <Button
            onClick={() => downloadText(toJson(rm.state), "robot-mode.json")}
            disabled={empty}
            title="Back up your setup"
          >
            Save
          </Button>
          <Button onClick={() => fileInput.current?.click()}>Load</Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importJson(file)
              e.target.value = ""
            }}
          />
          {showWeekChrome && (
            <Button
              onClick={() => {
                setSelectedId(null)
                setView("boot")
              }}
              title="Go through the four input requests again, starting from what you have now"
            >
              Restart terminal
            </Button>
          )}
        </div>
      </header>

      {showWeekChrome && (
        <>
          <div className="border-b border-ink/20 no-print">
            <BudgetBar budget={rm.budget} />
          </div>
          {rm.schedule.unplaced.length > 0 && (
            <div className="border-b-2 border-alert bg-alert/[0.07] px-6 py-3 text-alert no-print">
              <div className="label mb-1.5">
                {rm.schedule.unplaced.length === 1
                  ? "1 conflict"
                  : `${rm.schedule.unplaced.length} conflicts`}
              </div>
              <ul className="space-y-1.5">
                {rm.schedule.unplaced.map((u) => (
                  <li key={u.activityId}>
                    <div className="flex items-baseline gap-2 font-mono text-[11px] leading-relaxed">
                      <span className="min-w-0 flex-1">
                        <span className="font-sans text-[12px] font-medium">{u.name}</span>{" "}
                        <span className="tabular-nums opacity-70">
                          {u.sessionsPlaced}/{u.sessionsRequested}
                        </span>{" "}
                        — {u.why}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFixing(fixing === u.activityId ? null : u.activityId)}
                        className="label shrink-0 border border-alert px-2 py-0.5 hover:bg-alert hover:text-paper"
                      >
                        {fixing === u.activityId ? "Close" : "Fix"}
                      </button>
                    </div>

                    {fixing === u.activityId && (
                      <div className="mt-1.5 space-y-1 border-l-2 border-alert/40 pl-3">
                        {suggestions.length === 0 ? (
                          <p className="font-mono text-[11px] opacity-70">
                            No single change fixes this one.
                          </p>
                        ) : (
                          suggestions.map((fix) => (
                            <button
                              key={fix.id}
                              type="button"
                              onClick={() => {
                                rm.patchSettings(fix.settings)
                                setFixing(null)
                              }}
                              className="block w-full border border-alert/40 px-2 py-1 text-left font-mono text-[11px] hover:bg-alert hover:text-paper"
                            >
                              {fix.label}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="flex min-h-0 flex-1">
        {onMachineScreen && <Rail phase={phase} status={status} />}
        {showWeekChrome && (
          <aside className="w-[340px] shrink-0 border-r border-ink/20 no-print">
            <DefinePanel
              settings={rm.state.settings}
              schedule={rm.schedule}
              onPatchSettings={rm.patchSettings}
              onAddActivity={rm.addActivity}
              onUpdateActivity={rm.updateActivity}
              onRemoveActivity={rm.removeActivity}
              template={rm.activeTemplate}
              templateEdited={rm.templateEdited}
              onResetToTemplate={rm.resetToTemplate}
            />
          </aside>
        )}

        <main className="min-w-0 flex-1 overflow-auto">
          {!rm.hydrated ? null : view === "generating" ? (
            <Generating
              settings={rm.state.settings}
              schedule={rm.schedule}
              onDone={() => {
                rm.markGenerated()
                setView("print")
              }}
            />
          ) : view === "setup" ? (
            <Setup
              settings={rm.state.settings}
              schedule={rm.schedule}
              onPatchSettings={rm.patchSettings}
              onAddActivity={rm.addActivity}
              onUpdateActivity={rm.updateActivity}
              onRemoveActivity={rm.removeActivity}
              onDone={generate}
              onOpenTemplates={() => setView("templates")}
            />
          ) : view === "templates" ? (
            <Templates onPick={pickTemplate} onCancel={() => setView(home)} />
          ) : view === "print" && generated ? (
            <Printout
              settings={rm.state.settings}
              schedule={rm.schedule}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : view === "week" && generated ? (
            <WeekGrid
              settings={rm.state.settings}
              schedule={rm.schedule}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <Boot onStart={() => setView("setup")} />
          )}
        </main>
      </div>

      {showWeekChrome && (view === "week" || view === "print") && selected && (
        <BlockBar
          block={selected}
          onToggleLock={() => rm.toggleLock(selected.id)}
          onRemove={() => {
            rm.removeBlock(selected.id)
            setSelectedId(null)
          }}
          onMissed={() => {
            rm.markMissed(selected.id)
            setSelectedId(null)
          }}
          onClose={() => setSelectedId(null)}
        />
      )}

      <footer className="label flex justify-between border-t border-ink/40 px-6 py-1.5 text-ink/50 no-print">
        <span>Wake · Execute · Sleep · Repeat</span>
        <span>Rev. 2.7</span>
      </footer>
    </div>
  )
}

function onOutput(view: View): boolean {
  return view === "print" || view === "week"
}

/**
 * The one control that matters once the week exists: a two-position switch
 * between the printed sheet and the grid.
 */
function OutputSwitch({ grid, onChange }: { grid: boolean; onChange: (grid: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={grid}
      aria-label="Show the grid instead of the printout"
      onClick={() => onChange(!grid)}
      className="key flex items-center gap-3 px-4 py-2 text-[12px]"
    >
      <span className={grid ? "text-ink/40" : ""}>Printout</span>
      <span className="relative h-5 w-11 border border-ink bg-screen">
        <span
          className={`absolute top-[3px] h-3 w-4 bg-phosphor transition-[left] duration-150 ${grid ? "left-[calc(100%-19px)]" : "left-[3px]"}`}
          style={{ filter: "drop-shadow(0 0 3px #ffb238)" }}
        />
      </span>
      <span className={grid ? "" : "text-ink/40"}>Grid</span>
    </button>
  )
}
