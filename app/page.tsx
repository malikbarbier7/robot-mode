"use client"

import { useRef, useState } from "react"
import { Boot } from "@/components/Boot"
import { Terminal, type TerminalScreen } from "@/components/Terminal"
import { Generating } from "@/components/Generating"
import { Lamp, PanelSwitch } from "@/components/Machine"
import { Menu, MenuItem } from "@/components/Menu"
import { DisplayProvider } from "@/components/Display"
import { Printout } from "@/components/Printout"
import { Setup } from "@/components/Setup"
import { Templates } from "@/components/Templates"
import { WeekGrid } from "@/components/WeekGrid"
import { Ticket } from "@/components/Ticket"
import { Button } from "@/components/ui"
import { downloadIcs, downloadText } from "@/lib/ics"
import { fromJson, toJson } from "@/lib/storage"
import { useRobotMode } from "@/lib/useRobotMode"
import { useNow } from "@/lib/useNow"
import { useMachineSound } from "@/lib/useMachineSound"
import { beep, chime } from "@/lib/sound"

type View = "boot" | "setup" | "print" | "week" | "today" | "templates" | "generating"
/** The three ways the week comes out of the machine, as the terminal names them. */
type Output = "printout" | "grid" | "today"
const OUTPUT_VIEW: Record<Output, View> = { printout: "print", grid: "week", today: "today" }

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
  // Set when a week has just been generated: today's ticket is pointed out until another view is opened.
  const [todayTip, setTodayTip] = useState(false)

  const empty = rm.state.settings.activities.length === 0
  const generated = rm.state.generated === true
  // Once a week exists, it opens on the grid: the whole week at a glance.
  const home: View = generated ? "week" : "boot"
  // Once the first run has started it stays on its path, whatever it saves.
  if (chosenView === null && rm.hydrated && home === "boot") setView("boot")
  const view: View = chosenView ?? home
  // The week and everything that edits it only exist on the two output views.
  const showWeekChrome = generated && onOutput(view)

  const selected = rm.schedule.blocks.find((b) => b.id === selectedId) ?? null
  const weekEdits = rm.state.locked.length + rm.state.skipped.length + (rm.notBefore ? 1 : 0)

  // Each view is printed by its own unit, so switching prints it in front of you.
  const showView = (next: Output) => {
    setTodayTip(false)
    if (OUTPUT_VIEW[next] === view) return
    setFeed(true)
    setView(OUTPUT_VIEW[next])
  }
  const output: Output = view === "week" ? "grid" : view === "today" ? "today" : "printout"

  useMachineSound(rm.display.sound)

  // Today's date, for the day's ticket.
  const now = useNow()

  // Shown once the sheet is out of the printer.
  const tipVisible = todayTip && showWeekChrome && view === "week" && !feed

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
    setView(parsed.generated ? "week" : "boot")
  }

  return (
    <DisplayProvider value={rm.display}>
      <div className="flex h-screen flex-col overflow-hidden">
        {/* The machine's own panel: its nameplate, its lamps and its keys. */}
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b-2 border-ink bg-[#cdc5b1] px-6 py-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)] no-print">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <button
              type="button"
              onClick={() => setView(home)}
              className="relative flex items-baseline gap-4 border-2 border-ink bg-paper px-4 py-1.5 text-left"
            >
              {/* The plate's screws. */}
              {["left-1 top-1", "right-1 top-1", "left-1 bottom-1", "right-1 bottom-1"].map((at) => (
                <span key={at} aria-hidden className={`absolute h-1 w-1 rounded-full bg-ink/50 ${at}`} />
              ))}
              {/*
               * Soviet-poster nameplate: a Cyrillic lookalike stands in for the B,
               * the way Soviet-imitation lettering does. Read aloud as the real name.
               */}
              <h1 className="font-logo text-[22px] uppercase leading-none tracking-[0.18em]">
                <span aria-hidden>ROБOT MODE</span>
                <span className="sr-only">Robot Mode</span>
              </h1>
              <span className="label text-ink/50">RM-01</span>
            </button>

            <span className="label flex items-center gap-1.5 text-ink/70">
              <Lamp /> Power
            </span>

            {showWeekChrome && (
              // The three ways to see the week, as keys: the one showing stays pressed.
              <div role="group" aria-label="View" className="flex items-center gap-1.5">
                <button type="button" aria-pressed={view === "print"} onClick={() => showView("printout")} className="key px-3 py-1.5">
                  ≡ Week
                </button>
                <button
                  type="button"
                  aria-pressed={view === "week"}
                  onClick={() => showView("grid")}
                  className="key flex items-center gap-2 px-3 py-1.5"
                >
                  ▦ Grid
                </button>
                <button
                  type="button"
                  aria-pressed={view === "today"}
                  onClick={() => showView("today")}
                  className="key flex items-center gap-2 px-3 py-1.5"
                >
                  ◫ Today
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

            <button
              type="button"
              aria-pressed={rm.display.sound}
              onClick={() => rm.setDisplay({ sound: !rm.display.sound })}
              title={rm.display.sound ? "Switch the sound off" : "Switch the sound on"}
              className="key px-2.5 py-1"
            >
              {rm.display.sound ? "♪ Sound" : "♪ Off"}
            </button>
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
                  chime()
                  setTodayTip(true)
                  setFeed(true)
                  setView("week")
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
                feed={feed}
                onFed={() => setFeed(false)}
                onReplay={() => setFeed(true)}
              />
            ) : view === "today" && generated ? (
              now && (
                <Ticket
                  settings={rm.state.settings}
                  schedule={rm.schedule}
                  now={now}
                  selectedId={selectedId}
                  onSelect={select}
                  feed={feed}
                  onFed={() => setFeed(false)}
                  onReplay={() => setFeed(true)}
                />
              )
            ) : (
              <Boot
                onStart={() => {
                  beep()
                  setView("setup")
                }}
              />
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
            view={output}
            onView={showView}
            tip={tipVisible ? "TIP: TODAY'S TICKET SHOWS WHAT'S ON NOW · TYPE T + ENTER, OR PRESS ◫ TODAY" : null}
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
  return view === "print" || view === "week" || view === "today"
}

