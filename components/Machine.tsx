"use client"

import { useEffect, type ReactNode, type RefObject } from "react"
import { buzz } from "@/lib/sound"

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
 * The height of every screen's content, held exactly so the machine never
 * changes size between screens, from boot to the draft: the window minus the
 * header, the captions and legend under the screen, and the keyboard unit
 * (room is kept for it before it arrives), never less than the tallest screen
 * needs. What is longer (HELP, a long list) scrolls inside the screen. On a
 * phone the screen grows with what it shows, and the page scrolls.
 */
export const SCREEN_HEIGHT = "sm:h-[max(420px,calc(100dvh-480px))] max-sm:min-h-[420px]"

/**
 * One of the machine's screens, centred on the panel, with a caption printed
 * each side beneath it. On a phone the screen runs edge to edge.
 */
export function Console({
  children,
  captions: [left, right],
  legend,
}: {
  children: ReactNode
  captions: [ReactNode, ReactNode]
  legend?: LegendKey[]
}) {
  return (
    <div className="mx-auto w-full max-w-[1000px] py-6 sm:px-6">
      <div className="crt px-5 py-6 sm:px-12 sm:py-10">{children}</div>

      <div className="label mt-3 flex justify-between gap-4 px-4 text-ink/70 sm:px-0">
        <span>{left}</span>
        <span className="text-right">{right}</span>
      </div>

      {legend && <Legend keys={legend} />}
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
      // A key sent to the window itself counts as sent to the bare screen.
      const target = e.target instanceof HTMLElement ? e.target : document.body
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
        const by = e.key === "ArrowRight" ? 1 : -1
        // A screen laid out in columns (data-columns) goes across to the next column; anywhere else, ← → read in order.
        if (from?.closest("[data-columns]") && moveAcross(el, from, by)) return
        move(el, from, by)
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
export function reject(el: HTMLElement) {
  buzz()
  el.classList.remove("reject")
  void el.offsetWidth // restart the animation if it is already running
  el.classList.add("reject")
  setTimeout(() => el.classList.remove("reject"), 450)
}

/**
 * Move on from a field that has just been completed, as Enter would (passing
 * over Back). Does nothing if the cursor has already gone elsewhere.
 */
export function advance(el: HTMLElement) {
  const root = el.closest<HTMLElement>(".crt")
  if (root && document.activeElement === el) move(root, el, 1, true)
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
  if (next) show(next, items)
}

/**
 * Focus an item and bring it into view. A screen taller than its window
 * scrolls inside it; the first item takes it back to the very top (so the
 * heading shows again) and the last to the very bottom.
 */
function show(item: HTMLElement, items: HTMLElement[]) {
  item.focus({ preventScroll: true })
  const scroller = scrollerOf(item)
  if (scroller && item === items[0]) scroller.scrollTo({ top: 0 })
  else if (scroller && item === items.at(-1)) scroller.scrollTo({ top: scroller.scrollHeight })
  else item.scrollIntoView({ block: "nearest" })
}

/** The nearest ancestor that scrolls its content. */
function scrollerOf(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if ((overflowY === "auto" || overflowY === "scroll") && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

/**
 * Across to the next column: the item beside this one, on the same line or the
 * nearest to it, in the column to the left or right. False when there is no
 * column that way, so the caller can fall back to reading order.
 */
function moveAcross(root: HTMLElement, from: HTMLElement, by: 1 | -1): boolean {
  const items = navItems(root)
  const here = from.getBoundingClientRect()
  const midY = here.top + here.height / 2
  const beyond = items
    .filter((el) => el !== from)
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => (by === 1 ? r.left >= here.right - 4 : r.right <= here.left + 4))
  if (!beyond.length) return false
  // The nearest column first, then the line closest to this one within it.
  const columnX = by === 1 ? Math.min(...beyond.map(({ r }) => r.left)) : Math.max(...beyond.map(({ r }) => r.right))
  const column = beyond.filter(({ r }) => Math.abs((by === 1 ? r.left : r.right) - columnX) < 40)
  const distance = (r: DOMRect) => Math.abs(r.top + r.height / 2 - midY)
  const next = column.sort((a, b) => distance(a.r) - distance(b.r))[0]?.el
  if (!next) return false
  show(next, items)
  return true
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
  const next = line.sort((a, b) => distance(a.r) - distance(b.r))[0]?.el
  if (next) show(next, items)
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
        primary ? "border-2 border-ink px-4 py-2 text-[28px] hover:bg-ink/15 sm:px-5 sm:text-[34px]" : "px-2 text-[26px] hover:bg-ink/15"
      }`}
    >
      {keyName && <span className="text-ink/70 pointer-coarse:hidden">[{keyName}] </span>}
      {children}
    </button>
  )
}

/** A key in a legend: what to press, what it does, and whether it is the one that matters now. */
export type LegendKey = [key: string, what: string, now?: boolean]

/**
 * The keys that matter on the current step, printed beneath the screen: no
 * more than three, dimmed, with the one to press now lit.
 */
export function Legend({ keys }: { keys: LegendKey[] }) {
  return (
    // Keys mean nothing on a touchscreen: the legend is only printed where there is a keyboard to read it for.
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 sm:px-0 pointer-coarse:hidden">
      {keys.slice(0, 3).map(([key, what, now]) => (
        <span key={`${key} ${what}`} className={`label flex items-center gap-2 ${now ? "text-ink" : "text-ink/35"}`}>
          <kbd
            className={`border border-b-[3px] px-1.5 py-0.5 font-mono text-[10px] ${
              now ? "border-black bg-ink text-paper" : "border-ink/30 bg-white/20 text-ink/45"
            }`}
          >
            {key}
          </kbd>
          {what}
        </span>
      ))}
    </div>
  )
}

/**
 * A two-position switch on the panel: a lit knob in a dark slot, the chosen
 * side's label printed bright. `small` is the header size.
 */
export function PanelSwitch({
  left,
  right,
  on,
  onChange,
  label,
  small = false,
}: {
  left: string
  right: string
  /** True when the right-hand position is selected. */
  on: boolean
  onChange: (on: boolean) => void
  label: string
  small?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={() => onChange(!on)}
      className={`key flex items-center ${small ? "gap-2 px-2 py-1 text-[10px]" : "gap-3 px-4 py-2 text-[12px]"}`}
    >
      <span className={on ? "text-ink/40" : ""}>{left}</span>
      <span className={`relative border border-ink bg-screen ${small ? "h-4 w-8" : "h-5 w-11"}`}>
        <span
          className={`absolute bg-phosphor transition-[left] duration-150 ${
            small ? "top-[2px] h-2.5 w-3" : "top-[3px] h-3 w-4"
          } ${on ? (small ? "left-[calc(100%-14px)]" : "left-[calc(100%-19px)]") : small ? "left-[2px]" : "left-[3px]"}`}
          style={{ filter: "drop-shadow(0 0 3px #ffb238)" }}
        />
      </span>
      <span className={on ? "" : "text-ink/40"}>{right}</span>
    </button>
  )
}
