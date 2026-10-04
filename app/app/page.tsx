"use client"

import Link from "next/link"
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
import type { PrintedWeek } from "@/lib/storage"
import { fromJson, setupFromHash, setupLink, toJson } from "@/lib/storage"
import type { Settings } from "@/lib/types"
import { templateById, type Template } from "@/lib/templates"
import { useRobotMode } from "@/lib/useRobotMode"
import { useNow } from "@/lib/useNow"
import { useMachineSound } from "@/lib/useMachineSound"
import { beep, buzz, chime, rip, rustle, shred } from "@/lib/sound"
import { dateInWeek, dayKey, ticketDay, weekKey } from "@/lib/printout"
import { momentOf } from "@/lib/today"
import type { Day } from "@/lib/types"
import { BinderDrawer, useArmed } from "@/components/BinderDrawer"
import { ticketContent } from "@/lib/ticket"
import { saveImage, ticketImage, ticketStrip, ticketWallpaper } from "@/lib/ticketImage"

type View = "boot" | "setup" | "screen" | "print" | "week" | "today" | "generating"
/** The draft on the screen, and the three ways the week comes out of the machine, as the terminal names them. */
type Output = "screen" | "printout" | "grid" | "today"
const OUTPUT_VIEW: Record<Output, View> = { screen: "screen", printout: "print", grid: "week", today: "today" }
/** The days of the week on paper, in the order of their dates (the week runs Monday to Sunday underneath). */
const WEEK: Day[] = [0, 1, 2, 3, 4, 5, 6]
const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

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
  // The week as last printed, on whichever printer.
  const printed = rm.state.printed ?? null
  // What each printer holds: each prints on its own, and keeps its sheet until it prints again or it is torn off.
  const sheets = rm.state.sheets ?? {}
  const onPaper = (sheet: PrintedWeek | null | undefined) => ({
    settings: sheet ? { ...rm.state.settings, wakeTime: sheet.wakeTime, sleepTime: sheet.sleepTime } : rm.state.settings,
    schedule: { ...rm.schedule, blocks: sheet?.blocks ?? [], unplaced: [] },
  })

  // The ticket printer prints any day of the week on paper, with that day's date in it: there is one
  // calendar at a time, so one Monday. Today's, when today is in that week; the week's first day otherwise.
  const paperWeek = rm.state.currentWeek ?? (now ? weekKey(now) : null)
  const [ticketPick, setTicketPick] = useState<Day | null>(null)
  const shownDay: Day = ticketPick ?? (now && paperWeek === weekKey(now) ? momentOf(now).day : 0)
  const ticketDate = paperWeek ? dateInWeek(paperWeek, shownDay) : now
  const ticketOf = (date: Date) => sheets.tickets?.[dayKey(date)]
  const ticketSheet = ticketDate ? ticketOf(ticketDate) : undefined
  /** Another day's ticket: it feeds out of the printer, if that day's has been printed. */
  const pickDay = (day: Day) => {
    if (day === shownDay) return
    setTicketPick(day)
    if (paperWeek && ticketOf(dateInWeek(paperWeek, day))) setFeed(true)
  }

  // Each view is printed by its own unit, so switching prints it in front of you.
  const showView = (next: Output | "binder", day?: Day) => {
    setTodayTip(false)
    // A view key puts the week (or its paper) back on show: an open function's screen gives way.
    if (next !== "binder" && screen) setScreen(null)
    // The binder isn't a view: it is the unit at the right edge, opened and held open.
    if (next === "binder") return setBinderPinned(true)
    // A sheet drawn out of the binder goes back when a view of this week is asked for.
    const wasOut = filedId !== null
    setFiledId(null)
    // On the ticket printer already, a day named is that day's ticket; TODAY alone is today's again.
    if (next === "today" && view === "today" && !wasOut) {
      const today = now && paperWeek === weekKey(now) ? momentOf(now).day : 0
      pickDay(day ?? today)
      return setTicketPick(day ?? null)
    }
    if (next === "today") setTicketPick(day ?? null)
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
  // A sheet drawn out of the binder: its first key (Download) takes the keyboard.
  const sheetKeys = useRef<HTMLSpanElement>(null)
  // A ticket's Download key opens its ways out in place of the sheet's keys: on paper, as a picture, the whole
  // week as a strip, as a lock screen. Kept as the ticket it was opened for (a filed one, or the printer's),
  // so another sheet drawn out comes with its own keys.
  const outputsKey = filedId ?? (view === "today" ? "today" : null)
  const [outputsFor, setOutputsFor] = useState<string | null>(null)
  const outputs = outputsFor !== null && outputsFor === outputsKey
  const setOutputs = (open: boolean) => setOutputsFor(open ? outputsKey : null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (filedId) sheetKeys.current?.querySelector("button")?.focus({ preventScroll: true })
  }, [filedId])
  // The row of keys changed under the focus: the keyboard follows to its first key.
  const outputsShown = useRef(false)
  useEffect(() => {
    if (outputsShown.current !== outputs) sheetKeys.current?.querySelector("button")?.focus({ preventScroll: true })
    outputsShown.current = outputs
  }, [outputs])
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
  /**
   * A ticket as a picture: the one drawn out of the binder, or the one in the printer. For a thermal
   * printer's app, as a phone's lock screen, or (from the printer) the whole week on one strip.
   */
  const saveTicket = async (as: "image" | "wallpaper" | "week") => {
    if (saving) return
    let day: Date
    let days: ReturnType<typeof ticketContent>[]
    if (filed) {
      day = ticketDay(filed)
      days = [ticketContent({ ...rm.state.settings, wakeTime: filed.wakeTime, sleepTime: filed.sleepTime }, filed.blocks, day)]
    } else if (ticketSheet && paperWeek && ticketDate) {
      day = ticketDate
      // The week's strip: each day as its ticket was printed, or as the week was last printed if it wasn't.
      const dates = as === "week" ? WEEK.map((d) => dateInWeek(paperWeek, d)) : [ticketDate]
      days = dates.map((date) => {
        const { settings, schedule } = onPaper(ticketOf(date) ?? printed)
        return ticketContent(settings, schedule.blocks, date)
      })
    } else return
    setSaving(true)
    try {
      const blob = await (as === "week" ? ticketStrip(days, words, rm.display.clock) : (as === "image" ? ticketImage : ticketWallpaper)(days[0], words, rm.display.clock))
      await saveImage(blob, as === "week" ? `robot-mode-${paperWeek}.png` : `robot-mode-${dayKey(day)}${as === "wallpaper" ? "-wallpaper" : ""}.png`)
    } catch {
      setNotice({ text: "Couldn't draw the ticket", error: true })
    } finally {
      setSaving(false)
    }
  }

  // Tearing a sheet off: it flies into the binder with a rip, and that printer alone is left
  // empty until the next PRINT (the empty slot's key, or typed). Switching views or
  // reloading leaves it empty; the other printers keep their sheets.
  const [tearing, setTearing] = useState(false)
  // Kept with the week, so a reload doesn't print again what was torn off.

  // The sheet on show, if the view is one of the printers: null once torn off, missing if never printed there.
  const sheetOnShow = view === "print" ? sheets.list : view === "week" ? sheets.grid : view === "today" ? ticketSheet : undefined
  const onPrinter = view === "print" || view === "week" || view === "today"

  /**
   * PRINT, on one printer: the one on show (the list, the grid, or the day's ticket); from the
   * screen, the grid (a phone's list). The other printers keep what they hold. The first time,
   * from the screen, the machine turns to that paper to show it coming out.
   */
  const print = () => {
    const first = printed === null
    const printer = view === "print" ? "list" : view === "week" ? "grid" : view === "today" && ticketDate ? ticketDate : paperView === "print" ? "list" : "grid"
    rm.printWeek(printer)
    setFeed(true)
    if (first && !onPrinter) {
      setTodayTip(true)
      setScreen(null)
      setView(printer === "list" ? "print" : "week")
    }
  }

  const tear = (): string | void => {
    if (tearing) return
    // On the ticket printer, the ticket is what comes off, unless the week is over: then it's the week's turn.
    if (view === "today" && !weekDue) return tearTicket()
    // From the screen, the paper it tears is the one the machine prints on: the grid, or a phone's list.
    const format = view === "print" || (view !== "week" && phone) ? "list" : "grid"
    // Nothing on that printer: a week that is over still starts the next one; otherwise there is nothing to file.
    if (!sheets[format]) {
      if (!weekDue) return "NOTHING ON PAPER TO TEAR OFF · PRINT FIRST"
      rm.tearWeek(format, true)
      return
    }
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

  // The day's ticket on show, torn off and filed under Tickets. Only the ticket printer empties, for that day.
  const tearTicket = (): string | void => {
    if (tearing || !ticketDate) return
    if (!ticketSheet) return "NOTHING ON PAPER TO TEAR OFF · PRINT FIRST"
    const date = ticketDate
    setTearing(true)
    setScreen(null)
    rip()
    setReceiving(true)
    window.setTimeout(() => {
      rm.tearTicket(date)
      setTearing(false)
    }, 600)
    window.setTimeout(() => setReceiving(false), 1700)
  }

  /** A ticket's ways out, in place of its keys; the printer's also prints the whole week as one strip. */
  const ticketOutputs = (week: boolean) => (
    <>
      <Button onClick={() => window.print()} title="Send the ticket to your printer, or save it as a PDF">
        Print
      </Button>
      <Button onClick={() => saveTicket("image")} disabled={saving} title="Save the ticket as a picture, ready for a thermal printer's app">
        Image
      </Button>
      {week && (
        <Button onClick={() => saveTicket("week")} disabled={saving} title="The whole week's tickets on one strip, to print once and cut into seven">
          Week
        </Button>
      )}
      <Button onClick={() => saveTicket("wallpaper")} disabled={saving} title="Save the ticket as a phone lock screen, below the clock">
        Wallpaper
      </Button>
      <Button onClick={() => setOutputs(false)} title="Back (Esc)">
        ◀ Back
      </Button>
    </>
  )

  useMachineSound(rm.display.sound)

  // Esc closes a ticket's Download keys, then puts a drawn-out sheet back, unless it is meant for the prompt or a field.
  useEffect(() => {
    if (!filedId && !outputs) return
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || binderPinned) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT") && (t as HTMLInputElement).value) return
      // The Download keys first, back to the sheet's own; then the sheet, back in the binder.
      if (outputs) return setOutputsFor(null)
      if (!filedId) return
      rustle()
      setFiledId(null)
    }
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [filedId, binderPinned, outputs])


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

  // The calendar file is the week on the screen, as it stands: the most recent version, printed or not.
  const exportIcs = (): string | void => {
    downloadIcs(rm.schedule.blocks, { sequence: rm.bumpExport() })
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

  // A setup opened from a link, or a template the landing page named (?template=…), until it is taken or turned down.
  const [linked, setLinked] = useState<Linked | null>(() => {
    if (typeof window === "undefined") return null
    const settings = setupFromHash(window.location.hash)
    if (settings) return { settings }
    const template = templateFromAddress()
    return template ? { settings: { ...template.settings }, template } : null
  })
  // The link has done its job: a reload shouldn't offer it again. A link pasted into a tab
  // already showing the machine only changes the hash, so that is listened for too.
  useEffect(() => {
    const clear = () => window.history.replaceState(null, "", window.location.pathname + window.location.search)
    if (setupFromHash(window.location.hash)) clear()
    if (templateFromAddress()) dropTemplateFlag()
    const onHash = () => {
      const settings = setupFromHash(window.location.hash)
      if (!settings) return
      clear()
      setLinked({ settings })
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])
  const openSetup = ({ settings, template }: Linked) => {
    setLinked(null)
    rm.loadSetup(settings, template?.id)
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
            {/* The nameplate leads out to the front page; ?home shows it even with a week on the machine. */}
            <Link
              href="/?home"
              title="Robot Mode: the front page"
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
            </Link>

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
              {linked.template ? `The ${linked.template.name} template holds` : "This link holds a setup of"} {linked.settings.activities.length}{" "}
              {linked.settings.activities.length === 1 ? "activity" : "activities"}. Replace yours with it?
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
                      ? `ticket · ${ticketDay(filed).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}`
                      : `week ${filed.week} / ${filed.year}`}
                  </span>
                  {/* The sheet's keys take the keyboard as it comes out: ← → between them, Enter presses, Esc puts it back. */}
                  <span
                    ref={sheetKeys}
                    className="flex gap-2"
                    onKeyDown={(e) => {
                      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
                      e.preventDefault()
                      const keys = [...e.currentTarget.querySelectorAll("button")]
                      const at = keys.indexOf(document.activeElement as HTMLButtonElement)
                      keys[Math.min(Math.max(at + (e.key === "ArrowRight" ? 1 : -1), 0), keys.length - 1)]?.focus()
                    }}
                  >
                    {outputs ? (
                      ticketOutputs(false)
                    ) : (
                      <>
                    <Button
                      onClick={() => (filed.format === "ticket" ? setOutputs(true) : window.print())}
                      title={filed.format === "ticket" ? "Print it, or save it as a picture or a wallpaper" : "Download this sheet as a PDF, or send it to your printer"}
                    >
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
                      </>
                    )}
                  </span>
                </div>
                {/* As it was torn off: the printed list, the plotted grid, or the day's ticket. */}
                {filed.format === "ticket" ? (
                  <Ticket
                    settings={{ ...rm.state.settings, wakeTime: filed.wakeTime, sleepTime: filed.sleepTime }}
                    schedule={{ ...rm.schedule, blocks: filed.blocks, unplaced: [] }}
                    now={ticketDay(filed)}
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
                {...onPaper(sheets.list)}
                feed={feed}
                onFed={() => setFeed(false)}
                onTear={tear}
                tearing={tearing}
                empty={!sheets.list}
                never={sheets.list === undefined}
                onFormFeed={print}
              />
            ) : view === "week" && generated ? (
              <WeekGrid
                {...onPaper(sheets.grid)}
                feed={feed}
                onFed={() => setFeed(false)}
                onTear={tear}
                tearing={tearing}
                empty={!sheets.grid}
                never={sheets.grid === undefined}
                onFormFeed={print}
              />
            ) : view === "today" && generated ? (
              ticketDate && (
                <>
                  {/* The ticket printer's keys: which day of the week it prints, and its ways out. */}
                  <div className="mx-auto mt-4 flex max-w-[560px] flex-wrap items-center justify-between gap-2 px-4 no-print">
                    <span role="group" aria-label="Which day's ticket" className="flex gap-1">
                      {WEEK.map((d) => (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={d === shownDay}
                          onClick={() => pickDay(d)}
                          title={`Print ${DAY_KEYS[d]}'s ticket (or type TODAY ${DAY_KEYS[d].toUpperCase()})`}
                          className={`key px-2 py-1 ${d === shownDay ? "key-dark" : ""}`}
                        >
                          <span className="sm:hidden">{DAY_KEYS[d][0]}</span>
                          <span className="max-sm:hidden">{DAY_KEYS[d]}</span>
                        </button>
                      ))}
                    </span>
                    {ticketSheet && (
                      <span ref={sheetKeys} className="flex flex-wrap gap-2">
                        {outputs ? (
                          ticketOutputs(true)
                        ) : (
                          <Button onClick={() => setOutputs(true)} title="Print it, save it as a picture or a wallpaper, or the whole week as a strip">
                            Download ↓
                          </Button>
                        )}
                      </span>
                    )}
                  </div>
                  <Ticket
                    {...onPaper(ticketSheet)}
                    now={ticketDate}
                    keysAbove
                    feed={feed}
                    onFed={() => setFeed(false)}
                    onTear={tearTicket}
                    tearing={tearing}
                    empty={!ticketSheet}
                    never={ticketSheet === undefined}
                    onFormFeed={print}
                  />
                </>
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

        {/* The keyboard is part of the machine from the start; it lights up once the week exists. */}
        {rm.hydrated && (
          <Terminal
            off={
              showWeekChrome
                ? null
                : view === "generating"
                  ? "Calculating"
                  : view === "setup"
                    ? "Answer on the screen"
                    : "Press Enter to start"
            }
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
              onPrinter && sheetOnShow === null
                ? "SHEET FILED · TYPE PRINT FOR A FRESH ONE"
                : onPrinter && sheetOnShow === undefined
                ? "NOTHING ON THIS PRINTER YET · TYPE PRINT TO PRINT THE DRAFT ON THE SCREEN"
                : !printed
                ? firstTry(rm.state.settings.activities, rm.schedule.blocks)
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

/** A setup to offer: from a link, or one of the ready-made weeks. */
type Linked = { settings: Settings; template?: Template }

/** The ready-made week the landing page asked for (?template=student), if it names one. */
function templateFromAddress(): Template | undefined {
  if (typeof window === "undefined") return undefined
  const template = templateById(new URLSearchParams(window.location.search).get("template") ?? undefined)
  return template && template.settings.activities.length > 0 ? template : undefined
}

/** Like the start flag, the template leaves the address once read. */
function dropTemplateFlag() {
  const params = new URLSearchParams(window.location.search)
  params.delete("template")
  const query = params.toString()
  window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : "") + window.location.hash)
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

/**
 * The first thing to try, before anything is printed: a real line about the
 * week on the screen (its first activity's session, moved a day on), so the
 * keyboard's whole idea is shown with the visitor's own week.
 */
function firstTry(activities: Settings["activities"], blocks: { activityId: string; day: number }[]): string {
  const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
  const main = activities.find((a) => !a.extraOf && blocks.some((b) => b.activityId === a.id))
  const block = main && blocks.find((b) => b.activityId === main.id)
  if (!main || !block) return "TYPE ADD TO WRITE WHAT YOU WANT TO DO · HELP LISTS EVERYTHING"
  const name = main.name.toUpperCase()
  return `TRY: MOVE ${name} ${DAYS[block.day]} TO ${DAYS[(block.day + 1) % 7]} · LOCK ${name} · HELP · THEN PRINT`
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
