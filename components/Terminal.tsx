"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { Day, PlacedBlock } from "@/lib/types"
import type { RobotMode } from "@/lib/useRobotMode"
import { formatClock, formatSpan, localizeTimes, weekOrder } from "@/lib/locale"
import { DAY_NAMES, parseTime } from "@/lib/scheduler/time"
import { formatHours } from "@/lib/duration"
import { suggestFixes } from "@/lib/suggest"
import { FUNCTIONS, commandFor, complete, interpret, nextHint, type Screen } from "@/lib/command"
import type { DayStatus } from "@/lib/today"
import { beep, chime } from "@/lib/sound"
import { Command, Legend, reject, useTerminal, type LegendKey } from "./Machine"
import { ClockReadout } from "./Readout"
import { ActivitiesTerminal, FreeTimeTerminal, HoursTerminal, MealsTerminal } from "./Terminals"
import { useDisplay } from "./Display"

type View = "printout" | "grid" | "today"

/** What the terminal shows above its prompt: nothing, a function's screen, or the picked block. */
export type TerminalScreen = { name: Screen | "block" | "move"; id?: string } | null

/** Where Esc goes from each screen. */
const BACK: Partial<Record<Screen | "block" | "move", Screen | "block">> = {
  activities: "edit",
  hours: "edit",
  meals: "edit",
  free: "edit",
  move: "block",
}

const PATHS: Record<Screen | "block" | "move", string> = {
  add: "Add",
  edit: "Edit",
  activities: "Edit › Activities",
  hours: "Edit › Hours",
  meals: "Edit › Meals",
  free: "Edit › Free time",
  system: "System",
  fix: "Fix",
  restart: "System › Restart",
  block: "Block",
  move: "Block › Move",
  help: "Help",
}

const LEGENDS: Record<Screen | "block" | "move", LegendKey[]> = {
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
  free: [
    ["← →", "Adjust", true],
    ["Esc", "Back"],
  ],
  edit: [
    ["1–4", "Choose", true],
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
  block: [
    ["M", "Move", true],
    ["L", "Lock"],
    ["Esc", "Close"],
  ],
  move: [
    ["↑ ↓", "Adjust", true],
    ["Enter", "Move"],
    ["Esc", "Back"],
  ],
  help: [
    ["Enter", "Run function", true],
    ["↑ ↓", "Move"],
    ["Esc", "Close"],
  ],
}

/**
 * The machine's one control surface, docked under the week. At rest it is
 * three lines: what the week is built from, the function row, and a prompt.
 * A function (ADD, EDIT, SYSTEM…) or a picked block grows it into one of the
 * setup's screens, driven by the same keys, and Esc folds it back.
 *
 * The prompt takes commands in shorthand or plain words; it completes as you
 * type, and Enter takes the completion, so "e" then Enter opens EDIT.
 */
export function Terminal({
  rm,
  screen,
  onScreen,
  selected,
  onDeselect,
  onExport,
  onSave,
  onLoad,
  onRestart,
  view,
  onView,
  tip,
  day,
}: {
  rm: RobotMode
  screen: TerminalScreen
  onScreen: (screen: TerminalScreen) => void
  /** The block picked on the printout or grid, shown on the BLOCK screen. */
  selected: PlacedBlock | null
  onDeselect: () => void
  onExport: () => void
  onSave: () => void
  onLoad: () => void
  onRestart: () => void
  /** Which way the week is shown above: the printed list, the calendar grid or today's ticket. */
  view: View
  onView: (view: View) => void
  /** A hint, shown under the prompt when there is nothing else to say. */
  tip?: string | null
  /** Where today stands (null until the clock is read), and the ended session waiting for an answer. */
  day: { status: DayStatus | null; pending: PlacedBlock | null }
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

  // A BLOCK screen with no block left to show has nothing to say.
  const current = (screen?.name === "block" || screen?.name === "move") && !selected ? null : screen
  const conflicts = schedule.unplaced.length
  const weekEdits = rm.state.locked.length + rm.state.skipped.length + (rm.notBefore ? 1 : 0)

  // What the line would do, worked out as it is typed. Enter takes the completion when the line alone means nothing.
  const completion = complete(text, activities)
  const typed = text.trim() ? interpret(text, { ...settings, activities, sound: rm.display.sound ?? true }) : null
  const completed = completion ? interpret(completion, { ...settings, activities, sound: rm.display.sound ?? true }) : null
  const action = (!typed || typed.kind === "error") && completed && completed.kind !== "error" ? completed : typed
  const hint = text.trim() && !completion ? nextHint(text, activities) : null
  // The function Enter will run, lit in the function row.
  const lit = action && action.kind !== "error" ? functionOf(action) : null

  /** `keepReply` when an action closes the screen and has just said what it did. */
  const close = (keepReply = false) => {
    if (current?.name === "block" || current?.name === "move") onDeselect()
    onScreen(null)
    if (!keepReply) setReply(null)
    prompt.current?.focus()
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

  // The keyboard starts on the prompt; "/" brings it back from anywhere.
  useEffect(() => {
    prompt.current?.focus()
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
    const a = interpret(word, { ...settings, activities, sound: rm.display.sound ?? true })
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
        onExport()
        break
      case "clear":
        rm.freshWeek()
        break
      case "save":
        onSave()
        break
      case "load":
        onLoad()
        break
      case "view":
        onView(a.view)
        break
    }
    say(a.reply)
  }

  /** Y / N to the session that has just ended. */
  const answer = (did: boolean) => {
    const block = day.pending
    if (!block) return
    const name = block.name.toUpperCase()
    if (did) {
      rm.markDone(block.id)
      chime()
      say(`${name} DONE ✓`)
    } else {
      rm.markMissed(block.id)
      beep(330, 0.16)
      say(`${name} MISSED · REST OF THE WEEK REPLANNED`)
    }
    load("")
  }
  const yesNo = day.pending ? (/^(y|yes|done|oui)$/i.test(text.trim()) ? true : /^(n|no|missed|non)$/i.test(text.trim()) ? false : null) : null

  const run = () => {
    if (yesNo !== null) return answer(yesNo)
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
  const pendingName = day.pending?.name.toUpperCase()
  const status =
    reply ??
    (yesNo !== null
      ? { text: `→ ${yesNo ? `MARK ${pendingName} DONE` : `${pendingName} MISSED · REPLAN THE REST OF THE WEEK`}   [ENTER]`, error: false }
      : null) ??
    (action && action.kind !== "error"
      ? { text: `→ ${action.preview}   [ENTER]${action.note ? `   · ${action.note}` : ""}`, error: false }
      : hint
        ? { text: `… ${hint}`, error: false }
        : tip && !text
          ? { text: tip, error: false }
          : null)
  // An ended session's question waits under an empty prompt, in place of any other hint.
  const asking = day.pending && !reply && !text

  // NOW / NEXT, as the function row's right-hand readout.
  const nowLine = day.status && describeStatus(day.status, (m) => formatClock(m, clock))

  const placed = (id: string) => schedule.blocks.filter((b) => b.activityId === id).length

  // The other ways to see the week, offered like any other function.
  const views: { word: View; label: string }[] = [
    { word: "today", label: "◫ Today" },
    { word: "grid", label: "▦ Grid view" },
    { word: "printout", label: "≡ Printout view" },
  ]
  const functionRow: { word: string; label: string; show: boolean; alert?: boolean; flag?: boolean }[] = [
    { word: "add", label: "Add", show: true },
    { word: "edit", label: "Edit", show: true },
    { word: "shuffle", label: "Shuffle", show: true },
    { word: "export", label: "Export", show: activities.length > 0 },
    ...views.filter((v) => v.word !== view).map((v) => ({ ...v, show: true, flag: !!tip && v.word === "today" })),
    { word: "system", label: "System", show: true },
    { word: "help", label: "Help", show: true },
    { word: "clear", label: `Clear edits (${weekEdits})`, show: weekEdits > 0 },
    { word: "fix", label: conflicts === 1 ? "Fix 1 conflict" : `Fix ${conflicts} conflicts`, show: conflicts > 0, alert: true },
  ]

  return (
    <div
      className={`crt no-print flex shrink-0 flex-col px-5 py-3 ${current ? "h-[min(68vh,760px)]" : ""}`}
      style={{ borderWidth: 6 }}
    >
      {current && (
        <>
          <div className="flex items-baseline justify-between border-b border-ink/30 pb-1 font-crt text-[20px] uppercase">
            <span className="tracking-[0.12em]">&gt; {PATHS[current.name]}</span>
            <button type="button" onClick={() => back()} className="text-ink/55 hover:text-ink">
              [Esc] {BACK[current.name] ? "Back" : "Close"}
            </button>
          </div>
          {/* The setup's screens, drawn a size smaller so they fit the dock. */}
          <div ref={root} className="min-h-0 flex-1 overflow-y-auto py-4">
            <div style={{ zoom: 0.72 }}>
              <ScreenBody
                screen={current}
                rm={rm}
                selected={selected}
                onScreen={onScreen}
                onClose={() => close(true)}
                onRunWord={runWord}
                onSay={say}
                onRestart={onRestart}
              />
            </div>
          </div>
          <div className="border-t border-ink/30 pb-1" style={{ zoom: 0.9 }}>
            <Legend keys={LEGENDS[current.name]} />
          </div>
        </>
      )}

      {/* At rest: what the week is built from. Click anything to change it. */}
      {!current && (
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 font-crt text-[20px] uppercase leading-tight [&_button]:uppercase">
          <button type="button" onClick={() => onScreen({ name: "hours" })} className="hover:bg-ink/15" title="Edit your hours">
            <span className="opacity-60">Wake </span>
            {formatClock(parseTime(settings.wakeTime), clock)}
            <span className="opacity-60"> Sleep </span>
            {formatClock(parseTime(settings.sleepTime), clock)}
          </button>
          <button type="button" onClick={() => onScreen({ name: "free" })} className="hover:bg-ink/15" title="Edit free time">
            <span className="opacity-60">Free </span>
            {formatSpan(settings.minFreeMinutesPerDay)}/day
          </button>
          <span aria-hidden className="text-ink/30">│</span>
          {activities.map((a) => {
            const short = placed(a.id) < a.sessionsPerWeek
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onScreen({ name: "activities", id: a.id })}
                className={a.id === pickedId ? "bg-ink text-paper [text-shadow:none]" : "hover:bg-ink/15"}
                title={short ? `Only ${placed(a.id)} of ${a.sessionsPerWeek} fit. Click to edit` : `Edit ${a.name}`}
              >
                {a.name} <span className="opacity-60">{formatSpan(a.durationMinutes)}×{a.sessionsPerWeek}</span>
                {short && <span className="ml-1 border border-current px-1">{placed(a.id)}/{a.sessionsPerWeek}</span>}
              </button>
            )
          })}
          <span className="ml-auto tabular-nums text-ink/60" title="Hours asked for / hours available this week">
            {formatHours(rm.budget.requestedMinutes)} / {formatHours(rm.budget.allocatableMinutesPerWeek)}
            {!rm.budget.feasible && <span className="text-alert [text-shadow:none]"> · over by {formatHours(rm.budget.overByMinutes)}</span>}
          </span>
        </div>
      )}

      {/* The function row. The one Enter would run is lit. */}
      <div className={`flex flex-wrap gap-x-4 gap-y-1 font-crt text-[20px] uppercase ${current ? "mt-2" : "mt-1.5"}`}>
        {functionRow
          .filter((f) => f.show)
          .map((f) => (
            <button
              key={f.word}
              type="button"
              onClick={() => runWord(f.word)}
              // A few pulses to catch the eye, then it holds still.
              style={f.flag ? { animationIterationCount: 6 } : undefined}
              className={`uppercase ${
                lit === f.word || (current && functionOf({ kind: "open", screen: current.name }) === f.word)
                  ? "bg-ink text-paper [text-shadow:none]"
                  : f.alert
                    ? "text-alert [text-shadow:none] hover:bg-alert/20"
                    : f.flag
                      ? "blink text-ink hover:bg-ink/15"
                      : "text-ink/75 hover:bg-ink/15"
              }`}
            >
              [{f.label}]
            </button>
          ))}
        {/* Where the day stands: what is on now, and what comes next. */}
        {nowLine && (
          <span className="ml-auto flex items-baseline gap-2 tabular-nums" aria-live="polite">
            <span className={`inline-block h-2 w-2 self-center ${day.status?.kind === "block" ? "bg-ink" : "border border-ink/50"}`} />
            <span>{nowLine.now}</span>
            {nowLine.next && <span className="text-ink/55">→ {nowLine.next}</span>}
          </span>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          run()
        }}
        className="mt-1 flex items-baseline gap-3 font-crt text-[24px]"
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
                if (text || reply) {
                  setReply(null)
                  load("")
                } else if (current) back()
              }
            }}
            className="relative w-full bg-transparent outline-none"
          />
        </div>
        <span className="hidden shrink-0 text-[18px] text-ink/45 sm:block">
          {completion ? "[Enter] run · [Tab] complete" : "[↑↓] activities · [/] type"}
        </span>
      </form>
      <div
        aria-live="polite"
        className={`min-h-[1.4em] font-crt text-[18px] ${status?.error ? "text-alert [text-shadow:none]" : "text-ink/55"}`}
      >
        {asking && day.pending ? (
          // The session that just ended: did it happen? Y / N, typed or clicked.
          <span className="text-ink">
            {day.pending.name.toUpperCase()} ENDED {formatClock(day.pending.endMinute, clock)} · DONE?{" "}
            <button type="button" onClick={() => answer(true)} className="px-1 hover:bg-ink/15">
              [Y] YES
            </button>{" "}
            <button type="button" onClick={() => answer(false)} className="px-1 hover:bg-ink/15">
              [N] MISSED, REPLAN
            </button>
          </span>
        ) : (
          status && localizeTimes(status.text, clock)
        )}
      </div>
    </div>
  )
}

/** Which function-row key a command amounts to, so the row can light it. */
function functionOf(action: { kind: string; screen?: string; view?: string }): string | null {
  if (action.kind === "open") {
    const screen = action.screen as Screen
    if (["activities", "hours", "meals", "free"].includes(screen)) return "edit"
    if (screen === "restart") return "system"
    return screen
  }
  if (action.kind === "view") return action.view ?? null
  return FUNCTIONS.includes(action.kind) ? action.kind : null
}

function ScreenBody({
  screen,
  rm,
  selected,
  onScreen,
  onClose,
  onRunWord,
  onSay,
  onRestart,
}: {
  screen: NonNullable<TerminalScreen>
  rm: RobotMode
  selected: PlacedBlock | null
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
    case "free":
      return <FreeTimeTerminal settings={settings} onPatchSettings={rm.patchSettings} />
    case "edit":
      return (
        <MenuScreen
          title="What do you want to edit?"
          items={[
            { key: "1", label: "Activities", note: `${settings.activities.length} on the list`, onSelect: () => onScreen({ name: "activities" }) },
            { key: "2", label: "Hours", note: `wake ${settings.wakeTime} · sleep ${settings.sleepTime}`, onSelect: () => onScreen({ name: "hours" }) },
            { key: "3", label: "Meals", onSelect: () => onScreen({ name: "meals" }) },
            { key: "4", label: "Free time", note: `${formatSpan(settings.minFreeMinutesPerDay)} a day`, onSelect: () => onScreen({ name: "free" }) },
          ]}
        />
      )
    case "system":
      return <SystemScreen rm={rm} onRunWord={onRunWord} onScreen={onScreen} onClose={onClose} onSay={onSay} />
    case "restart":
      return (
        <MenuScreen
          title="Erase everything?"
          note="The week, your activities, hours and meals. Save first if you want to keep them."
          items={[
            { key: "Y", label: "Yes, erase and start over", onSelect: onRestart },
            { key: "N", label: "No, keep it", onSelect: () => onScreen({ name: "system" }) },
          ]}
        />
      )
    case "fix":
      return <FixScreen rm={rm} onClose={onClose} onSay={onSay} />
    case "block":
      return selected && <BlockScreen block={selected} rm={rm} onScreen={onScreen} onClose={onClose} onSay={onSay} />
    case "help":
      return <HelpScreen onRunWord={onRunWord} />
    case "move":
      return selected && <MoveScreen block={selected} rm={rm} onScreen={onScreen} onSay={onSay} />
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
          <div key={item.key} className="flex items-baseline gap-6">
            <Command keyName={item.key} onClick={item.onSelect} disabled={item.disabled}>
              {item.label}
            </Command>
            {item.note && <span className="text-[24px] text-ink/50">{item.note}</span>}
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
  onClose,
  onSay,
}: {
  rm: RobotMode
  onRunWord: (word: string) => void
  onScreen: (screen: TerminalScreen) => void
  onClose: () => void
  onSay: (text: string, error?: boolean) => void
}) {
  const { clock, weekStart } = rm.display
  const template = rm.activeTemplate
  const items: MenuItem[] = [
    { key: "1", label: "Save a backup", onSelect: () => onRunWord("save") },
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
      onSelect: () => {
        rm.resetToTemplate()
        onSay(`RESET TO ${template.name.toUpperCase()}`)
        onClose()
      },
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
    () => unplaced.map((u) => ({ conflict: u, fixes: suggestFixes(settings, u) })),
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

function BlockScreen({
  block,
  rm,
  onScreen,
  onClose,
  onSay,
}: {
  block: PlacedBlock
  rm: RobotMode
  onScreen: (screen: TerminalScreen) => void
  onClose: () => void
  onSay: (text: string, error?: boolean) => void
}) {
  const { clock } = useDisplay()
  const activity = rm.state.settings.activities.find((a) => a.id === block.activityId)
  const name = block.name.toUpperCase()
  const items: MenuItem[] = []
  if (activity) {
    items.push({ key: "E", label: `Edit ${block.name}`, note: "length, times a week, days…", onSelect: () => onScreen({ name: "activities", id: activity.id }) })
  }
  items.push(
    { key: "M", label: "Move", note: "pick another day or time", onSelect: () => onScreen({ name: "move" }) },
    {
      key: "L",
      label: block.locked ? "Unlock" : "Lock",
      note: block.locked ? "let shuffles move it again" : "keep it here through shuffles",
      onSelect: () => {
        rm.toggleLock(block.id)
        onSay(block.locked ? `${name} UNLOCKED` : `${name} LOCKED`)
      },
    },
    {
      key: "X",
      label: "I missed this",
      note: "replan the rest of the week",
      onSelect: () => {
        rm.markMissed(block.id)
        onSay(`${name} MISSED · REST OF THE WEEK REPLANNED`)
        onClose()
      },
    },
    {
      key: "R",
      label: "Remove this session",
      onSelect: () => {
        rm.removeBlock(block.id)
        onSay(`${name} REMOVED THIS ONCE`)
        onClose()
      },
    },
  )

  return (
    <MenuScreen
      title={
        <>
          {block.name}
          {block.locked && " ■"}
        </>
      }
      note={
        <>
          {DAY_NAMES[block.day]} {formatClock(block.startMinute, clock)}–{formatClock(block.endMinute, clock)} ·{" "}
          {localizeTimes(block.reason, clock)}
        </>
      }
      items={items}
    />
  )
}

function hhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

function MoveScreen({
  block,
  rm,
  onScreen,
  onSay,
}: {
  block: PlacedBlock
  rm: RobotMode
  onScreen: (screen: TerminalScreen) => void
  onSay: (text: string, error?: boolean) => void
}) {
  const { clock, weekStart } = useDisplay()
  const [day, setDay] = useState<Day>(block.day)
  const [time, setTime] = useState(hhmm(block.startMinute))
  const [problem, setProblem] = useState<string | null>(null)
  const settings = rm.state.settings
  const wake = parseTime(settings.wakeTime)
  const sleepRaw = parseTime(settings.sleepTime)
  const sleep = sleepRaw <= wake ? sleepRaw + 1440 : sleepRaw
  const length = block.endMinute - block.startMinute

  const move = () => {
    let start = parseTime(time)
    // Past midnight, on a day that ends after midnight, still belongs to that day.
    if (start < wake && sleep > 1440) start += 1440
    if (start < wake || start + length > sleep) {
      setProblem(`It has to fit between ${formatClock(wake, clock)} and ${formatClock(sleep, clock)}`)
      return
    }
    const refused = rm.moveBlock(block.id, day, start)
    if (refused) {
      setProblem(refused)
      return
    }
    onSay(`${block.name.toUpperCase()} MOVED TO ${DAY_NAMES[day].toUpperCase()} ${formatClock(start, clock)} · LOCKED`)
    onScreen({ name: "block" })
  }

  return (
    <div className="font-crt uppercase">
      <h2 className="text-[56px] leading-none tracking-[0.04em]">Move {block.name}</h2>
      <p className="mt-3 text-[26px] tracking-[0.08em] text-ink/60">
        It stays locked there; the rest of the week fits around it.
      </p>

      <div className="mt-8 text-[28px] tracking-[0.2em] text-ink/60">Day</div>
      <div className="mt-2 flex flex-wrap gap-3 text-[34px]">
        {weekOrder(weekStart).map((d) => (
          <button
            key={d}
            type="button"
            data-nav
            aria-pressed={d === day}
            onClick={() => setDay(d)}
            className={`border px-3 ${d === day ? "border-ink bg-ink/20" : "border-ink/30 text-ink/50"}`}
          >
            {DAY_NAMES[d]}
          </button>
        ))}
      </div>

      <div className="mt-8 text-[28px] tracking-[0.2em] text-ink/60">Start</div>
      <div className="mt-2 flex items-center">
        <span className="flex items-center border border-ink/50 px-4 text-[96px] leading-none tabular-nums">
          <ClockReadout label="Start" value={time} arrows minuteStep={15} onChange={setTime} periodClassName="text-[36px]" />
        </span>
        <span className="ml-6 text-[30px] text-ink/60">for {formatSpan(length)}</span>
      </div>

      {problem && <p className="mt-6 text-[26px] text-alert [text-shadow:none]">{problem}</p>}

      <div className="mt-8">
        <Command keyName="Enter" onClick={move} primary>
          Move ▶
        </Command>
      </div>
    </div>
  )
}

/** The functions as the manual lists them; each one runs from here. */
const MANUAL_FUNCTIONS: [word: string, what: string][] = [
  ["add", "Add an activity. ADD SURF starts from 1H 1×; or type the whole line."],
  ["edit", "Change activities, hours, meals or free time. EDIT GYM · EDIT MEALS."],
  ["shuffle", "Same rules, a different arrangement of the week."],
  ["export", "Download the week as .ics, for any calendar app."],
  ["today", "Print today's ticket: the day's lines, what is on now, what is done."],
  ["grid", "Show the week as a calendar grid. PRINTOUT shows the list again."],
  ["system", "Save, load, 12H / 24H clock, week start, reset, restart."],
  ["fix", "Shown when a session doesn't fit: suggested fixes, one key each."],
  ["clear", "Shown after moving or locking blocks: undo those edits."],
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
  const days = <span className="normal-case">MTSaSu</span>
  return (
    <div className="font-crt uppercase">
      <div className="flex flex-wrap items-baseline gap-x-6">
        <h2 className="text-[48px] leading-none tracking-[0.04em]">Help</h2>
        <span className="text-[22px] tracking-[0.2em] text-ink/60">RM-01 · Command reference</span>
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
        <ManualLine cmd="REMOVE GYM">Take it off the list.</ManualLine>
      </ManualSection>

      <ManualSection title="What goes in a line">
        <ManualLine cmd="Length">1H · 45M · 1H30 · 90 MIN</ManualLine>
        <ManualLine cmd="Times a week">4× · 4X · 3 TIMES · TWICE · DAILY</ManualLine>
        <ManualLine cmd="Days">
          <span className="normal-case">M T W T F Sa Su</span>, in week order: {days} = Mon Tue Sat Sun ·{" "}
          <span className="normal-case">TT</span> = Tue Thu · WEEKDAYS · WEEKENDS
        </ManualLine>
        <ManualLine cmd="Time of day">MORNING 06–12 · AFTERNOON 12–18 · EVENING 18–23</ManualLine>
        <ManualLine cmd="Fixed time">ALWAYS AT 07:00</ManualLine>
      </ManualSection>

      <ManualSection title="Your day">
        <ManualLine cmd="WAKE 7:00 · SLEEP 23:30">When the day starts and ends.</ManualLine>
        <ManualLine cmd="FREE 2H">Time kept free every day.</ManualLine>
        <ManualLine cmd="12H · 24H · MON · SUN">How times read, and which day starts the week.</ManualLine>
      </ManualSection>

      <ManualSection title="During the day">
        <ManualLine cmd="NOW · NEXT">Top right of the terminal: what is on, and what comes after.</ManualLine>
        <ManualLine cmd="Y · N">When a session ends, the terminal asks DONE?: Y marks it, N replans the rest of the week.</ManualLine>
        <ManualLine cmd="SOUND · MUTE">The machine’s clicks, printer and hum. Also SYSTEM [S] and ♪ on the panel.</ManualLine>
      </ManualSection>

      <ManualSection title="Blocks">
        <ManualLine cmd="Click a block">
          On the printout or the grid: [E] edit · [M] move · [L] lock · [X] missed · [R] remove.
        </ManualLine>
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

/** The NOW / NEXT readout for where the day stands. */
function describeStatus(status: DayStatus, time: (minute: number) => string): { now: string; next?: string } {
  const next = status.kind !== "done" && status.next ? `${status.next.name.toUpperCase()} ${time(status.next.startMinute)}` : undefined
  switch (status.kind) {
    case "block":
      return { now: `NOW ${status.block.name.toUpperCase()} · ${formatSpan(status.left)} LEFT`, next }
    case "free":
      return { now: `FREE UNTIL ${time(status.until)}`, next }
    case "asleep":
      return { now: "BEFORE WAKE", next }
    case "done":
      return { now: "DAY OVER · SLEEP" }
  }
}
