"use client"

import { useMemo, useRef, useState } from "react"
import { BlockBar } from "@/components/BlockBar"
import { Boot } from "@/components/Boot"
import { BudgetBar } from "@/components/BudgetBar"
import { DefinePanel } from "@/components/DefinePanel"
import { Generating } from "@/components/Generating"
import { Lamp, PanelSwitch } from "@/components/Machine"
import { DisplayProvider } from "@/components/Display"
import { localizeTimes } from "@/lib/locale"
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
  // Set when a week has just been generated: the printout is printed in front of you once.
  const [feed, setFeed] = useState(false)

  const empty = rm.state.settings.activities.length === 0
  const generated = rm.state.generated === true
  const home: View = generated ? "print" : "boot"
  // Once the first run has started it stays on its path, whatever it saves.
  if (chosenView === null && rm.hydrated && home === "boot") setView("boot")
  const view: View = chosenView ?? home
  // The week and everything that edits it only exist on the two output views.
  const showWeekChrome = generated && onOutput(view)

  // What the header's status lamp reads.
  const status =
    view === "boot"
      ? "Ready"
      : view === "setup" || view === "templates"
        ? "Awaiting input"
        : view === "generating"
          ? "Processing"
          : rm.schedule.unplaced.length > 0
            ? "Output · check"
            : "Output ready"

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
    <DisplayProvider value={rm.display}>
      <div className="flex h-screen flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b-2 border-ink px-6 py-3 no-print">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <button type="button" onClick={() => setView(home)} className="flex items-baseline gap-4 text-left">
              {/*
               * Soviet-poster nameplate: a Cyrillic lookalike stands in for the B,
               * the way Soviet-imitation lettering does. Read aloud as the real name.
               */}
              <h1 className="font-logo text-[24px] uppercase leading-none tracking-[0.18em]">
                <span aria-hidden>ROБOT MODE</span>
                <span className="sr-only">Robot Mode</span>
              </h1>
              <span className="label text-ink/50">RM-01</span>
            </button>

            {showWeekChrome && (
              // The one control that matters once the week exists: sheet or grid.
              <PanelSwitch
                left="Printout"
                right="Grid"
                on={view === "week"}
                onChange={(grid) => {
                setFeed(false)
                setView(grid ? "week" : "print")
              }}
                label="Show the grid instead of the printout"
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="label mr-3 flex items-center gap-2 text-ink/60">
              Power <Lamp blink={view === "generating"} />
              <span className="ml-2 text-ink">{status}</span>
            </span>
            {/* How times and weeks read. Stored in 24h from Monday regardless. */}
            <PanelSwitch
              small
              left="24H"
              right="12H"
              on={rm.display.clock === "12h"}
              onChange={(on) => rm.setDisplay({ clock: on ? "12h" : "24h" })}
              label="Clock: 24-hour or 12-hour"
            />
            <PanelSwitch
              small
              left="Mon"
              right="Sun"
              on={rm.display.weekStart === "sunday"}
              onChange={(on) => rm.setDisplay({ weekStart: on ? "sunday" : "monday" })}
              label="Week starts on Monday or Sunday"
            />
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
                  if (!window.confirm("Erase this week and everything you entered, and start over?\n\nUse Save first if you want to keep it.")) return
                  rm.wipe()
                  setSelectedId(null)
                  setView("boot")
                }}
                title="Erase the week and everything entered, and start again from a blank machine"
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
                          — {localizeTimes(u.why, rm.display.clock)}
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
                                {localizeTimes(fix.label, rm.display.clock)}
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
                  setFeed(true)
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
                feed={feed}
                onFed={() => setFeed(false)}
                onReplay={() => setFeed(true)}
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
    </DisplayProvider>
  )
}

function onOutput(view: View): boolean {
  return view === "print" || view === "week"
}
