"use client"

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import type { Day, PlacedBlock } from "@/lib/types"
import type { RobotMode } from "@/lib/useRobotMode"
import { DAY_NAMES } from "@/lib/scheduler/time"
import { formatClock, formatSpan, weekOrder } from "@/lib/locale"
import { dayTimeline, isoWeek } from "@/lib/printout"
import { beep, buzz } from "@/lib/sound"
import { useDisplay } from "./Display"
import { REVEAL_DAY_MS, WeekChart, dayBounds, useHourFit, type Ghost } from "./WeekGrid"

/** How far one press of ↑ ↓ moves a session being moved. */
const STEP_MINUTES = 15
/** The height of the picked session's keys, five lines of them. */
const STRIP_PX = 130

/**
 * The draft: the week on the machine's screen, the one place it is edited.
 * Every change re-solves it here, live; the paper only changes on PRINT.
 *
 * Pick a session with a click, or Tab onto the screen and use the arrows. Its
 * keys open beside it: [M] move (a ghost steps with the arrows; Enter puts it
 * down, locked), [L] lock, [R] remove this once, [E] edit the activity, and
 * Enter for everything else on the terminal's BLOCK screen. Sessions the last
 * edit moved flash, so the re-solve can be followed.
 *
 * With `reveal`, the week is drawn in a day at a time; any key or a click
 * finishes it. On a phone the screen lists the week instead, and a picked
 * session opens on the terminal, where there is room for its keys.
 */
export function DraftScreen({
  rm,
  selectedId,
  onSelect,
  phone,
  docked,
  reveal,
  onRevealed,
  onEdit,
  onMore,
  onPrint,
}: {
  rm: RobotMode
  selectedId: string | null
  onSelect: (id: string | null) => void
  phone: boolean
  /** A screen is open on the terminal: the keys there are the ones that count. */
  docked: boolean
  reveal: boolean
  onRevealed: () => void
  /** Open the activity on the terminal's editor. */
  onEdit: (activityId: string) => void
  /** Open the picked session on the terminal's BLOCK screen. */
  onMore: () => void
  onPrint: () => void
}) {
  const { clock, weekStart } = useDisplay()
  const settings = rm.state.settings
  const blocks = rm.schedule.blocks
  const selected = blocks.find((b) => b.id === selectedId) ?? null
  const root = useRef<HTMLDivElement>(null)
  const hourPx = useHourFit(root, settings)
  const { wake, sleep } = dayBounds(settings)
  const never = rm.state.printed === null
  const [say, setSay] = useState<{ text: string; error?: boolean } | null>(null)

  // Moving the picked session: where its ghost is.
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const moving = ghost && selected ? ghost : null

  // The reveal paces itself; when the last column is drawn, the week is the user's.
  useEffect(() => {
    if (!reveal) return
    const ticks = weekOrder(weekStart).map((_, i) => window.setTimeout(() => beep(660 + i * 70, 0.03), i * REVEAL_DAY_MS))
    const done = window.setTimeout(onRevealed, 7 * REVEAL_DAY_MS + 500)
    return () => {
      ticks.forEach(clearTimeout)
      clearTimeout(done)
    }
  }, [reveal, onRevealed, weekStart])

  // After the reveal, the way forward is PRINT: it takes the keyboard, ready for Enter.
  const printKey = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!reveal && never) printKey.current?.querySelector("button")?.focus()
  }, [reveal, never])

  const changed = useMovedSessions(blocks, reveal)

  // A message on the screen's own status line clears itself.
  useEffect(() => {
    if (!say) return
    const t = window.setTimeout(() => setSay(null), 4000)
    return () => clearTimeout(t)
  }, [say])

  const pick = (id: string | null) => {
    setGhost(null)
    onSelect(id)
    if (!phone) root.current?.focus({ preventScroll: true })
  }

  const startMove = (block: PlacedBlock) =>
    setGhost({ day: block.day, startMinute: block.startMinute, endMinute: block.endMinute, name: block.name })

  const putDown = () => {
    if (!moving || !selected) return
    const refused = rm.moveBlock(selected.id, moving.day, moving.startMinute)
    if (refused) {
      buzz()
      setGhost({ ...moving, refused: true })
      setSay({ text: refused, error: true })
      return
    }
    beep(1320, 0.04)
    setGhost(null)
    setSay({ text: `${selected.name} moved to ${DAY_NAMES[moving.day]} ${formatClock(moving.startMinute, clock)} · locked` })
  }

  const lock = (block: PlacedBlock) => {
    rm.toggleLock(block.id)
    setSay({ text: block.locked ? `${block.name} unlocked` : `${block.name} locked · it stays through shuffles` })
  }

  const remove = (block: PlacedBlock) => {
    rm.removeBlock(block.id)
    onSelect(null)
    setSay({ text: `${block.name} removed this once · Clear edits brings it back` })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey || docked) return
    if (reveal) {
      e.preventDefault()
      return onRevealed()
    }
    const order = weekOrder(weekStart)
    if (moving) {
      const length = moving.endMinute - moving.startMinute
      const at = (day: Day, start: number) => {
        const startMinute = Math.min(Math.max(start, wake), sleep - length)
        setGhost({ ...moving, day, startMinute, endMinute: startMinute + length, refused: false })
      }
      const step = (by: number) => order[Math.min(Math.max(order.indexOf(moving.day) + by, 0), 6)]
      const keys: Record<string, () => void> = {
        ArrowUp: () => at(moving.day, moving.startMinute - STEP_MINUTES),
        ArrowDown: () => at(moving.day, moving.startMinute + STEP_MINUTES),
        ArrowLeft: () => at(step(-1), moving.startMinute),
        ArrowRight: () => at(step(1), moving.startMinute),
        Enter: putDown,
        Escape: () => setGhost(null),
      }
      if (!keys[e.key]) return
      e.preventDefault()
      return keys[e.key]()
    }
    if (e.key.startsWith("Arrow")) {
      e.preventDefault()
      const next = selected ? neighbour(blocks, selected, e.key, order) : firstOf(blocks, order)
      if (next) onSelect(next.id)
      return
    }
    if (!selected) return
    const keys: Record<string, () => void> = {
      m: () => startMove(selected),
      l: () => lock(selected),
      r: () => remove(selected),
      e: () => onEdit(selected.activityId),
      Enter: onMore,
      Escape: () => onSelect(null),
    }
    const run = keys[e.key.length === 1 ? e.key.toLowerCase() : e.key]
    if (!run) return
    e.preventDefault()
    run()
  }

  // The status line: what the keys do now, or what just happened.
  const hint = moving
    ? "[↑↓] 15 min · [←→] day · [Enter] put it here · [Esc] cancel"
    : selected
      ? "[←↑↓→] next session · [Enter] more · [Esc] done"
      : "Click a session, or Tab here and use the arrows"
  const { week } = isoWeek(new Date())

  return (
    <div className="mx-auto w-full max-w-[1080px] px-3 py-3 sm:px-6 no-print">
      <div
        ref={root}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onClick={reveal ? onRevealed : undefined}
        aria-label="The draft week. Arrows pick a session."
        className="crt px-3 py-2 font-mono uppercase outline-none focus-visible:outline-2 sm:px-5 sm:py-3"
      >
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 border-b border-ink/40 pb-1 font-crt text-[18px] tracking-[0.12em] sm:text-[20px]">
          <span>
            Draft · week {week}
            <span className="text-ink/50 max-sm:hidden"> · edit it here, then print</span>
          </span>
          <span className={rm.unprinted && !never ? "text-alert [text-shadow:none]" : "text-ink/55"}>
            {never ? "Not printed yet" : rm.unprinted ? "Changed since printed" : "Same as the paper"}
          </span>
        </div>

        {phone ? (
          <DraftList blocks={blocks} wake={wake} sleep={sleep} selectedId={selectedId} onSelect={pick} reveal={reveal} changed={changed} />
        ) : (
          <WeekChart
            settings={settings}
            blocks={blocks}
            hourPx={hourPx}
            selectedId={selectedId}
            onSelect={pick}
            screen
            ghost={moving}
            changed={changed}
            reveal={reveal}
            picked={
              docked
                ? undefined
                : (block, column) => (
                    <Strip block={block} column={column} hourPx={hourPx} wake={wake} sleep={sleep}>
                      <StripKey k="M" onClick={() => startMove(block)}>Move</StripKey>
                      <StripKey k="L" onClick={() => lock(block)}>{block.locked ? "Unlock" : "Lock"}</StripKey>
                      <StripKey k="R" onClick={() => remove(block)}>Remove</StripKey>
                      <StripKey k="E" onClick={() => onEdit(block.activityId)}>Edit {block.name}</StripKey>
                      <StripKey k="↵" onClick={onMore}>More</StripKey>
                    </Strip>
                  )
            }
          />
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-ink/40 pt-1.5 font-crt text-[17px] tracking-[0.08em] sm:text-[19px]">
          <span className={say?.error ? "text-alert [text-shadow:none]" : say ? "" : "text-ink/50 pointer-coarse:hidden"}>
            {say ? say.text : reveal ? "Drawing the week · any key to skip" : hint}
          </span>
          {never && !reveal && (
            <div ref={printKey} className="ml-auto flex items-center gap-4">
              <span className="text-ink/60">Your week is drafted. Change anything, then</span>
              <button type="button" onClick={onPrint} className="border-2 border-ink bg-ink px-3 uppercase text-paper [text-shadow:none] hover:opacity-90">
                <span className="opacity-60 pointer-coarse:hidden">[Enter] </span>Print ▶
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** The picked session's keys, opened beside it: under it, or over it when it sits low in the day. */
function Strip({
  block,
  column,
  hourPx,
  wake,
  sleep,
  children,
}: {
  block: PlacedBlock
  column: number
  hourPx: number
  wake: number
  sleep: number
  children: ReactNode
}) {
  // Under the session when the day has room for the keys below it; otherwise over it.
  const below = ((sleep - block.endMinute) / 60) * hourPx > STRIP_PX
  const edge = (((below ? block.endMinute : block.startMinute) - wake) / 60) * hourPx
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`absolute z-20 flex w-max flex-col border-2 border-ink bg-paper py-1 font-crt text-[17px] tracking-[0.06em] shadow-[0_0_0_3px_var(--color-paper)] ${
        column > 3 ? "right-0" : "left-0"
      }`}
      style={below ? { top: edge + 3 } : { bottom: `calc(100% - ${edge - 3}px)` }}
    >
      {children}
    </div>
  )
}

function StripKey({ k, onClick, children }: { k: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="px-2 text-left uppercase hover:bg-ink/20">
      <span className="text-ink/55 pointer-coarse:hidden">[{k}] </span>
      {children}
    </button>
  )
}

/** On a phone: the draft as a list, a day after another, each session a line to pick. */
function DraftList({
  blocks,
  wake,
  sleep,
  selectedId,
  onSelect,
  reveal,
  changed,
}: {
  blocks: PlacedBlock[]
  wake: number
  sleep: number
  selectedId: string | null
  onSelect: (id: string | null) => void
  reveal: boolean
  changed: ReadonlySet<string>
}) {
  const { clock, weekStart } = useDisplay()
  return (
    <div className="space-y-3 text-[13px]">
      {weekOrder(weekStart).map((day, column) => (
        <section key={day}>
          <h3 className="border-b border-dashed border-ink/30 tracking-[0.2em] text-ink/60">{DAY_NAMES[day]}</h3>
          <ol>
            {dayTimeline(blocks.filter((b) => b.day === day), wake, sleep).map((row, i) =>
              row.kind === "block" ? (
                <li key={row.block.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(row.block.id === selectedId ? null : row.block.id)}
                    className={`flex w-full items-baseline gap-2 px-1 text-left uppercase ${row.block.id === selectedId ? "bg-ink text-paper [text-shadow:none]" : ""} ${
                      changed.has(row.block.id) ? "changed" : ""
                    } ${reveal ? "draw-in" : ""}`}
                    style={reveal ? { animationDelay: `${column * REVEAL_DAY_MS + i * 40}ms` } : undefined}
                  >
                    <span className="w-14 shrink-0 tabular-nums">{formatClock(row.minute, clock)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {row.block.name}
                      {row.block.locked && " ■"}
                    </span>
                    <span className="tabular-nums opacity-70">{formatSpan(row.block.endMinute - row.block.startMinute)}</span>
                  </button>
                </li>
              ) : null,
            )}
          </ol>
        </section>
      ))}
    </div>
  )
}

/**
 * The sessions whose place changed since the week was last drawn: what an
 * edit, and the re-solve after it, moved. Cleared once they have flashed.
 */
function useMovedSessions(blocks: PlacedBlock[], paused: boolean): ReadonlySet<string> {
  const last = useRef<Map<string, string> | null>(null)
  const [changed, setChanged] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    const now = new Map(blocks.map((b) => [b.id, `${b.day}|${b.startMinute}|${b.endMinute}`]))
    const before = last.current
    last.current = now
    if (!before || paused) return
    const moved = new Set([...now].filter(([id, at]) => before.get(id) !== at).map(([id]) => id))
    if (moved.size === 0) return
    // Deferred a tick: the flash is a reaction to the edit, drawn after it.
    const show = window.setTimeout(() => setChanged(moved), 0)
    const clear = window.setTimeout(() => setChanged(new Set()), 950)
    return () => {
      clearTimeout(show)
      clearTimeout(clear)
    }
  }, [blocks, paused])
  return changed
}

/** The first session of the week, in week order. */
function firstOf(blocks: PlacedBlock[], order: Day[]): PlacedBlock | null {
  for (const day of order) {
    const first = blocks.filter((b) => b.day === day).sort((a, b) => a.startMinute - b.startMinute)[0]
    if (first) return first
  }
  return null
}

/** The session an arrow leads to: ↑ ↓ the one before or after in the day, ← → the nearest in time on the next day that has any. */
function neighbour(blocks: PlacedBlock[], from: PlacedBlock, key: string, order: Day[]): PlacedBlock | null {
  const sameDay = blocks.filter((b) => b.day === from.day).sort((a, b) => a.startMinute - b.startMinute)
  const at = sameDay.findIndex((b) => b.id === from.id)
  if (key === "ArrowUp") return sameDay[at - 1] ?? from
  if (key === "ArrowDown") return sameDay[at + 1] ?? from
  const by = key === "ArrowLeft" ? -1 : 1
  for (let i = order.indexOf(from.day) + by; i >= 0 && i < order.length; i += by) {
    const day = blocks.filter((b) => b.day === order[i])
    if (day.length === 0) continue
    return day.reduce((best, b) => (Math.abs(b.startMinute - from.startMinute) < Math.abs(best.startMinute - from.startMinute) ? b : best))
  }
  return from
}
