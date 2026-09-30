"use client"

import { useEffect, type ReactNode, type RefObject } from "react"

export type Phase = "idle" | "input" | "process" | "output"

const PHASES: [Exclude<Phase, "idle">, string][] = [
  ["input", "Input"],
  ["process", "Process"],
  ["output", "Output"],
]

/** An indicator lamp. Lit is phosphor with a halo; unlit is a dark bead. */
export function Lamp({ on = true, blink = false }: { on?: boolean; blink?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 border border-ink/60 ${on ? "bg-phosphor" : "bg-ink/25"} ${blink ? "blink" : ""}`}
      style={on ? { filter: "drop-shadow(0 0 3px #ffb238)" } : undefined}
    />
  )
}

/**
 * The panel's left edge: which stage the machine is in. Decoration that keeps
 * the world coherent, so it gives way on narrow screens.
 */
export function Rail({ phase, status }: { phase: Phase; status: string }) {
  return (
    <aside className="hidden w-[180px] shrink-0 border-r border-ink/30 px-5 py-6 lg:block">
      <div className="label border-b border-ink/40 pb-1.5 text-ink/60">System</div>
      <ol className="mt-3 space-y-2">
        {PHASES.map(([key, name], i) => (
          <li key={key} className={`label flex items-center gap-2.5 ${phase === key ? "text-ink" : "text-ink/35"}`}>
            <Lamp on={phase === key} />
            {String(i + 1).padStart(2, "0")} {name}
          </li>
        ))}
      </ol>

      <div className="label mt-10 border-b border-ink/40 pb-1.5 text-ink/60">Status</div>
      <div className="label mt-3 flex items-center gap-2.5">
        <Lamp blink={phase === "process"} />
        {status}
      </div>
    </aside>
  )
}

/** A screen set into the panel, with a caption printed under the bezel. */
export function Screen({
  children,
  caption,
  padding = "px-6 py-6 sm:px-8 sm:py-7",
}: {
  children: ReactNode
  caption?: ReactNode
  padding?: string
}) {
  return (
    <div>
      <div className={`crt ${padding}`}>{children}</div>
      {caption && <div className="label mt-2 flex justify-between text-ink/55">{caption}</div>}
    </div>
  )
}

/**
 * Drives a screen from the keyboard, the way a terminal would:
 *   ← →     previous / next field, in reading order (inside a text field, only
 *           once the cursor is at its edge)
 *   ↑ ↓     the field above / below, by position on the screen
 *   Enter   on a field: check it, then go to the next one. A field that fails
 *           (`aria-invalid`) flashes and keeps the selection. On a button: press
 *           it. On nothing: the screen's main action.
 *   Esc     back
 * Fields are `data-nav`; a button marked `data-enter="next"` (a switch) is
 * passed over by Enter like a field, and flips on Space instead. Enter skips
 * `data-enter-skip` items (Back), so it always heads for the way forward.
 *
 * Items handle their own keys first (a readout takes ↑ ↓, a form takes a
 * blank Enter) and call preventDefault; whatever they leave comes here. Keys
 * pressed with nothing focused count as pressed on the screen.
 *
 * `focusKey` changes whenever the screen shows something new; the selection
 * then lands on `data-autofocus`, or else the first item.
 */
export function useTerminal(
  root: RefObject<HTMLElement | null>,
  { onEnter, onEscape, focusKey }: { onEnter?: () => void; onEscape?: () => void; focusKey?: unknown },
) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    const target = el.querySelector<HTMLElement>("[data-autofocus]:not(:disabled)") ?? navItems(el)[0]
    target?.focus()
  }, [root, focusKey])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = root.current
      const target = e.target as HTMLElement
      if (!el || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const inside = el.contains(target)
      if (!inside && target !== document.body) return
      const selectable = inside && target.hasAttribute("data-nav")
      const from = inside ? target : null

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        // Native controls that use the arrows themselves keep them.
        if (inside && !selectable && usesArrows(target)) return
        e.preventDefault()
        moveVertical(el, from, e.key === "ArrowDown" ? 1 : -1)
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        // Fields in an editor keep their arrows; text fields keep them until the cursor hits an edge.
        if (inside && !selectable) return
        if (selectable && isTextField(target) && !atEdge(target as HTMLInputElement, e.key)) return
        e.preventDefault()
        move(el, from, e.key === "ArrowRight" ? 1 : -1)
      } else if (e.key === "Enter") {
        // A held key would race through every screen; one press, one step.
        if (e.repeat) return e.preventDefault()
        if (!inside) {
          e.preventDefault()
          onEnter?.()
        } else if (selectable && (target.tagName === "INPUT" || target.dataset.enter === "next")) {
          // Stops the form submitting or the switch flipping: Enter only moves on.
          e.preventDefault()
          if (target.getAttribute("aria-invalid") === "true") reject(target)
          else move(el, target, 1, true)
        }
      } else if (e.key === "Escape") {
        onEscape?.()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [root, onEnter, onEscape])
}

function navItems(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("[data-nav]")].filter(
    (el) => !(el as HTMLButtonElement).disabled && el.offsetParent !== null,
  )
}

function usesArrows(el: HTMLElement): boolean {
  if (el.tagName === "SELECT" || el.tagName === "TEXTAREA") return true
  return el.tagName === "INPUT" && ["time", "number", "date", "range"].includes((el as HTMLInputElement).type)
}

function isTextField(el: HTMLElement): boolean {
  return el.tagName === "INPUT" && !el.hasAttribute("data-readout")
}

function atEdge(input: HTMLInputElement, key: string): boolean {
  const { selectionStart, selectionEnd, value } = input
  if (selectionStart !== selectionEnd) return false
  return key === "ArrowLeft" ? selectionStart === 0 : selectionEnd === value.length
}

/** The field says no: a brief flash, and the selection stays where it is. */
function reject(el: HTMLElement) {
  el.classList.remove("reject")
  void el.offsetWidth // restart the animation if it is already running
  el.classList.add("reject")
  setTimeout(() => el.classList.remove("reject"), 450)
}

/** Next or previous item from `from` in reading order, stopping at the ends. */
function move(root: HTMLElement, from: HTMLElement | null, by: 1 | -1, forEnter = false) {
  const items = navItems(root).filter((el) => el === from || !(forEnter && el.hasAttribute("data-enter-skip")))
  if (items.length === 0) return
  const at = from ? items.indexOf(from) : -1
  let next: HTMLElement | undefined
  if (at >= 0) next = items[Math.min(Math.max(at + by, 0), items.length - 1)]
  else if (from) {
    // Focus is on something that isn't an item (a field in an editor): step from where it sits.
    const after = items.filter((el) => from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
    next = by === 1 ? after[0] : items.filter((el) => !after.includes(el)).at(-1)
  } else next = by === 1 ? items[0] : items.at(-1)
  next?.focus()
}

/**
 * The item on the nearest line above or below, closest to the same column,
 * so ↓ from a meal's switch lands on the next meal's switch.
 */
function moveVertical(root: HTMLElement, from: HTMLElement | null, by: 1 | -1) {
  const items = navItems(root)
  if (!from || !items.length) return move(root, from, by)
  const here = from.getBoundingClientRect()
  const midY = here.top + here.height / 2
  const midX = here.left + here.width / 2
  const beyond = items
    .filter((el) => el !== from)
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => (by === 1 ? r.top >= midY : r.bottom <= midY))
  if (!beyond.length) return
  const lineY = by === 1 ? Math.min(...beyond.map(({ r }) => r.top)) : Math.max(...beyond.map(({ r }) => r.bottom))
  const line = beyond.filter(({ r }) => (by === 1 ? r.top - lineY < 12 : lineY - r.bottom < 12))
  const distance = (r: DOMRect) => Math.abs(r.left + r.width / 2 - midX)
  line.sort((a, b) => distance(a.r) - distance(b.r))[0]?.el.focus()
}

/**
 * A command shown on the screen, the way a terminal lists what it will accept:
 * "[ENTER] CONTINUE ▶". Selectable and clickable like any other item.
 */
export function Command({
  keyName,
  children,
  onClick,
  disabled,
  primary = false,
  secondary = false,
}: {
  /** The key that triggers it, when there is one. */
  keyName?: string
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  /** A way out rather than forward (Back): Enter passes it by. */
  secondary?: boolean
}) {
  return (
    <button
      type="button"
      data-nav
      data-enter-skip={secondary || undefined}
      onClick={onClick}
      disabled={disabled}
      className={`font-crt uppercase tracking-[0.08em] disabled:opacity-30 ${
        primary ? "border-2 border-ink px-5 py-2 text-[34px] hover:bg-ink/15" : "px-2 text-[26px] hover:bg-ink/15"
      }`}
    >
      {keyName && <span className="text-ink/60">[{keyName}] </span>}
      {children}
    </button>
  )
}

/** The keys a screen accepts, printed on the panel beneath it like a legend. */
export function Legend({ keys }: { keys: [string, string][] }) {
  return (
    <div className="mt-6 flex h-11 flex-wrap items-center gap-x-6 gap-y-1 overflow-hidden">
      {keys.map(([key, what]) => (
        <span key={`${key} ${what}`} className="label flex items-center gap-2 text-ink/60">
          <kbd className="border border-ink border-b-[3px] bg-white/35 px-1.5 py-0.5 font-mono text-[10px] text-ink">
            {key}
          </kbd>
          {what}
        </span>
      ))}
    </div>
  )
}
