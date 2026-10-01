"use client"

import { useRef, useState } from "react"
import { Boot } from "@/components/Boot"
import { Terminal, type TerminalScreen } from "@/components/Terminal"
import { Generating } from "@/components/Generating"
import { PanelSwitch } from "@/components/Machine"
import { Menu, MenuItem } from "@/components/Menu"
import { DisplayProvider } from "@/components/Display"
import { Printout } from "@/components/Printout"
import { Setup } from "@/components/Setup"
import { Templates } from "@/components/Templates"
import { WeekGrid } from "@/components/WeekGrid"
import { Button } from "@/components/ui"
import { downloadIcs, downloadText } from "@/lib/ics"
import { fromJson, toJson } from "@/lib/storage"
import { useRobotMode } from "@/lib/useRobotMode"

type View = "boot" | "setup" | "print" | "week" | "templates" | "generating"

export default function Page() {
  const rm = useRobotMode()
  // Null until the user navigates, so the landing screen can follow the saved
  // state once it hydrates: the idle machine before a week exists, the
  // printout after.
  const [chosenView, setView] = useState<View | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // The screen open on the terminal, if any.
  const [screen, setScreen] = useState<TerminalScreen>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  // Set when a week has just been generated: the printout is printed in front of you once.
  const [feed, setFeed] = useState(false)
  // Set when a week has just been generated: the grid is pointed out until it is looked at.
  const [gridTip, setGridTip] = useState(false)

  const empty = rm.state.settings.activities.length === 0
  const generated = rm.state.generated === true
  const home: View = generated ? "print" : "boot"
  // Once the first run has started it stays on its path, whatever it saves.
  if (chosenView === null && rm.hydrated && home === "boot") setView("boot")
  const view: View = chosenView ?? home
  // The week and everything that edits it only exist on the two output views.
  const showWeekChrome = generated && onOutput(view)

  const selected = rm.schedule.blocks.find((b) => b.id === selectedId) ?? null
  const weekEdits = rm.state.locked.length + rm.state.skipped.length + (rm.notBefore ? 1 : 0)

  const showView = (next: "printout" | "grid") => {
    setFeed(false)
    setGridTip(false)
    setView(next === "grid" ? "week" : "print")
  }

  // Shown once the sheet is out of the printer.
  const tipVisible = gridTip && showWeekChrome && view === "print" && !feed

  // Picking a block on the printout or grid opens it on the terminal.
  const select = (id: string | null) => {
    setSelectedId(id)
    setScreen(id ? { name: "block" } : null)
  }

  const saveJson = () => downloadText(toJson(rm.state), "robot-mode.json")

  const restart = () => {
    rm.wipe()
    setSelectedId(null)
    setScreen(null)
    setView("boot")
  }

  const exportIcs = () => {
    if (!empty) downloadIcs(rm.schedule.blocks, { sequence: rm.bumpExport() })
  }

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
              // The two ways to see the week, as two keys: the one showing stays pressed.
              <div role="group" aria-label="View" className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-pressed={view === "print"}
                  onClick={() => showView("printout")}
                  className="key px-3 py-1.5"
                >
                  ≡ Printout
                </button>
                <button
                  type="button"
                  aria-pressed={view === "week"}
                  onClick={() => showView("grid")}
                  className="key flex items-center gap-2 px-3 py-1.5"
                >
                  ▦ Grid
                  {tipVisible && <span aria-hidden className="blink inline-block h-1.5 w-1.5 bg-phosphor" style={{ animationIterationCount: 6 }} />}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showWeekChrome && (
              <>
                <Button onClick={rm.shuffle} disabled={empty} title="Same constraints, different arrangement">
                  Shuffle
                </Button>
                {/* Only there when there is something to clear. */}
                {weekEdits > 0 && (
                  <Button
                    onClick={rm.freshWeek}
                    title={`Unlock ${rm.state.locked.length} block(s), restore ${rm.state.skipped.length} removed, and undo today's replan`}
                  >
                    Clear edits ({weekEdits})
                  </Button>
                )}
                <Button variant="solid" disabled={empty} onClick={exportIcs}>
                  Export .ics
                </Button>
              </>
            )}

            <Menu>
              {/* How times and weeks read. Stored in 24h from Monday regardless. */}
              <div className="flex gap-2">
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
              </div>
              <MenuItem
                onClick={saveJson}
                disabled={empty}
                title="Back up your setup"
              >
                Save
              </MenuItem>
              <MenuItem onClick={() => fileInput.current?.click()} title="Open a saved setup">
                Load
              </MenuItem>
              {showWeekChrome && rm.activeTemplate && (
                <MenuItem
                  disabled={!rm.templateEdited}
                  onClick={() => {
                    if (window.confirm(`Discard your changes and restore the ${rm.activeTemplate?.name} activities?`)) {
                      rm.resetToTemplate()
                    }
                  }}
                  title={`Restore the ${rm.activeTemplate.name} activities, times and free time`}
                >
                  Reset to {rm.activeTemplate.name}
                </MenuItem>
              )}
              {showWeekChrome && (
                <MenuItem
                  onClick={() => {
                    if (!window.confirm("Erase this week and everything you entered, and start over?\n\nUse Save first if you want to keep it.")) return
                    restart()
                  }}
                  title="Erase the week and everything entered, and start again from a blank machine"
                >
                  Restart terminal
                </MenuItem>
              )}
            </Menu>
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
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-auto">
            {!rm.hydrated ? null : view === "generating" ? (
              <Generating
                settings={rm.state.settings}
                schedule={rm.schedule}
                onDone={() => {
                  rm.markGenerated()
                  setGridTip(true)
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
                onSelect={select}
                feed={feed}
                onFed={() => setFeed(false)}
                onReplay={() => setFeed(true)}
              />
            ) : view === "week" && generated ? (
              <WeekGrid
                settings={rm.state.settings}
                schedule={rm.schedule}
                selectedId={selectedId}
                onSelect={select}
              />
            ) : (
              <Boot onStart={() => setView("setup")} />
            )}
          </main>
        </div>

        {showWeekChrome && (
          <Terminal
            rm={rm}
            screen={screen}
            onScreen={setScreen}
            selected={selected}
            onDeselect={() => setSelectedId(null)}
            onExport={exportIcs}
            onSave={saveJson}
            onLoad={() => fileInput.current?.click()}
            onRestart={restart}
            view={view === "week" ? "grid" : "printout"}
            onView={showView}
            tip={tipVisible ? "TIP: THE WEEK ALSO COMES AS A CALENDAR · TYPE G + ENTER, OR PRESS ▦ GRID" : null}
          />
        )}

        <footer className="label flex justify-end border-t border-ink/40 px-6 py-1.5 text-ink/50 no-print">
          <span>Rev. 2.7</span>
        </footer>
      </div>
    </DisplayProvider>
  )
}

function onOutput(view: View): boolean {
  return view === "print" || view === "week"
}

