"use client"

import { useWords } from "@/lib/words"
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Boot } from "@/components/Boot"
import { Terminal, type TerminalScreen } from "@/components/Terminal"
import { Generating } from "@/components/Generating"
import { DraftScreen } from "@/components/DraftScreen"
import { Lamp, PanelSwitch } from "@/components/Machine"
import { Menu, MenuItem } from "@/components/Menu"
import { DisplayProvider } from "@/components/Display"
import { Printout } from "@/components/Printout"
import { Setup } from "@/components/Setup"
import { WeekGrid } from "@/components/WeekGrid"
import { Ticket } from "@/components/Ticket"
import { Button } from "@/components/ui"
import { downloadIcs, downloadText } from "@/lib/ics"
import { fromJson, setupFromHash, setupLink, toJson } from "@/lib/storage"
import type { Settings } from "@/lib/types"
import { useRobotMode } from "@/lib/useRobotMode"
import { useNow } from "@/lib/useNow"
import { useMachineSound } from "@/lib/useMachineSound"
import { beep, buzz, chime, rip, rustle, shred } from "@/lib/sound"
import { dayKey, weekKey } from "@/lib/printout"
import { BinderDrawer, useArmed } from "@/components/BinderDrawer"

type View = "boot" | "setup" | "screen" | "print" | "week" | "today" | "generating"
/** The draft on the screen, and the three ways the week comes out of the machine, as the terminal names them. */
type Output = "screen" | "printout" | "grid" | "today"
const OUTPUT_VIEW: Record<Output, View> = { screen: "screen", printout: "print", grid: "week", today: "today" }

export default function Page() {
  const rm = useRobotMode()
  const words = useWords()
  // Null until the user navigates, so the landing screen can follow the saved
  // state once it hydrates: the idle machine before a week exists, the
  // printout after.
  const [chosenView, setView] = useState<View | null>(null)
  // The screen open on the terminal, if any.
  const [screen, setScreen] = useState<TerminalScreen>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  // Set on PRINT: the sheet is printed in front of you once.
  const [feed, setFeed] = useState(false)
  // Set on the first PRINT: today's ticket is pointed out until another view is opened.
  const [todayTip, setTodayTip] = useState(false)
  // Set when a week has just been generated: the screen draws it in.
  const [reveal, setReveal] = useState(false)

  // Today's date, for the day's ticket.
  const now = useNow()
  const empty = rm.state.settings.activities.length === 0
  const generated = rm.state.generated === true
  const phone = usePhone()
  // Once a week exists, it opens on the screen, where the draft is edited. Its paper is the
  // grid, the whole week at a glance; a phone has no room for seven columns, so the printed list.
  const paperView: View = phone ? "print" : "week"
  const home: View = generated ? "screen" : "boot"
  // Once the first run has started it stays on its path, whatever it saves.
  // Arriving from the landing page's Build my week (?start), the machine is already on: straight to the questions.
  const [start] = useState(startRequested)
  useEffect(() => {
    if (start) dropStartFlag()
  }, [start])
  if (chosenView === null && rm.hydrated && home === "boot") setView(start ? "setup" : "boot")
  const view: View = chosenView ?? home
  // The week and everything that edits it only exist on the two output views.
  const showWeekChrome = generated && onOutput(view)

  // A function's screen is open: it takes the machine's screen, in place of the week or the paper.
  const screenOpen = !!screen
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  // What the paper shows: the week as last PRINTed, never the draft.
  const printed = rm.state.printed ?? null
  const paperSettings = printed ? { ...rm.state.settings, wakeTime: printed.wakeTime, sleepTime: printed.sleepTime } : rm.state.settings
  const paperSchedule = { ...rm.schedule, blocks: printed?.blocks ?? [], unplaced: [] }

  // Each view is printed by its own unit, so switching prints it in front of you.
  const showView = (next: Output | "binder") => {
    setTodayTip(false)
    // A view key puts the week (or its paper) back on show: an open function's screen gives way.
    if (next !== "binder" && screen) setScreen(null)
    // The binder isn't a view: it is the unit at the right edge, opened and held open.
    if (next === "binder") return setBinderPinned(true)
    // A sheet drawn out of the binder goes back when a view of this week is asked for.
    const wasOut = filedId !== null
    setFiledId(null)
    if (OUTPUT_VIEW[next] === view && !wasOut) return
    // The week was printed once; switching between views shows it, it doesn't print it again.
    // A printer left empty by a tear-off stays empty until PRINT: coming back to it isn't asking for a copy.
    setFeed(false)
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

  // Tearing a sheet off: it flies into the binder with a rip, and that printer alone is left
  // empty until the next PRINT (the empty slot's key, or typed). Switching views or
  // reloading leaves it empty; the other printers keep their sheets.
  const [tearing, setTearing] = useState(false)
  // Kept with the week, so a reload doesn't print again what was torn off.
  const listTorn = (rm.state.emptied ?? []).includes("list")
  const gridTorn = (rm.state.emptied ?? []).includes("grid")
  // The ticket printer's own empty slot: today's ticket torn off, the week untouched. Tomorrow prints anew.
  const ticketTorn = !!now && rm.state.ticketTornOn === dayKey(now)

  /**
   * PRINT: the draft on the screen goes onto paper, every printer refilled. The first
   * time, the machine turns to the paper to show it coming out; after that you stay on
   * the screen, unless you printed from the paper itself.
   */
  const print = () => {
    const first = printed === null
    rm.printWeek()
    setFeed(true)
    if (first) {
      setTodayTip(true)
      setScreen(null)
      setView(paperView)
    }
  }

  const tear = (): string | void => {
    if (tearing) return
    // Nothing on paper: a week that is over still starts the next one; otherwise there is nothing to file.
    if (!printed) {
      if (!weekDue) return "NOTHING ON PAPER TO TEAR OFF · PRINT FIRST"
      rm.tearWeek("grid", true)
      return
    }
    // On the ticket printer, the ticket is what comes off, unless the week is over: then it's the week's turn.
    if (view === "today" && !weekDue) return tearTicket()
    // From the screen, the paper it tears is the one the machine prints on: the grid, or a phone's list.
    const format = view === "print" || (view !== "week" && phone) ? "list" : "grid"
    if (view !== "print" && view !== "week") setView(format === "list" ? "print" : "week")
    setTearing(true)
    setScreen(null)
    setFiledId(null)
    rip()
    // The binder runs out to take the sheet, keeps it in view a moment, then slides back.
    setReceiving(true)
    window.setTimeout(() => {
      // The binder keeps the document that was torn off, as it was: the list or the grid. A week
      // that is over starts the next one; mid-week it is only a copy filed.
      rm.tearWeek(format, weekDue)
      setTearing(false)
    }, 600)
    window.setTimeout(() => setReceiving(false), 1700)
  }

  // Today's ticket, torn off and filed under Tickets. Only the ticket printer empties.
  const tearTicket = () => {
    if (tearing || !now) return
    setTearing(true)
    setScreen(null)
    rip()
    setReceiving(true)
    window.setTimeout(() => {
      rm.tearTicket(now)
      setTearing(false)
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


  // Shown once the sheet is out of the printer.
  const tipVisible = todayTip && showWeekChrome && view === paperView && !feed
  // A new week has begun since this sheet was printed: time to tear it off.
  const weekDue = generated && !!now && !!rm.state.currentWeek && rm.state.currentWeek !== weekKey(now)

  const saveJson = () => downloadText(toJson(rm.state), "robot-mode.json")

  const restart = () => {
    rm.wipe()
    setScreen(null)
    setView("boot")
  }

  // What leaves the machine is what is on paper.
  const exportIcs = (): string | void => {
    if (!printed) return "NOTHING ON PAPER YET · PRINT FIRST"
    downloadIcs(printed.blocks, { sequence: rm.bumpExport() })
  }

  // Stable, so the screen's reveal timer isn't restarted by every render.
  const stopReveal = useCallback(() => setReveal(false), [])

  const generate = () => {
    setView("generating")
  }

  const pickTemplate = (template: Parameters<typeof rm.applyTemplate>[0]) => {
    // Replacing a list already entered is confirmed on the terminal, before this.
    rm.applyTemplate(template)
    // A template with activities goes straight to the reveal; a blank one has
    // nothing to schedule, so it drops you into the questions to start writing.
    setView(template.settings.activities.length > 0 ? "generating" : "setup")
  }

  // A line under the panel for what happened outside the terminal (it may not be docked yet).
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(t)
  }, [notice])

  // A setup opened from a link, until it is taken or turned down.
  const [linked, setLinked] = useState<Settings | null>(() =>
    typeof window === "undefined" ? null : setupFromHash(window.location.hash),
  )
  // The link has done its job: a reload shouldn't offer it again. A link pasted into a tab
  // already showing the machine only changes the hash, so that is listened for too.
  useEffect(() => {
    const clear = () => window.history.replaceState(null, "", window.location.pathname + window.location.search)
    if (setupFromHash(window.location.hash)) clear()
    const onHash = () => {
      const settings = setupFromHash(window.location.hash)
      if (!settings) return
      clear()
      setLinked(settings)
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])
  const openSetup = (settings: Settings) => {
    setLinked(null)
    rm.loadSetup(settings)
    setScreen(null)
    setView(settings.activities.length > 0 ? "generating" : "setup")
  }
  // Once the saved state is in, an empty machine takes the link at once; a filled one is asked first.
  if (linked && rm.hydrated && empty) openSetup(linked)

  const copySetupLink = async () => {
    try {
      await navigator.clipboard.writeText(setupLink(rm.state.settings, window.location.href))
      setNotice({ text: "Setup link copied · open it on another device, or send it to someone" })
    } catch {
      setNotice({ text: "Couldn't reach the clipboard", error: true })
    }
  }

  const importJson = async (file: File) => {
    const parsed = fromJson(await file.text())
    if (!parsed) {
      buzz()
      setNotice({ text: "That file isn't a Robot Mode backup", error: true })
      return
    }
    setNotice(null)
    rm.replaceState(parsed)
    setView(parsed.generated ? "screen" : "boot")
  }

  return (
    <DisplayProvider value={rm.display}>
      {/* On paper the whole sheet prints: the window-high frame and its inner scrolling are dropped. */}
      <div className="flex h-dvh flex-col overflow-hidden print:block print:h-auto print:overflow-visible">
        {/* The machine's own panel: its nameplate, its lamps and its keys. */}
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b-2 border-ink bg-[#cdc5b1] px-3 py-2 sm:px-6 sm:py-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)] no-print">
          {/* On a phone the views drop to a row of their own, under the nameplate and Menu. */}
          <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
            <button
              type="button"
              onClick={() => setView(home)}
              className="relative flex items-baseline gap-4 border-2 border-ink bg-paper px-3 py-1 text-left sm:px-4 sm:py-1.5"
            >
              {/* The plate's screws. */}
              {["left-1 top-1", "right-1 top-1", "left-1 bottom-1", "right-1 bottom-1"].map((at) => (
                <span key={at} aria-hidden className={`absolute h-1 w-1 rounded-full bg-ink/50 ${at}`} />
              ))}
              {/*
               * Soviet-poster nameplate: a Cyrillic lookalike stands in for the B,
               * the way Soviet-imitation lettering does. Read aloud as the real name.
               */}
              <h1 className="font-logo text-[17px] uppercase leading-none tracking-[0.18em] sm:text-[22px]">
                <span aria-hidden>{words.logo}</span>
                <span className="sr-only">{words.name}</span>
              </h1>
              <span className="label hidden text-ink/50 sm:inline">{words.model}</span>
            </button>

            <span className="label hidden items-center gap-1.5 text-ink/70 sm:flex">
              <Lamp /> Power
            </span>

            {showWeekChrome && (
              // The three ways to see the week, as keys: the one showing stays pressed.
              <div role="group" aria-label="View" className="order-last flex w-full items-center gap-1.5 sm:order-none sm:w-auto [&>button]:max-sm:flex-1 [&>button]:max-sm:justify-center">
                {/* The screen, where the draft is edited; then the three sheets of paper. */}
                <button
                  type="button"
                  aria-pressed={view === "screen" && !filed}
                  onClick={() => showView("screen")}
                  title="The draft: edit the week here, then print it"
                  className="key flex items-center gap-2 whitespace-nowrap px-3 py-1.5 max-sm:px-2"
                >
                  ▣ Screen
                  {rm.unprinted && view !== "screen" && <span aria-hidden title="Changes not printed yet" className="inline-block h-1.5 w-1.5 bg-alert" />}
                </button>
                <span aria-hidden className="mx-1 hidden h-5 w-px bg-ink/30 sm:block" />
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
            {/* The panel only shows: printing, exporting and editing the week are the terminal's keys. */}
            <Menu>
              <MenuItem onClick={() => rm.setDisplay({ sound: !rm.display.sound })} title="Switch the sound on or off">
                {rm.display.sound ? "♪ Sound on" : "♪ Sound off"}
              </MenuItem>
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
                title="Download your setup, week and binder as a file"
              >
                Backup
              </MenuItem>
              <MenuItem onClick={() => fileInput.current?.click()} title="Open a saved setup">
                Load
              </MenuItem>
              <MenuItem onClick={() => void copySetupLink()} disabled={empty} title="A link that opens this setup on another device, or for someone else">
                Copy setup link
              </MenuItem>
              {showWeekChrome && rm.activeTemplate && (
                <MenuItem
                  disabled={!rm.templateEdited}
                  // Asked on the terminal, like everything else that throws work away.
                  onClick={() => setScreen({ name: "reset" })}
                  title={`Restore the ${rm.activeTemplate.name} activities, times and meals`}
                >
                  Reset to {rm.activeTemplate.name}
                </MenuItem>
              )}
              {showWeekChrome && (
                <MenuItem
                  onClick={() => setScreen({ name: "restart" })}
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

        {linked && rm.hydrated ? (
          <div role="alert" className="label flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b-2 border-ink bg-ink px-3 py-2 text-paper sm:px-6 no-print">
            <span>
              This link holds a setup of {linked.activities.length} {linked.activities.length === 1 ? "activity" : "activities"}. Replace yours with it?
            </span>
            <span className="flex gap-2">
              <button type="button" onClick={() => openSetup(linked)} className="border border-paper px-2 py-0.5 hover:bg-paper hover:text-ink">
                Replace
              </button>
              <button type="button" onClick={() => setLinked(null)} className="px-2 py-0.5 underline">
                Keep mine
              </button>
            </span>
          </div>
        ) : (
          notice && (
            <div
              role={notice.error ? "alert" : "status"}
              className={`label flex items-center justify-between gap-4 border-b-2 border-ink px-3 py-2 sm:px-6 no-print ${notice.error ? "bg-alert text-sheet" : "bg-ink text-paper"}`}
            >
              {notice.text}
              <button type="button" onClick={() => setNotice(null)} className="underline">
                Dismiss
              </button>
            </div>
          )
        )}

        <div className="relative flex min-h-0 flex-1 print:block">
          {showWeekChrome && (
            <BinderDrawer
              weeks={rm.state.archive ?? []}
              pinned={binderPinned}
              receiving={receiving}
              openId={filedId}
              onPin={setBinderPinned}
              onPull={(id) => {
                setScreen(null)
                setFiledId(id)
              }}
              onShred={shredFiled}
            />
          )}
          {/* On a phone the binder's spine would sit over the paper's edge: the sheet stops short of it. */}
          <main className={`min-w-0 flex-1 overflow-auto print:overflow-visible ${showWeekChrome ? "max-sm:pr-[22px]" : ""}`}>
            {!rm.hydrated ? null : screenOpen && showWeekChrome ? (
              // The terminal draws its screen here.
              <div ref={setSlot} />
            ) : filed && showWeekChrome ? (
              // A filed sheet drawn out of the binder, in place of the week until it is put back.
              <div key={filed.id} className="pull-out">
                <div className={`mx-auto flex items-center justify-between gap-4 px-4 no-print ${filed.format === "list" ? "mt-6 max-w-[680px]" : filed.format === "ticket" ? "mt-6 max-w-[560px]" : "mt-3 max-w-[1000px]"}`}>
                  <span className="label text-ink/60">
                    From the binder ·{" "}
                    {filed.format === "ticket"
                      ? `ticket · ${new Date(filed.filedAt).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}`
                      : `week ${filed.week} / ${filed.year}`}
                  </span>
                  <span className="flex gap-2">
                    <Button onClick={() => window.print()} title="Download this sheet as a PDF, or send it to your printer">
                      Download ↓
                    </Button>
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
                {/* As it was torn off: the printed list, the plotted grid, or the day's ticket. */}
                {filed.format === "ticket" ? (
                  <Ticket
                    settings={{ ...rm.state.settings, wakeTime: filed.wakeTime, sleepTime: filed.sleepTime }}
                    schedule={{ ...rm.schedule, blocks: filed.blocks, unplaced: [] }}
                    now={new Date(filed.filedAt)}
                    filed
                  />
                ) : filed.format === "list" ? (
                  <Printout
                    settings={{ ...rm.state.settings, wakeTime: filed.wakeTime, sleepTime: filed.sleepTime }}
                    schedule={{ ...rm.schedule, blocks: filed.blocks, unplaced: [] }}
                    filed={{ week: filed.week, year: filed.year, at: new Date(filed.filedAt) }}
                  />
                ) : (
                  <WeekGrid
                    settings={{ ...rm.state.settings, wakeTime: filed.wakeTime, sleepTime: filed.sleepTime }}
                    schedule={{ ...rm.schedule, blocks: filed.blocks, unplaced: [] }}
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
                  setReveal(true)
                  setView("screen")
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
            ) : view === "screen" && generated ? (
              <DraftScreen
                rm={rm}
                phone={phone}
                reveal={reveal}
                onRevealed={stopReveal}
              />
            ) : view === "print" && generated ? (
              <Printout
                settings={paperSettings}
                schedule={paperSchedule}
                feed={feed}
                onFed={() => setFeed(false)}
                onTear={tear}
                tearing={tearing}
                empty={listTorn || !printed}
                never={!printed}
                onFormFeed={print}
              />
            ) : view === "week" && generated ? (
              <WeekGrid
                settings={paperSettings}
                schedule={paperSchedule}
                feed={feed}
                onFed={() => setFeed(false)}
                onTear={tear}
                tearing={tearing}
                empty={gridTorn || !printed}
                never={!printed}
                onFormFeed={print}
              />
            ) : view === "today" && generated ? (
              now && (
                <Ticket
                  settings={paperSettings}
                  schedule={paperSchedule}
                  now={now}
                  feed={feed}
                  onFed={() => setFeed(false)}
                  onTear={tearTicket}
                  tearing={tearing}
                  empty={ticketTorn || !printed}
                  never={!printed}
                  onFormFeed={print}
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
            onExport={exportIcs}
            onBackup={saveJson}
            onPrint={print}
            onLoad={() => fileInput.current?.click()}
            onRestart={restart}
            onView={showView}
            onTear={tear}
            onShred={(week) => {
              // The latest filed sheet of that week (a week's, not a day's ticket).
              const found = (rm.state.archive ?? []).find((w) => w.week === week && w.format !== "ticket")
              if (!found) return false
              shred()
              shredFiled(found.id)
              return true
            }}
            unprinted={rm.unprinted}
            slot={screenOpen ? slot : null}
            tip={
              printed && ((view === "print" && listTorn) || (view === "week" && gridTorn) || (view === "today" && ticketTorn))
                ? "SHEET FILED · TYPE PRINT FOR A FRESH ONE"
                : !printed && view !== "screen"
                ? "NOTHING ON PAPER YET · TYPE PRINT TO PRINT THE DRAFT ON THE SCREEN"
                : rm.unprinted && printed
                ? "THE SCREEN HAS CHANGES THE PAPER DOESN'T · TYPE PRINT TO UPDATE IT"
                : weekDue
                ? `NEW WEEK · TYPE TEAR TO FILE WEEK ${rm.state.currentWeek?.split("-W")[1]} IN THE BINDER AND START THIS ONE`
                : tipVisible
                  ? "TIP: TODAY PRINTS JUST TODAY, AS A TICKET TO KEEP · TYPE T + ENTER, OR PRESS ◫ TODAY"
                  : null
            }
          />
        )}

        <footer className="label hidden justify-end border-t border-ink/40 px-6 py-1.5 text-ink/50 no-print sm:flex">
          <span>Rev. 2.7</span>
        </footer>
      </div>
    </DisplayProvider>
  )
}

/** Whether the visit came from the landing page's Build my week. */
function startRequested(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).has("start")
}

/** Once read, the flag leaves the address, so a reload boots the machine as usual. */
function dropStartFlag() {
  const params = new URLSearchParams(window.location.search)
  params.delete("start")
  const query = params.toString()
  window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : "") + window.location.hash)
}

function onOutput(view: View): boolean {
  return view === "screen" || view === "print" || view === "week" || view === "today"
}


/** Narrower than Tailwind's `sm`: no room for the week's seven columns. False on the server. */
function usePhone(): boolean {
  return useSyncExternalStore(
    (change) => {
      const query = window.matchMedia(PHONE)
      query.addEventListener("change", change)
      return () => query.removeEventListener("change", change)
    },
    () => window.matchMedia(PHONE).matches,
    () => false,
  )
}
const PHONE = "(max-width: 639px)"
