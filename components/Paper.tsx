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
  onReplay,
  compact = false,
  children,
}: {
  printer?: { name?: string; spec?: string; width?: string }
  /** Less room around it, and the printer's lower casing. */
  compact?: boolean
  /** The paper's width, as a Tailwind max-width class. */
  width: string
  className: string
  feed?: boolean
  onFed?: () => void
  /** Print it again (the printer's Form feed key). */
  onReplay?: () => void
  children: ReactNode
}) {
  const sheet = useRef<HTMLElement>(null)
  const { shift, finish } = usePaperFeed(sheet, feed, onFed)
  const printing = shift !== null

  return (
    <div className={`px-4 sm:px-6 ${compact ? "py-3" : "py-10"}`}>
      <Printer {...printer} compact={compact} printing={printing} onPrint={() => window.print()} onFormFeed={() => onReplay?.()} />

      {/* While printing, the paper still inside the printer (above the slot) is hidden. */}
      <div
        className={`relative mx-auto ${width} ${printing ? "overflow-hidden" : ""}`}
        onPointerDown={() => printing && finish()}
      >
        <article ref={sheet} style={printing ? { transform: `translateY(${shift}px)` } : undefined} className={className}>
          {children}
        </article>
      </div>
    </div>
  )
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

    const height = el.offsetHeight
    const duration = Math.min(Math.max((height / FEED_PX_PER_SEC) * 1000, 2000), 5000)
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
