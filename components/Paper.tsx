"use client"

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { printLine } from "@/lib/sound"
import { Printer } from "./Printer"

/**
 * Something the machine prints: an output unit, and the paper coming out of
 * it. Every view of the week is one of these (the line printer's sheet, the
 * plotter's grid, the day's ticket), so they all arrive the same way.
 *
 * With `feed`, the paper is printed in front of you first: it feeds out of the
 * slot a line at a time while the head shuttles. A click on the paper, or any
 * key, finishes it at once.
 */
export function Paper({
  printer,
  width,
  className,
  feed = false,
  onFed,
  compact = false,
  bare = false,
  onTear,
  tearing = false,
  empty = false,
  onFormFeed,
  children,
}: {
  printer?: { name?: string; spec?: string; width?: string }
  /** Less room around it, and the printer's lower casing. */
  compact?: boolean
  /** Paper alone, no printer: a sheet already out of the machine (the binder's). */
  bare?: boolean
  /** The paper's width, as a Tailwind max-width class. */
  width: string
  className: string
  feed?: boolean
  onFed?: () => void
  /** Tear the sheet off: offered by pulling the paper down, and by the printer's Tear off key. */
  onTear?: () => void
  /** The sheet is being torn away: it drops out of view. */
  tearing?: boolean
  /** No paper out: the sheet has been torn off and nothing printed since. */
  empty?: boolean
  /** The empty slot's key: print a fresh sheet. */
  onFormFeed?: () => void
  children: ReactNode
}) {
  const sheet = useRef<HTMLElement>(null)
  const { shift, finish } = usePaperFeed(sheet, feed, onFed)
  const printing = shift !== null
  const [learned, setLearned] = useState(pulledBefore)
  const { pull, handlers } = usePull(onTear && !printing && !tearing ? onTear : undefined, () => {
    setLearned(true)
    rememberPulled()
  })
  // Until a sheet has been torn off by pulling once, the perforation says how. On a phone,
  // where pulling scrolls instead, it is the tear-off key itself, so it always stays.
  const showHint = !!onTear && !printing && !tearing && !empty && pull === 0

  return (
    // Grows to whatever is widest (a chart wider than the phone), keeping its margin on both sides.
    <div className={`min-w-fit px-3 sm:px-6 ${compact ? "py-3" : "py-4 sm:py-10"}`}>
      {!bare && (
        <Printer
          {...printer}
          compact={compact}
          printing={printing}
        />
      )}

      {empty && (
        // Only the slot: the week is in the binder until a fresh sheet is asked for.
        <div className="label mx-auto mt-8 flex max-w-[480px] flex-col items-center gap-4 border-2 border-dashed border-ink/30 px-6 py-8 text-center leading-relaxed text-ink/55 no-print">
          <span>
            Sheet torn off and filed in the binder.
            <br />
            The printer stays empty until you ask for a fresh one.
          </span>
          {onFormFeed && (
            <button type="button" onClick={onFormFeed} title="Print a fresh sheet (or type FEED)" className="key px-3 py-1.5">
              Form feed ▼
            </button>
          )}
        </div>
      )}

      {/* While printing, the paper still inside the printer (above the slot) is hidden. */}
      <div
        hidden={empty}
        className={`relative mx-auto ${width} ${printing || tearing ? "overflow-hidden" : ""}`}
        onPointerDown={(e) => {
          if (printing) return finish()
          handlers.onPointerDown(e)
        }}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerUp}
        onClickCapture={handlers.onClickCapture}
      >
        {showHint && (
          // On the perforation: a printed tab in solid ink, its arrows nudging the way to pull.
          <div className={`pointer-events-none absolute inset-x-6 -top-2.5 z-10 items-center gap-2 no-print ${learned ? "hidden pointer-coarse:flex" : "flex"}`}>
            <span className="h-px flex-1 border-t-2 border-dashed border-ink/60" />
            <span className="label flex items-center gap-2 bg-ink px-2.5 py-1 text-[10px] text-sheet pointer-coarse:hidden">
              <span aria-hidden className="nudge inline-block text-phosphor">↓</span>
              Pull down to tear off
              <span aria-hidden className="nudge inline-block text-phosphor">↓</span>
            </span>
            {/* A phone scrolls instead of pulling: there, the tab is a key. */}
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onTear}
              className="label pointer-events-auto hidden items-center gap-2 bg-ink px-2.5 py-1 text-[10px] text-sheet pointer-coarse:flex"
            >
              ✂ Tear off and file
            </button>
            <span className="h-px flex-1 border-t-2 border-dashed border-ink/60" />
          </div>
        )}
        {/* Pulled down: the perforation shows, and says what letting go will do. */}
        {pull > 0 && (
          <div className="label pointer-events-none absolute inset-x-0 -top-1 z-10 flex items-center gap-3 text-ink/70 no-print">
            <span className="h-px flex-1 border-t-2 border-dashed border-ink/50" />
            {pull >= TEAR_AT ? "Release to tear off and file" : "Pull to tear off ↓"}
            <span className="h-px flex-1 border-t-2 border-dashed border-ink/50" />
          </div>
        )}
        <article
          ref={sheet}
          style={
            printing
              ? { transform: `translateY(${shift}px)` }
              : pull > 0
                ? { transform: `translateY(${pull}px) rotate(${pull / 120}deg)` }
                : undefined
          }
          // The spring back after a short pull eases; printing never does. Eased, the paper would
          // glide down from where it waits far above the slot, and lag behind the print head.
          className={`${className} ${tearing ? "tear-away" : ""} ${pull === 0 && !tearing && !printing ? "transition-transform duration-200" : ""}`}
        >
          {children}
        </article>
      </div>
    </div>
  )
}

/** Set once a sheet has been torn off by pulling, so the hint stops. A per-browser nicety: lost, it only shows again. */
const PULLED_KEY = "robot-mode:pulled"

function pulledBefore(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(PULLED_KEY) === "1"
  } catch {
    return false
  }
}

function rememberPulled() {
  try {
    window.localStorage.setItem(PULLED_KEY, "1")
  } catch {
    // Private browsing: the hint just comes back next time.
  }
}

/** How far the paper must be pulled before letting go tears it off. */
const TEAR_AT = 140

/**
 * The tear-off gesture: press on the paper and pull it down. It follows the
 * pointer (with some resistance) and, let go past TEAR_AT, tears; short of
 * that it springs back. A pull that moved never counts as a click on the block
 * under it.
 */
function usePull(onTear?: () => void, onPulled?: () => void) {
  const [pull, setPull] = useState(0)
  // A pull that moved: the click it ends with must not reach the block under it.
  const moved = useRef(false)

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (!onTear || e.button !== 0) return
      const start = e.clientY
      let distance = 0
      moved.current = false
      // Followed on the window, so a quick pull that leaves the paper still counts.
      const move = (ev: PointerEvent) => {
        const dy = ev.clientY - start
        if (!moved.current && dy < 8) return
        if (!moved.current) {
          // A pull, not a text selection: nothing on the page gets highlighted along the way.
          document.body.style.userSelect = "none"
          window.getSelection()?.removeAllRanges()
        }
        moved.current = true
        // Paper resists: the further it goes, the harder it pulls.
        distance = Math.max(0, Math.min(240, dy * 0.8))
        setPull(distance)
      }
      const up = () => {
        window.removeEventListener("pointermove", move)
        window.removeEventListener("pointerup", up)
        window.removeEventListener("pointercancel", up)
        document.body.style.userSelect = ""
        if (moved.current && distance >= TEAR_AT) {
          onTear()
          onPulled?.()
        }
        setPull(0)
      }
      window.addEventListener("pointermove", move)
      window.addEventListener("pointerup", up)
      window.addEventListener("pointercancel", up)
    },
    onPointerMove: () => {},
    onPointerUp: () => {},
    onClickCapture: (e: React.MouseEvent) => {
      if (!moved.current) return
      moved.current = false
      e.preventDefault()
      e.stopPropagation()
    },
  }
  return { pull, handlers }
}

/** One printed line, roughly: the paper advances in steps of this, like a dot-matrix. */
const LINE_PX = 22
/** Feed speed, with the whole sheet kept between 2 and 5 seconds. */
const FEED_PX_PER_SEC = 650

/**
 * Runs the printing animation while `active`, as paper feeding out of the
 * slot: `shift` is how far the sheet sits above its resting place (px, zero or
 * negative), stepping down a line at a time, or null when it isn't printing.
 * The bottom leaves the slot first, so the text reads upright as it descends
 * and the header lands last. The page is left where it is. Any key, or
 * `finish()`, completes it at once; reduced motion skips it entirely.
 */
export function usePaperFeed(
  sheet: RefObject<HTMLElement | null>,
  active: boolean,
  onDone?: () => void,
): { shift: number | null; finish: () => void } {
  const [shift, setShift] = useState<number | null>(null)
  const done = useRef(onDone)
  const stop = useRef<() => void>(() => {})
  useEffect(() => {
    done.current = onDone
  })

  useEffect(() => {
    const el = sheet.current
    if (!active || !el) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      done.current?.()
      return
    }

    const duration = Math.min(Math.max((el.offsetHeight / FEED_PX_PER_SEC) * 1000, 2000), 5000)
    const start = performance.now()
    let frame = 0
    let settle = 0
    let stopped = false
    let lastFed = -1

    const finish = () => {
      if (stopped) return
      stopped = true
      cancelAnimationFrame(frame)
      clearTimeout(settle)
      window.removeEventListener("keydown", finish)
      setShift(null)
      done.current?.()
    }
    stop.current = finish
    window.addEventListener("keydown", finish)

    const tick = (now: number) => {
      // Measured every frame, not once: a sheet can settle its size after printing starts
      // (the grid fits its hours to the room), and a stale height would hold the paper
      // inside the printer while the head is already moving.
      const height = el.offsetHeight
      const progress = Math.min((now - start) / duration, 1)
      const fed = Math.min(Math.ceil((progress * height) / LINE_PX) * LINE_PX, height)
      // Each line the paper advances is a line the head has just struck.
      if (fed !== lastFed) {
        lastFed = fed
        printLine()
      }
      setShift(fed - height)
      if (progress < 1) frame = requestAnimationFrame(tick)
      else settle = window.setTimeout(finish, 400)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      clearTimeout(settle)
      window.removeEventListener("keydown", finish)
    }
  }, [active, sheet])

  // Still inside the printer from the moment printing is asked for, so the full sheet never flashes first.
  return { shift: shift ?? (active ? -100_000 : null), finish: () => stop.current() }
}
