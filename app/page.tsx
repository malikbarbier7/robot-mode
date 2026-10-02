"use client"

import { useWords } from "@/lib/words"
import { useEffect, useRef, useState } from "react"
import { Boot } from "@/components/Boot"
import { Terminal, type TerminalScreen } from "@/components/Terminal"
import { Generating } from "@/components/Generating"
import { Lamp, PanelSwitch } from "@/components/Machine"
import { Menu, MenuItem } from "@/components/Menu"
import { DisplayProvider } from "@/components/Display"
import { Printout } from "@/components/Printout"
import { Setup } from "@/components/Setup"
import { WeekGrid } from "@/components/WeekGrid"
import { Ticket } from "@/components/Ticket"
import { Button } from "@/components/ui"
import { downloadIcs, downloadText } from "@/lib/ics"
import { fromJson, toJson } from "@/lib/storage"
import { useRobotMode } from "@/lib/useRobotMode"
import { useNow } from "@/lib/useNow"
import { useMachineSound } from "@/lib/useMachineSound"
import { beep, chime, rip, rustle, shred } from "@/lib/sound"
import { weekKey } from "@/lib/printout"
import { BinderDrawer, useArmed } from "@/components/BinderDrawer"

type View = "boot" | "setup" | "print" | "week" | "today" | "generating"
/** The three ways the week comes out of the machine, as the terminal names them. */
type Output = "printout" | "grid" | "today"
const OUTPUT_VIEW: Record<Output, View> = { printout: "print", grid: "week", today: "today" }

export default function Page() {
  const rm = useRobotMode()
  const words = useWords()
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

  // Each view is printed by its own unit, so switching prints it in front of you.
  const showView = (next: Output | "binder") => {
    setTodayTip(false)
    // The binder isn't a view: it is the unit at the right edge, opened and held open.
    if (next === "binder") return setBinderPinned(true)
    // A sheet drawn out of the binder goes back when a view of this week is asked for.
    const wasOut = filedId !== null
    setFiledId(null)
    // Asking for a view after tearing off is asking for a sheet: it prints.
    const wasTorn = torn
    setTorn(false)
    if (OUTPUT_VIEW[next] === view && !wasOut && !wasTorn) return
    // The week was printed once; switching between views shows it, it doesn't print it again.
    // Only an empty printer (after tearing off) prints on the way.
    setFeed(wasTorn)
    setView(OUTPUT_VIEW[next])
  }

  // The binder at the right edge: held open from the terminal, open while a sheet is filed,
  // and the filed sheet drawn out of it (shown in place of the week until it is put back).
  const [binderPinned, setBinderPinned] = useState(false)
  const [receiving, setReceiving] = useState(false)
  const [filedId, setFiledId] = useState<string | null>(null)
  const filed = (rm.state.archive ?? []).find((w) => w.id === filedId) ?? null
  const putBack = () => {
    rustle()
    setFiledId(null)
  }
  // Shredding a filed week: gone from the binder, and from view if it was drawn out.
  const shredFiled = (id: string) => {
    rm.shredFiled(id)
    if (filedId === id) setFiledId(null)
  }
  const shredOut = useArmed(() => {
    if (!filedId) return
    shred()
    shredFiled(filedId)
  })

  // Tearing the sheet off: it flies into the binder with a rip, the week is filed, and the
  // printer is left empty until a fresh sheet is asked for (Form feed, PRINT, or a view).
  const [tearing, setTearing] = useState(false)
  const [torn, setTorn] = useState(false)
  const printFresh = () => {
    setTorn(false)
    setFeed(true)
  }
  const tear = () => {
    if (tearing) return
    setTearing(true)
    setSelectedId(null)
    setScreen(null)
    setFiledId(null)
    rip()
    // The binder runs out to take the sheet, keeps it in view a moment, then slides back.
    setReceiving(true)
    window.setTimeout(() => {
      // The binder keeps the document that was torn off, as it was: the list or the grid.
      rm.tearWeek(view === "print" ? "list" : "grid")
      setTearing(false)
      // The printer stays empty: printing the same week again at once would only make a copy.
      setTorn(true)
      if (view !== "print" && view !== "week") setView("week")
    }, 600)
    window.setTimeout(() => setReceiving(false), 1700)
  }

  useMachineSound(rm.display.sound)

  // Esc puts a drawn-out sheet back, unless it is meant for the prompt or a field.
  useEffect(() => {
    if (!filedId) return
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || binderPinned) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT") && (t as HTMLInputElement).value) return
      rustle()
      setFiledId(null)
    }
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [filedId, binderPinned])

  // Today's date, for the day's ticket.
  const now = useNow()

  // Shown once the sheet is out of the printer.
  const tipVisible = todayTip && showWeekChrome && view === "week" && !feed
  // A new week has begun since this sheet was printed: time to tear it off.
  const weekDue = generated && !!now && !!rm.state.currentWeek && rm.state.currentWeek !== weekKey(now)

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
    // Replacing a list already entered is confirmed on the terminal, before this.
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
                <span aria-hidden>{words.logo}</span>
                <span className="sr-only">{words.name}</span>
              </h1>
              <span className="label text-ink/50">{words.model}</span>
            </button>

            <span className="label flex items-center gap-1.5 text-ink/70">
              <Lamp /> Power
            </span>

            {showWeekChrome && (
              // The three ways to see the week, as keys: the one showing stays pressed.
              <div role="group" aria-label="View" className="flex items-center gap-1.5">
                <button type="button" aria-pressed={view === "print" && !filed} onClick={() => showView("printout")} className="key px-3 py-1.5">
                  ≡ List
                </button>
                <button
                  type="button"
                  aria-pressed={view === "week" && !filed}
                  onClick={() => showView("grid")}
                  className="key flex items-center gap-2 px-3 py-1.5"
                >
                  ▦ Grid
                </button>
                <button
                  type="button"
                  aria-pressed={view === "today" && !filed}
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
            {/* The panel keeps the output; editing the week is the terminal's. */}
            {showWeekChrome && (
              <Button variant="solid" disabled={empty} onClick={exportIcs}>
                Export .ics
              </Button>
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
                  title={`Restore the ${rm.activeTemplate.name} activities, times and meals`}
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

        <div className="relative flex min-h-0 flex-1">
          {showWeekChrome && (
            <BinderDrawer
              weeks={rm.state.archive ?? []}
              pinned={binderPinned}
              receiving={receiving}
              openId={filedId}
              onPin={setBinderPinned}
              onPull={(id) => {
                setSelectedId(null)
                setScreen(null)
                setFiledId(id)
              }}
              onShred={shredFiled}
            />
          )}
          <main className="min-w-0 flex-1 overflow-auto">
            {!rm.hydrated ? null : filed && showWeekChrome ? (
              // A filed sheet drawn out of the binder, in place of the week until it is put back.
              <div key={filed.id} className="pull-out">
                <div className={`mx-auto flex items-center justify-between gap-4 px-4 no-print ${filed.format === "list" ? "mt-6 max-w-[680px]" : "mt-3 max-w-[1000px]"}`}>
                  <span className="label text-ink/60">
                    From the binder · week {filed.week} / {filed.year}
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={shredOut.press}
                      title={shredOut.armed ? "Press again to shred it for good" : "Shred this week (press twice)"}
                      className={`key px-2.5 py-1 ${shredOut.armed ? "!border-alert !bg-alert !text-sheet" : ""}`}
                    >
                      {shredOut.armed ? "Shred? Press again" : "Shred"}
                    </button>
                    <Button onClick={putBack} title="Put the sheet back in the binder (Esc)">
                      Put back ▶
                    </Button>
                  </span>
                </div>
                {/* As it was torn off: the printed list, or the plotted grid. */}
                {filed.format === "list" ? (
                  <Printout
                    settings={{ ...rm.state.settings, wakeTime: filed.wakeTime, sleepTime: filed.sleepTime }}
                    schedule={{ ...rm.schedule, blocks: filed.blocks, unplaced: [] }}
                    selectedId={null}
                    onSelect={() => {}}
                    filed={{ week: filed.week, year: filed.year, at: new Date(filed.filedAt) }}
                  />
                ) : (
                  <WeekGrid
                    settings={{ ...rm.state.settings, wakeTime: filed.wakeTime, sleepTime: filed.sleepTime }}
                    schedule={{ ...rm.schedule, blocks: filed.blocks, unplaced: [] }}
                    selectedId={null}
                    onSelect={() => {}}
                    filed={{ week: filed.week, year: filed.year }}
                  />
                )}
              </div>
            ) : view === "generating" ? (
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
                onPickTemplate={pickTemplate}
              />
            ) : view === "print" && generated ? (
              <Printout
                settings={rm.state.settings}
                schedule={rm.schedule}
                selectedId={selectedId}
                onSelect={select}
                feed={feed}
                onFed={() => setFeed(false)}
                onReplay={printFresh}
                onTear={tear}
                tearing={tearing}
                empty={torn}
              />
            ) : view === "week" && generated ? (
              <WeekGrid
                settings={rm.state.settings}
                schedule={rm.schedule}
                selectedId={selectedId}
                onSelect={select}
                feed={feed}
                onFed={() => setFeed(false)}
                onReplay={printFresh}
                onTear={tear}
                tearing={tearing}
                empty={torn}
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
                  onReplay={printFresh}
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
            onView={showView}
            onTear={tear}
            onFeed={printFresh}
            onShred={(week) => {
              // The latest filed sheet with that week number.
              const found = (rm.state.archive ?? []).find((w) => w.week === week)
              if (!found) return false
              shred()
              shredFiled(found.id)
              return true
            }}
            weekDue={weekDue}
            tip={
              torn
                ? "SHEET FILED · PRESS FORM FEED, OR TYPE FEED, FOR A FRESH ONE"
                : weekDue
                ? `NEW WEEK · TYPE TEAR TO FILE WEEK ${rm.state.currentWeek?.split("-W")[1]} IN THE BINDER AND PRINT THIS ONE`
                : tipVisible
                  ? "TIP: TODAY PRINTS JUST TODAY, AS A TICKET TO KEEP · TYPE T + ENTER, OR PRESS ◫ TODAY"
                  : null
            }
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

