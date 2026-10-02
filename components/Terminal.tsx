"use client"

import { useWords } from "@/lib/words"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import type { RobotMode } from "@/lib/useRobotMode"
import { formatClock, localizeTimes } from "@/lib/locale"
import { parseTime } from "@/lib/scheduler/time"
import { formatHours } from "@/lib/duration"
import { suggestFixes } from "@/lib/suggest"
import { FUNCTIONS, commandFor, complete, interpret, nextHint, type CommandAction, type Screen } from "@/lib/command"
import { beep, buzz } from "@/lib/sound"
import { Command, Console, SCREEN_HEIGHT, reject, useTerminal, type LegendKey } from "./Machine"
import { ActivitiesTerminal, HoursTerminal, MealsTerminal } from "./Terminals"
import { useDisplay } from "./Display"

type View = "screen" | "printout" | "grid" | "today" | "binder"

/** The function's screen open on the machine's screen, if any. */
export type TerminalScreen = { name: Screen; id?: string } | null

/** Where Esc goes from each screen. */
const BACK: Partial<Record<Screen, Screen>> = {
  activities: "edit",
  hours: "edit",
  meals: "edit",
  reset: "system",
}

const PATHS: Record<Screen, string> = {
  add: "Add",
  edit: "Edit",
  activities: "Edit › Activities",
  hours: "Edit › Hours",
  meals: "Edit › Meals",
  system: "System",
  fix: "Fix",
  restart: "System › Restart",
  reset: "System › Reset",
  help: "Help",
}

const LEGENDS: Record<Screen, LegendKey[]> = {
  add: [
    ["Enter", "Next field", true],
    ["← →", "Field"],
    ["Esc", "Close"],
  ],
  activities: [
    ["Enter", "Open", true],
    ["Del", "Remove"],
    ["Esc", "Back"],
  ],
  hours: [
    ["↑ ↓", "Adjust", true],
    ["Enter", "Next field"],
    ["Esc", "Back"],
  ],
  meals: [
    ["Space", "Pick meal", true],
    ["↑ ↓", "Adjust"],
    ["Esc", "Back"],
  ],
  edit: [
    ["1–3", "Choose", true],
    ["↑ ↓", "Move"],
    ["Esc", "Close"],
  ],
  system: [
    ["1–6", "Choose", true],
    ["↑ ↓", "Move"],
    ["Esc", "Close"],
  ],
  fix: [
    ["1–9", "Apply a fix", true],
    ["↑ ↓", "Move"],
    ["Esc", "Close"],
  ],
  restart: [
    ["Y", "Erase", true],
    ["N", "Keep"],
    ["Esc", "Back"],
  ],
  reset: [
    ["Y", "Reset", true],
    ["N", "Keep"],
    ["Esc", "Back"],
  ],
  help: [
    ["Enter", "Run function", true],
    ["↑ ↓", "Move"],
    ["Esc", "Close"],
  ],
}

/**
 * The machine's keyboard unit, under the screen or the printers: what the
 * week is built from, the function keys, and a one-line readout to type on.
 * A function (ADD, EDIT, SYSTEM…) opens its screen on the machine's one
 * screen (`slot`), in place of the week, driven by the same keys; Esc closes it.
 *
 * The prompt takes commands in shorthand or plain words; it completes as you
 * type, and Enter takes the completion, so "e" then Enter opens EDIT.
 */
export function Terminal({
  rm,
  screen,
  onScreen,
  onExport,
  onBackup,
  onPrint,
  onLoad,
  onRestart,
  onView,
  onTear,
  onShred,
  unprinted = false,
  tip,
  slot,
}: {
  rm: RobotMode
  screen: TerminalScreen
  onScreen: (screen: TerminalScreen) => void
  /** The week on paper as .ics; a reason when it can't be. */
  onExport: () => string | void
  /** BACKUP: everything, as a file. */
  onBackup: () => void
  /** PRINT: the draft on the screen onto paper. */
  onPrint: () => void
  onLoad: () => void
  onRestart: () => void
  /** Switch what is shown above (typed: screen, list, grid, today, binder). */
  onView: (view: View) => void
  /** Tear the sheet on paper off into the binder; a reason when there is none. */
  onTear: () => string | void
  /** Shred a filed week by its number; false when the binder has no such week. */
  onShred: (week: number) => boolean
  /** The screen has changes the paper doesn't: PRINT is lit. */
  unprinted?: boolean
  /** A hint, shown under the prompt when there is nothing else to say. */
  tip?: string | null
  /** Where on the machine's screen a function's screen opens, in place of the week. */
  slot: HTMLElement | null
}) {
  const { clock } = useDisplay()
  const settings = rm.state.settings
  const activities = settings.activities
  const schedule = rm.schedule
  const prompt = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const [text, setText] = useState("")
  const [reply, setReply] = useState<{ text: string; error: boolean } | null>(null)
  // The activity loaded onto the line with ↑ ↓, by id so it survives the list changing.
  const [pickedId, setPickedId] = useState<string | null>(null)
  // A question waiting on which session a line meant: the options, by number.
  const [choice, setChoice] = useState<{ label: string; action: CommandAction }[] | null>(null)

  const current = screen
  const conflicts = schedule.unplaced.length
  const weekEdits = rm.state.locked.length + rm.state.skipped.length

  // What the line would do, worked out as it is typed. Enter takes the completion when the line alone means nothing.
  const completion = complete(text, activities)
  // What the parser reads a line against, including the placed sessions EDIT picks from.
  const ctx = {
    ...settings,
    activities,
    sound: rm.display.sound ?? true,
    sessions: schedule.blocks.map((b) => ({ id: b.id, activityId: b.activityId, day: b.day, start: b.startMinute, end: b.endMinute, locked: b.locked })),
  }
  const typed = text.trim() ? interpret(text, ctx) : null
  const completed = completion ? interpret(completion, ctx) : null
  const action = (!typed || typed.kind === "error") && completed && completed.kind !== "error" ? completed : typed
  const hint = text.trim() && !completion ? nextHint(text, activities) : null
  // The function Enter will run, lit in the function row.
  const lit = action && action.kind !== "error" ? functionOf(action) : null

  /** `keepReply` when an action closes the screen and has just said what it did. */
  const close = (keepReply = false) => {
    onScreen(null)
    if (!keepReply) setReply(null)
    if (!touchOnly()) prompt.current?.focus()
  }
  const back = () => {
    const to = current ? BACK[current.name] : undefined
    if (to) onScreen({ name: to })
    else close()
  }

  // The screen's own keys: Esc steps back; the selection starts on the right item.
  useTerminal(root, { onEscape: back, focusKey: current ? `${current.name}-${current.id ?? ""}` : null })
  useEffect(() => {
    if (current?.name === "activities" && current.id) {
      root.current?.querySelector<HTMLElement>(`[data-activity="${current.id}"]`)?.focus()
    } else if (current?.name === "activities") {
      root.current?.querySelector<HTMLElement>("[data-activity]")?.focus()
    }
  }, [current?.name, current?.id])

  // The keyboard starts on the prompt; "/" brings it back from anywhere. A phone
  // starts without it, or its on-screen keyboard would cover the week on arrival.
  useEffect(() => {
    if (!touchOnly()) prompt.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return
      e.preventDefault()
      prompt.current?.focus()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const load = (line: string, id: string | null = null) => {
    setText(line)
    setPickedId(id)
    prompt.current?.focus()
  }

  const say = (text: string, error = false) => setReply({ text, error })

  /** Run a function from the row or a menu, as if its word had been typed. */
  const runWord = (word: string) => {
    const a = interpret(word, ctx)
    if (a && a.kind !== "error") perform(a)
  }

  const perform = (a: Exclude<NonNullable<typeof action>, { kind: "error" }>) => {
    switch (a.kind) {
      case "add":
        rm.addActivity(a.activity)
        break
      case "update":
        rm.updateActivity(a.id, a.patch)
        break
      case "remove":
        rm.removeActivity(a.id)
        break
      case "open":
        onScreen({ name: a.screen, ...(a.id ? { id: a.id } : {}) })
        break
      case "settings":
        rm.patchSettings(a.patch)
        break
      case "display":
        rm.setDisplay(a.patch)
        break
      case "shuffle":
        rm.shuffle()
        break
      case "export":
      case "tear": {
        // These take what is on paper: with nothing there, the machine says so.
        const refused = { export: onExport, tear: onTear }[a.kind]()
        if (refused) {
          buzz()
          return say(refused, true)
        }
        break
      }
      case "print":
        onPrint()
        break
      case "clear":
        rm.freshWeek()
        break
      case "backup":
        onBackup()
        break
      case "load":
        onLoad()
        break
      case "view":
        onView(a.view)
        break
      case "shred":
        if (!onShred(a.week)) {
          buzz()
          return say(`NO WEEK ${a.week} IN THE BINDER`, true)
        }
        break
      case "split":
        rm.updateActivity(a.id, a.patch)
        rm.addActivity(a.extra)
        break
      case "skip":
        // Out of this week only: the activity is untouched.
        a.blockIds.forEach(rm.removeBlock)
        break
      case "lock":
        // Only the ones not already as asked: locking twice would unlock.
        a.blockIds.filter((id) => schedule.blocks.find((b) => b.id === id)?.locked !== a.locked).forEach(rm.toggleLock)
        break
      case "move": {
        // Locked there; refused if another locked session is in the way.
        const refused = rm.moveBlock(a.blockId, a.day, a.start)
        if (refused) {
          buzz()
          return say(refused.toUpperCase(), true)
        }
        break
      }
      case "choose":
        // Not done yet: the line meant several sessions, so the terminal asks which.
        setChoice(a.options)
        break
    }
    say(a.reply)
  }

  /** Pick one of the sessions a line could have meant. */
  const pickOption = (i: number) => {
    const option = choice?.[i]
    if (!option) return
    setChoice(null)
    if (option.action.kind !== "choose") perform(option.action)
    beep(1320, 0.04)
    load("")
  }

  const picking = choice && /^[1-9]$/.test(text.trim()) ? Number(text.trim()) - 1 : null

  const run = () => {
    if (picking !== null) return pickOption(picking)
    if (!action) return
    if (action.kind === "error") {
      say(action.reply, true)
      if (prompt.current) reject(prompt.current)
      return
    }
    perform(action)
    beep(1320, 0.04)
    load("")
  }

  // Under the prompt: the answer to the last command, or else what this one will do.
  const status =
    (picking !== null && choice?.[picking]
      ? { text: `→ ${choice[picking].action.preview}   [ENTER]`, error: false }
      : null) ??
    (choice && !text
      ? null
      : reply) ??
    (action && action.kind !== "error"
      ? { text: `→ ${action.preview}   [ENTER]${action.note ? `   · ${action.note}` : ""}`, error: false }
      : hint
        ? { text: `… ${hint}`, error: false }
        : tip && !text
          ? { text: tip, error: false }
          : null)

  // Extra sessions count with the activity they belong to.
  const mains = activities.filter((a) => !a.extraOf)

  // Editing the week lives here; the views and EXPORT are the panel's (and can still be typed).
  const functionRow: { word: string; label: string; show: boolean; alert?: boolean }[] = [
    { word: "add", label: "Add", show: true },
    { word: "edit", label: "Edit", show: true },
    { word: "shuffle", label: "Shuffle", show: true },
    // Taking the week out of the machine: PRINT puts the screen on paper (lit while they differ),
    // EXPORT sends it to a calendar. Tearing off is done on the paper itself (or typed: TEAR).
    { word: "print", label: "Print", show: true, alert: unprinted },
    { word: "export", label: "Export .ics", show: true },
    { word: "system", label: "System", show: true },
    { word: "help", label: "Help", show: true },
    { word: "clear", label: `Clear edits (${weekEdits})`, show: weekEdits > 0 },
    { word: "fix", label: conflicts === 1 ? "Fix 1 conflict" : `Fix ${conflicts} conflicts`, show: conflicts > 0, alert: true },
  ]

  return (
    <>
      {/* A function's screen opens on the machine's one screen, in place of the week, at its full size. */}
      {current &&
        slot &&
        createPortal(
          <Console
            captions={[`> ${PATHS[current.name]}`, <button key="esc" type="button" onClick={() => back()} className="hover:text-ink">[Esc] {BACK[current.name] ? "Back" : "Close"}</button>]}
            legend={LEGENDS[current.name]}
          >
            <div ref={root} className={`${SCREEN_HEIGHT} sm:overflow-y-auto`}>
              <ScreenBody
                screen={current}
                rm={rm}
                onScreen={onScreen}
                onClose={() => close(true)}
                onRunWord={runWord}
                onSay={say}
                onRestart={onRestart}
              />
            </div>
          </Console>,
          slot,
        )}

      {/* The keyboard unit: part of the machine's casing, not a second screen. Its keys, and a one-line readout. */}
      <div className="no-print shrink-0 border-t-2 border-ink bg-[#cdc5b1] px-3 pb-3 pt-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)] sm:px-6">
        {/* What the week is built from, printed on the casing. Click anything to change it. */}
        <div className="label hidden flex-wrap items-baseline gap-x-5 gap-y-1 text-ink/70 sm:flex [&_button]:uppercase">
          <button type="button" onClick={() => onScreen({ name: "hours" })} className="hover:text-ink" title="Edit your hours">
            <span className="opacity-60">Wake </span>
            {formatClock(parseTime(settings.wakeTime), clock)}
            <span className="opacity-60"> · Sleep </span>
            {formatClock(parseTime(settings.sleepTime), clock)}
          </button>
          <span aria-hidden className="text-ink/30">│</span>
          <button type="button" onClick={() => onScreen({ name: "activities" })} className="hover:text-ink" title="Edit your activities">
            {mains.length} <span className="opacity-60">{mains.length === 1 ? "activity" : "activities"}</span>
          </button>
          <span className="ml-auto tabular-nums" title="Hours your activities ask for, out of the hours the week has for them">
            <span className="opacity-60">Planned </span>
            {formatHours(rm.budget.requestedMinutes)}
            <span className="opacity-60"> of </span>
            {formatHours(rm.budget.allocatableMinutesPerWeek)}
            <span className="opacity-60"> available</span>
            {!rm.budget.feasible && <span className="text-alert"> · over by {formatHours(rm.budget.overByMinutes)}</span>}
          </span>
        </div>

        {/* The function keys. The one Enter would run, or whose screen is open, is held down; a key that wants attention has its lamp lit. */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {functionRow
            .filter((f) => f.show)
            .map((f) => (
              <button
                key={f.word}
                type="button"
                onClick={() => runWord(f.word)}
                aria-pressed={lit === f.word || (current ? functionOf({ kind: "open", screen: current.name }) === f.word : false)}
                className="key flex items-center gap-2 px-2.5 py-1.5"
              >
                {f.alert && <span aria-hidden className="inline-block h-1.5 w-1.5 bg-alert" style={{ boxShadow: "0 0 4px var(--color-alert)" }} />}
                {f.label}
              </button>
            ))}
        </div>

        {/* The readout: one line to type on, one for the answer. */}
        <div className="crt mt-2 px-3 py-1 sm:px-4" style={{ borderWidth: 4 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            run()
          }}
          className="flex items-baseline gap-3 font-crt text-[22px]"
        >
          <span className="text-ink/60">&gt;</span>
          <div className="relative min-w-0 flex-1">
            {/* The rest of the word being typed, dimmed behind the cursor: Enter, Tab or → takes it. */}
            {completion && (
              <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre uppercase">
                <span className="invisible">{text}</span>
                <span className="text-ink/35">{completion.slice(text.length)}</span>
              </div>
            )}
            <input
              ref={prompt}
              value={text}
              spellCheck={false}
              autoComplete="off"
              aria-label="Command"
              placeholder="Type a function"
              onChange={(e) => {
                setText(e.target.value)
                setPickedId(null)
                setReply(null)
              }}
              onKeyDown={(e) => {
                const atEnd = e.currentTarget.selectionStart === text.length
                if (completion && (e.key === "Tab" || (e.key === "ArrowRight" && atEnd))) {
                  e.preventDefault()
                  setText(completion)
                } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                  // Step through the activities, one on the line at a time, ready to change.
                  if (activities.length === 0) return
                  e.preventDefault()
                  const at = activities.findIndex((a) => a.id === pickedId)
                  const next =
                    e.key === "ArrowDown"
                      ? at + 1 >= activities.length ? -1 : at + 1
                      : at <= -1 ? activities.length - 1 : at - 1
                  const activity = activities[next]
                  setReply(null)
                  if (activity) load(commandFor(activity), activity.id)
                  else load("")
                } else if (e.key === "Escape") {
                  e.preventDefault()
                  if (choice) {
                    setChoice(null)
                    setReply(null)
                    load("")
                  } else if (text || reply) {
                    setReply(null)
                    load("")
                  } else if (current) back()
                }
              }}
              className="relative w-full bg-transparent outline-none"
            />
          </div>
          <span className="hidden shrink-0 text-[18px] text-ink/45 sm:block">
            {completion ? "[Enter] run · [Tab] complete" : "[↑↓] activities"}
          </span>
        </form>
        <div
          aria-live="polite"
          className={`min-h-[1.4em] font-crt text-[17px] leading-tight ${status?.error ? "text-alert [text-shadow:none]" : "text-ink/55"}`}
        >
          {choice && !text ? (
            // Which session the line meant: typed (1, 2… then Enter) or clicked.
            <span className="text-ink">
              WHICH SESSION?{" "}
              {choice.map((o, i) => (
                <button key={o.label} type="button" onClick={() => pickOption(i)} className="px-1 hover:bg-ink/15">
                  [{i + 1}] {localizeTimes(o.label, clock)}
                </button>
              ))}
              <span className="text-ink/45"> · [ESC] CANCEL</span>
            </span>
          ) : (
            status && localizeTimes(status.text, clock)
          )}
        </div>
        </div>
      </div>
    </>
  )
}

/** A touchscreen with no mouse: focusing a field there pops up the on-screen keyboard. */
function touchOnly(): boolean {
  return window.matchMedia("(pointer: coarse)").matches
}

/** Which function-row key a command amounts to, so the row can light it. */
function functionOf(action: { kind: string; screen?: string; view?: string }): string | null {
  if (action.kind === "open") {
    const screen = action.screen as Screen
    if (["activities", "hours", "meals"].includes(screen)) return "edit"
    if (screen === "restart" || screen === "reset") return "system"
    return screen
  }
  if (action.kind === "view") return action.view ?? null
  return FUNCTIONS.includes(action.kind) ? action.kind : null
}

function ScreenBody({
  screen,
  rm,
  onScreen,
  onClose,
  onRunWord,
  onSay,
  onRestart,
}: {
  screen: NonNullable<TerminalScreen>
  rm: RobotMode
  onScreen: (screen: TerminalScreen) => void
  onClose: () => void
  onRunWord: (word: string) => void
  onSay: (text: string, error?: boolean) => void
  onRestart: () => void
}) {
  const settings = rm.state.settings

  switch (screen.name) {
    case "add":
    case "activities":
      return (
        <ActivitiesTerminal
          settings={settings}
          schedule={rm.schedule}
          onAddActivity={(a) => {
            rm.addActivity(a)
            onSay(`ADDED ${a.name.toUpperCase()}`)
          }}
          onUpdateActivity={rm.updateActivity}
          onRemoveActivity={rm.removeActivity}
          onEmptyEnter={onClose}
          openId={screen.id}
        />
      )
    case "hours":
      return <HoursTerminal settings={settings} onPatchSettings={rm.patchSettings} />
    case "meals":
      return <MealsTerminal settings={settings} onPatchSettings={rm.patchSettings} />
    case "edit":
      return (
        <MenuScreen
          title="What do you want to edit?"
          items={[
            { key: "1", label: "Activities", note: `${settings.activities.length} on the list`, onSelect: () => onScreen({ name: "activities" }) },
            { key: "2", label: "Hours", note: `wake ${settings.wakeTime} · sleep ${settings.sleepTime}`, onSelect: () => onScreen({ name: "hours" }) },
            { key: "3", label: "Meals", onSelect: () => onScreen({ name: "meals" }) },
          ]}
        />
      )
    case "system":
      return <SystemScreen rm={rm} onRunWord={onRunWord} onScreen={onScreen} />
    case "restart":
      return (
        <MenuScreen
          title="Erase everything?"
          note="The week, your activities, hours and meals. Back them up first if you want to keep them."
          items={[
            { key: "Y", label: "Yes, erase and start over", onSelect: onRestart },
            { key: "N", label: "No, keep it", onSelect: () => onScreen({ name: "system" }) },
          ]}
        />
      )
    case "reset": {
      const template = rm.activeTemplate
      if (!template) return null
      return (
        <MenuScreen
          title={`Reset to ${template.name}?`}
          note={`Your changes go, and the ${template.name} activities, hours and meals come back.`}
          items={[
            {
              key: "Y",
              label: "Yes, reset",
              onSelect: () => {
                rm.resetToTemplate()
                onSay(`RESET TO ${template.name.toUpperCase()}`)
                onClose()
              },
            },
            { key: "N", label: "No, keep my changes", onSelect: () => onScreen({ name: "system" }) },
          ]}
        />
      )
    }
    case "fix":
      return <FixScreen rm={rm} onClose={onClose} onSay={onSay} />
    case "help":
      return <HelpScreen onRunWord={onRunWord} />
  }
}

type MenuItem = { key: string; label: ReactNode; note?: ReactNode; onSelect: () => void; disabled?: boolean }

/**
 * A terminal menu: a heading and numbered (or lettered) commands. The key in
 * brackets chooses directly; ↑ ↓ and Enter work too.
 */
function MenuScreen({ title, note, items }: { title: ReactNode; note?: ReactNode; items: MenuItem[] }) {
  const latest = useRef(items)
  useEffect(() => {
    latest.current = items
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      // Typing at the prompt, or into a field, is typing, not choosing.
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return
      const item = latest.current.find((i) => i.key.toLowerCase() === e.key.toLowerCase() && !i.disabled)
      if (!item) return
      e.preventDefault()
      item.onSelect()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <div className="font-crt uppercase">
      <h2 className="text-[56px] leading-none tracking-[0.04em]">{title}</h2>
      {note && <p className="mt-3 text-[26px] tracking-[0.08em] text-ink/60">{note}</p>}
      <div className="mt-8 flex flex-col items-start gap-3">
        {items.map((item) => (
          // A phone has no room for the note beside its command: it goes underneath.
          <div key={item.key} className="flex flex-col items-start sm:flex-row sm:items-baseline sm:gap-6">
            <Command keyName={item.key} onClick={item.onSelect} disabled={item.disabled}>
              {item.label}
            </Command>
            {item.note && <span className="px-2 text-[24px] text-ink/50 sm:px-0">{item.note}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function SystemScreen({
  rm,
  onRunWord,
  onScreen,
}: {
  rm: RobotMode
  onRunWord: (word: string) => void
  onScreen: (screen: TerminalScreen) => void
}) {
  const { clock, weekStart } = rm.display
  const template = rm.activeTemplate
  const items: MenuItem[] = [
    { key: "1", label: "Save a backup", note: "setup, week and binder, as a file", onSelect: () => onRunWord("backup") },
    { key: "2", label: "Load a backup", onSelect: () => onRunWord("load") },
    {
      key: "3",
      label: `Clock: ${clock === "24h" ? "24H" : "12H"}`,
      note: `→ switch to ${clock === "24h" ? "12H" : "24H"}`,
      onSelect: () => rm.setDisplay({ clock: clock === "24h" ? "12h" : "24h" }),
    },
    {
      key: "4",
      label: `Week starts: ${weekStart === "monday" ? "Monday" : "Sunday"}`,
      note: `→ switch to ${weekStart === "monday" ? "Sunday" : "Monday"}`,
      onSelect: () => rm.setDisplay({ weekStart: weekStart === "monday" ? "sunday" : "monday" }),
    },
  ]
  const sound = rm.display.sound
  items.push({
    key: "S",
    label: `Sound: ${sound ? "On" : "Off"}`,
    note: `→ switch ${sound ? "off" : "on"}`,
    onSelect: () => rm.setDisplay({ sound: !sound }),
  })
  if (template) {
    items.push({
      key: "5",
      label: `Reset to ${template.name}`,
      note: rm.templateEdited ? "undo your changes to the template" : "unchanged",
      disabled: !rm.templateEdited,
      onSelect: () => onScreen({ name: "reset" }),
    })
  }
  items.push({ key: "6", label: "Restart terminal", note: "erase everything", onSelect: () => onScreen({ name: "restart" }) })
  return <MenuScreen title="System" items={items} />
}

function FixScreen({
  rm,
  onClose,
  onSay,
}: {
  rm: RobotMode
  onClose: () => void
  onSay: (text: string, error?: boolean) => void
}) {
  const { clock } = useDisplay()
  const unplaced = rm.schedule.unplaced
  const settings = rm.state.settings
  // Each suggestion costs a trial solve to verify, so only worked out while this screen is open.
  const fixes = useMemo(
    () => unplaced.map((u) => ({ conflict: u, fixes: suggestFixes(settings, u, 5) })),
    [unplaced, settings],
  )

  if (unplaced.length === 0) {
    return <MenuScreen title="No conflicts" note="Everything fits this week." items={[{ key: "Enter", label: "Close", onSelect: onClose }]} />
  }

  let n = 0
  const items: MenuItem[] = []
  const sections = fixes.map(({ conflict, fixes: options }) => {
    const numbered = options.slice(0, 9 - n).map((fix) => {
      const key = String(++n)
      const item: MenuItem = {
        key,
        label: localizeTimes(fix.label, clock),
        onSelect: () => {
          rm.patchSettings(fix.settings)
          onSay(`APPLIED: ${localizeTimes(fix.label, clock).toUpperCase()}`)
        },
      }
      items.push(item)
      return item
    })
    return { conflict, numbered }
  })

  return (
    <FixKeys items={items}>
      <div className="font-crt uppercase">
        <h2 className="text-[56px] leading-none tracking-[0.04em]">
          {unplaced.length === 1 ? "1 conflict" : `${unplaced.length} conflicts`}
        </h2>
        {sections.map(({ conflict, numbered }) => (
          <div key={conflict.activityId} className="mt-8">
            <div className="text-[30px]">
              <span className="text-alert [text-shadow:none]">
                {conflict.name} {conflict.sessionsPlaced}/{conflict.sessionsRequested}
              </span>{" "}
              <span className="text-ink/60">— {localizeTimes(conflict.why, clock)}</span>
            </div>
            <div className="mt-3 flex flex-col items-start gap-2 pl-6">
              {numbered.length === 0 ? (
                <span className="text-[24px] text-ink/50">No single change fixes this one.</span>
              ) : (
                numbered.map((item) => (
                  <Command key={item.key} keyName={item.key} onClick={item.onSelect}>
                    {item.label}
                  </Command>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </FixKeys>
  )
}

/** The number keys of a screen laid out by hand (not a MenuScreen). */
function FixKeys({ items, children }: { items: MenuItem[]; children: ReactNode }) {
  const latest = useRef(items)
  useEffect(() => {
    latest.current = items
  })
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return
      const item = latest.current.find((i) => i.key === e.key)
      if (!item) return
      e.preventDefault()
      item.onSelect()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])
  return <>{children}</>
}

/** The functions as the manual lists them; each one runs from here. */
const MANUAL_FUNCTIONS: [word: string, what: string][] = [
  ["add", "Add an activity. ADD SURF starts from 1H 1×; or type the whole line."],
  ["edit", "Change activities, hours or meals. EDIT GYM · EDIT MEALS."],
  ["shuffle", "Same rules, a different arrangement of the week."],
  ["screen", "The draft: the week on the screen, where it is changed. Paper only changes on PRINT."],
  ["print", "Print the draft on the screen onto paper. Lit while the screen has changes the paper doesn't."],
  ["export", "Download the week on paper as .ics, for any calendar app."],
  ["today", "Today's ticket, from the paper: print it and keep it."],
  ["list", "The week on paper as the printed list, day after day."],
  ["grid", "The week on paper as a calendar grid."],
  ["backup", "Download your setup, week and binder as a file. LOAD opens one."],
  ["system", "Backup, load, 12H / 24H clock, week start, reset, restart."],
  ["fix", "Shown when a session doesn't fit: suggested fixes, one key each."],
  ["clear", "Shown after moving or locking blocks: undo those edits."],
  ["tear", "File the sheet on paper in the binder; only its printer empties. From the binder, DOWNLOAD keeps it as a PDF, or sends it to your printer. Once the week is over, it also clears the week's edits. Or pull the sheet down by its tab. PRINT fills it again."],
  ["shred", "Shred a filed week for good: SHRED 39. Or ✕ on its sheet in the binder, twice."],
  ["binder", "The filing unit at the right edge (or bring the pointer there): torn-off weeks. Pull a sheet out to read it, Esc to put it back."],
]

/** One section of the manual: a heading, then aligned lines. */
function ManualSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="border-b border-ink/30 pb-0.5 text-[22px] tracking-[0.2em] text-ink/60">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

const MANUAL_ROW = "flex flex-wrap items-baseline gap-x-6 px-1 text-[24px] leading-snug"
const MANUAL_CMD = "w-[22rem] shrink-0"

/**
 * A line of the manual: what to type, then what it does. Selectable like any
 * terminal line, so ↑ ↓ read down the whole page. Day letters keep their case.
 */
function ManualLine({ cmd, children }: { cmd: ReactNode; children: ReactNode }) {
  return (
    <div data-nav tabIndex={-1} className={MANUAL_ROW}>
      <span className={MANUAL_CMD}>{cmd}</span>
      <span className="min-w-0 flex-1 opacity-60">{children}</span>
    </div>
  )
}

/**
 * The manual page, as a terminal would print one: every function, the
 * shape of an activity line, and the keys. Functions are selectable and run.
 */
function HelpScreen({ onRunWord }: { onRunWord: (word: string) => void }) {
  const words = useWords()
  const days = <span className="normal-case">MTSaSu</span>
  return (
    <div className="font-crt uppercase">
      <div className="flex flex-wrap items-baseline gap-x-6">
        <h2 className="text-[48px] leading-none tracking-[0.04em]">Help</h2>
        <span className="text-[22px] tracking-[0.2em] text-ink/60">{words.help.title}</span>
      </div>
      <p className="mt-2 text-[22px] tracking-[0.08em] text-ink/60">
        Type a function and press Enter. The first letters are enough: the rest is completed for you.
      </p>

      <ManualSection title="Functions">
        {MANUAL_FUNCTIONS.map(([word, what]) => (
          <button key={word} type="button" data-nav onClick={() => onRunWord(word)} className={`${MANUAL_ROW} w-full text-left uppercase hover:bg-ink/15`}>
            <span className={MANUAL_CMD}>[{word}]</span>
            <span className="min-w-0 flex-1 opacity-60">{what}</span>
          </button>
        ))}
      </ManualSection>

      <ManualSection title="Activities">
        <ManualLine cmd="SURF 1H10 4×">Add it, or change it if it is already on your list.</ManualLine>
        <ManualLine cmd={<>SURF 1H10 4× {days} MORNING</>}>With days and a time of day.</ManualLine>
        <ManualLine cmd="SURF ALWAYS AT 06:00">Always at the same time.</ManualLine>
        <ManualLine cmd="GYM 3× · GYM 1H30">Change one thing; the rest stays.</ManualLine>
        <ManualLine cmd="ADD GYM · ADD GYM 2×">One or two more of the same sessions.</ManualLine>
        <ManualLine cmd="ADD DEEP WORK MONDAY 1H AT 10:00">An extra session of an activity you have; the regular ones stay.</ManualLine>
        <ManualLine cmd="REMOVE GYM">Take it off the list, with its extra sessions.</ManualLine>
        <ManualLine cmd="REMOVE GYM WEDNESDAY">Only Wednesday&rsquo;s session, this week only (or that day&rsquo;s extra session, if it has one). CLEAR EDITS brings it back.</ManualLine>
        <ManualLine cmd="EDIT DEEP WORK MONDAY 2H">Change only Monday’s session. A regular one becomes an extra, kept at its time.</ManualLine>
        <ManualLine cmd="MOVE GYM MONDAY 10H TO 11H">Move one session; every hour here is a time. Locked there, like [M] MOVE.</ManualLine>
        <ManualLine cmd="MOVE GYM MONDAY TO TUESDAY">Same time, another day. Or both: TO TUESDAY 11H.</ManualLine>
        <ManualLine cmd="EDIT DEEP WORK MONDAY 10:00 TO 3H AT 11:00">When a day has several: name it by its start. TO separates which from what changes.</ManualLine>
        <ManualLine cmd="Any order">The parts of a line can come in any order: 1H MONDAY GYM is GYM MONDAY 1H.</ManualLine>
      </ManualSection>

      <ManualSection title="What goes in a line">
        <ManualLine cmd="Length">1H · 45M · 1H30 · 90 MIN</ManualLine>
        <ManualLine cmd="Times a week">4× · 4X · 3 TIMES · TWICE · DAILY</ManualLine>
        <ManualLine cmd="Days">
          <span className="normal-case">M T W T F Sa Su</span>, in week order: {days} = Mon Tue Sat Sun ·{" "}
          <span className="normal-case">TT</span> = Tue Thu · MONDAY · MON · WEEKDAYS · WEEKENDS
        </ManualLine>
        <ManualLine cmd="Time of day">MORNING 06–12 · AFTERNOON 12–18 · EVENING 18–23</ManualLine>
        <ManualLine cmd="Start time">AT 10:00 · AT 10H00 · STARTING AT 10 · FROM 7AM · ALWAYS AT 07:00</ManualLine>
      </ManualSection>

      <ManualSection title="Your day">
        <ManualLine cmd="WAKE 7:00 · SLEEP 23:30">When the day starts and ends.</ManualLine>
        <ManualLine cmd="Free time">What your activities leave empty. To keep a break, add it: ADD BREAK 1H DAILY.</ManualLine>
        <ManualLine cmd="12H · 24H · MON · SUN">How times read, and which day starts the week.</ManualLine>
      </ManualSection>

      <ManualSection title="Sound">
        <ManualLine cmd="SOUND · MUTE">The machine’s clicks, printer and hum. Also SYSTEM [S] and ♪ on the panel.</ManualLine>
      </ManualSection>

      <ManualSection title="Sessions">
        <ManualLine cmd="The screen · the paper">They only show the week. Every change is typed here.</ManualLine>
        <ManualLine cmd="LOCK GYM MONDAY">Keep that session where it is, through shuffles and edits. LOCK GYM locks every one.</ManualLine>
        <ManualLine cmd="UNLOCK GYM MONDAY">Let shuffles move it again. CLEAR EDITS unlocks everything.</ManualLine>
      </ManualSection>

      <ManualSection title="Keys">
        <ManualLine cmd="Enter">Run the line, or the dimmed completion.</ManualLine>
        <ManualLine cmd="Tab · →">Take the completion without running it.</ManualLine>
        <ManualLine cmd="↑ ↓">On the prompt: step through your activities, ready to change.</ManualLine>
        <ManualLine cmd="/">Back to the prompt from anywhere.</ManualLine>
        <ManualLine cmd="Esc">Back one screen, or clear the line.</ManualLine>
      </ManualSection>
    </div>
  )
}
