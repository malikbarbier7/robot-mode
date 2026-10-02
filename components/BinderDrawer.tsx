"use client"

import { useWords } from "@/lib/words"
import { useEffect, useRef, useState } from "react"
import type { ArchivedWeek } from "@/lib/storage"
import { formatHours } from "@/lib/duration"
import { drawer as drawerSound, rustle, shred as shredSound } from "@/lib/sound"

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
/** How far a sheet must be drawn out before letting go takes it out. */
const PULL_OUT_AT = 70

/**
 * The binder, kept against the right edge of the screen like a steel filing
 * unit beside the desk: only its stencilled spine shows. Bring the pointer to
 * the edge and it runs out on its rails; leave it and it slides back. Torn-off
 * weeks land in it, newest on top, each sheet's tab sticking out towards the
 * desk. Draw a sheet out (pull it to the left, or click it) to read it full size.
 *
 * `pinned` keeps it open (opened from the terminal), and then ↑ ↓ pick a sheet
 * and Enter draws it out. `receiving` holds it open while a sheet is filed.
 */
export function BinderDrawer({
  weeks,
  pinned,
  receiving,
  openId,
  onPin,
  onPull,
  onShred,
}: {
  weeks: ArchivedWeek[]
  pinned: boolean
  receiving: boolean
  /** The filed sheet currently drawn out, if any: its place in the stack shows empty. */
  openId: string | null
  onPin: (pinned: boolean) => void
  onPull: (id: string) => void
  /** Shred a filed week, for good. */
  onShred: (id: string) => void
}) {
  const words = useWords()
  const [hover, setHover] = useState(false)
  // A sheet in hand: the unit stays open while it is carried, even outside it.
  const [carrying, setCarrying] = useState(false)
  // The shredder's slot: lit while a sheet hangs over it, chattering while it eats one.
  const [hot, setHot] = useState(false)
  const [eating, setEating] = useState(false)
  const open = hover || pinned || receiving || carrying
  const list = useRef<HTMLOListElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const slot = useRef<HTMLDivElement>(null)

  // The rails, heard each way.
  const wasOpen = useRef(open)
  useEffect(() => {
    if (open !== wasOpen.current) drawerSound(!open)
    wasOpen.current = open
  }, [open])

  // Opened from the terminal: the keyboard goes to the top sheet; Esc slides it back.
  useEffect(() => {
    if (!pinned) return
    list.current?.querySelector<HTMLElement>("[data-sheet]")?.focus()
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onPin(false)
    }
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [pinned, onPin])

  const feed = (id: string) => {
    shredSound()
    setEating(true)
    window.setTimeout(() => setEating(false), 800)
    onShred(id)
  }

  const pull = (id: string) => {
    rustle()
    setHover(false)
    onPin(false)
    onPull(id)
  }

  return (
    <div
      ref={frame}
      className="absolute inset-y-0 right-0 z-30 flex flex-row-reverse no-print"
      style={{
        transform: open ? "translateX(0)" : "translateX(calc(100% - 22px))",
        // A heavy drawer: it starts slowly and settles, rather than snapping.
        transition: "transform 380ms cubic-bezier(0.3, 0.05, 0.2, 1)",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* The unit: brushed steel, a stencilled plate, the rings, the stack. */}
      <div
        className="flex w-[320px] flex-col border-y-2 border-black text-paper"
        style={{
          background:
            "repeating-linear-gradient(90deg, rgb(255 255 255 / 0.025) 0 1px, transparent 1px 3px), linear-gradient(180deg, #4a4a3c, #34342a)",
        }}
      >
        <div className="m-3 border-2 border-paper/60 px-3 py-2">
          <div className="flex items-baseline justify-between">
            <span className="font-logo text-[22px] tracking-[0.3em] uppercase">{words.binder.title}</span>
            <span className="label text-paper/60">{words.binder.subtitle}</span>
          </div>
          <div className="label mt-1 flex justify-between text-paper/55">
            <span>{words.binder.unit}</span>
            <span>{weeks.length === 1 ? "1 sheet" : `${weeks.length} sheets`}</span>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {/* The steel rod every sheet is threaded on, through the punched holes down its right edge. */}
          {weeks.length > 0 && (
            <div aria-hidden className="pointer-events-none absolute bottom-3 right-[47px] top-1 z-10 flex w-[6px] flex-col items-center">
              <span className="-mx-1 h-2 w-3.5 border border-black bg-[#8a8474]" />
              <span
                className="w-full flex-1 border-x border-black"
                style={{ background: "linear-gradient(90deg, #6e6a5c, #d4cdb9 45%, #7c7768)" }}
              />
              <span className="-mx-1 h-2 w-3.5 border border-black bg-[#8a8474]" />
            </div>
          )}

          {weeks.length === 0 ? (
            <p className="label mt-6 pr-10 leading-relaxed text-paper/60">
              {words.binder.empty}
            </p>
          ) : (
            <ol ref={list} className="mt-2 space-y-1.5 pr-6">
              {/* Two sections on the one rod, each behind its divider: the grids, then the lists. */}
              {SECTIONS.map((section) => {
                const sheets = weeks.filter((w) => (w.format ?? "grid") === section.format)
                if (!sheets.length) return null
                return [
                  <Divider key={`divider-${section.format}`} label={section.label} count={sheets.length} color={section.color} />,
                  ...sheets.map((w) => (
                    <FiledSheet
                      key={w.id}
                      week={w}
                      // The sheet just torn off slides in on top of its section.
                      fresh={receiving && w.id === weeks[0].id}
                      out={w.id === openId}
                      onPull={() => pull(w.id)}
                      onShred={() => feed(w.id)}
                      frame={frame}
                      slot={slot}
                      onCarry={setCarrying}
                      onHot={setHot}
                    />
                  )),
                ]
              })}
            </ol>
          )}
        </div>

        {/* The shredder at the foot of the unit: drop a sheet in the slot and it is gone for good. */}
        <div className="m-3 mt-0 border-2 border-black bg-[#2a2620] px-3 pb-2 pt-1.5">
          <div className="label flex items-baseline justify-between text-paper/60">
            <span className="font-logo text-[13px] tracking-[0.25em] text-paper/80 uppercase">{words.binder.shredder}</span>
            <span>{eating ? words.binder.shredding : hot ? words.binder.release : words.binder.drop}</span>
          </div>
          <div
            ref={slot}
            className={`relative mt-1.5 h-4 border-2 ${hot ? "border-phosphor bg-phosphor/25" : "border-black bg-black"}`}
            style={hot ? { filter: "drop-shadow(0 0 6px #ffb238)" } : undefined}
          >
            {/* The cutters' teeth along the slot. */}
            <span
              aria-hidden
              className="absolute inset-x-1 top-1/2 h-[2px] -translate-y-1/2"
              style={{ background: "repeating-linear-gradient(90deg, #6e6a5c 0 3px, transparent 3px 6px)" }}
            />
          </div>
          {/* Strips of what went in, falling from under the slot. */}
          {eating && (
            <div aria-hidden className="relative h-6 overflow-hidden">
              {Array.from({ length: 12 }, (_, i) => (
                <span
                  key={i}
                  className="shred-strip absolute top-0 h-6 w-[5px] bg-sheet"
                  style={{ left: `${8 + i * 8}%`, animationDelay: `${(i % 4) * 60}ms` }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* The spine: all that shows when it is shut. */}
      <button
        type="button"
        onClick={() => onPin(!pinned)}
        title={open ? "Slide the binder back" : "Open the binder of past weeks"}
        className="flex w-[22px] flex-col items-center justify-center gap-3 border-y-2 border-l-2 border-black bg-[#2a2620] text-paper/70 hover:text-paper"
      >
        <span aria-hidden className="h-8 w-[3px] bg-black/70" />
        <span className="label whitespace-nowrap [writing-mode:vertical-rl]">
          {words.binder.spine} · {weeks.length}
        </span>
        <span aria-hidden className="h-8 w-[3px] bg-black/70" />
      </button>
    </div>
  )
}

/** The binder's sections, in the order they sit on the rod. */
const SECTIONS: { format: "grid" | "list"; label: string; color: string }[] = [
  { format: "grid", label: "▦ Grids", color: "#9fb0b4" },
  { format: "list", label: "≡ Lists", color: "#d8c48e" },
]

/**
 * A cardboard divider on the rod: a stiff coloured board, punched like the
 * sheets, with a tab that stands further out than theirs.
 */
function Divider({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <li aria-label={`${label}: ${count}`} className="pt-1">
      <div
        className="relative flex h-8 items-center border-2 border-ink text-ink"
        style={{
          backgroundColor: color,
          // The board's punched holes, under the rod.
          backgroundImage: "radial-gradient(circle, #1b1914 0 3.5px, transparent 4px)",
          backgroundSize: "28px 16px",
          backgroundPosition: "right 0 center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <span
          className="-ml-5 flex h-[calc(100%+4px)] items-center border-2 border-r-0 border-ink px-2 font-mono text-[11px] uppercase tracking-[0.14em]"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
        <span className="ml-auto pr-10 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/60">
          {count === 1 ? "1 sheet" : `${count} sheets`}
        </span>
      </div>
    </li>
  )
}

/**
 * One filed week: a strip of the sheet's edge with its tab. Carried to the
 * left it comes out; into the shredder it is gone; anywhere else it goes back.
 */
function FiledSheet({
  week,
  fresh,
  out,
  onPull,
  onShred,
  frame,
  slot,
  onCarry,
  onHot,
}: {
  week: ArchivedWeek
  fresh: boolean
  out: boolean
  onPull: () => void
  onShred: () => void
  /** The unit, which a carried sheet is placed against. */
  frame: React.RefObject<HTMLDivElement | null>
  /** The shredder's slot, which a carried sheet can be dropped into. */
  slot: React.RefObject<HTMLDivElement | null>
  onCarry: (carrying: boolean) => void
  onHot: (hot: boolean) => void
}) {
  // While carried: where it was picked up from, and how far it has moved.
  const [carry, setCarry] = useState<{ left: number; top: number; width: number; height: number; x: number; y: number } | null>(null)
  const { armed, press } = useArmed(onShred)
  const moved = useRef(false)
  const filedAt = new Date(week.filedAt)
  const planned = week.blocks.reduce((sum, b) => sum + b.endMinute - b.startMinute, 0)

  /**
   * Picked up, the sheet follows the pointer anywhere. Let go: in the
   * shredder's slot it is shredded; well to the left of the binder it comes
   * out to be read; anywhere else it goes back on the rod.
   */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const startX = e.clientX
    const startY = e.clientY
    const own = e.currentTarget.getBoundingClientRect()
    const unit = frame.current?.getBoundingClientRect()
    let over = false
    let x = 0
    moved.current = false
    const overSlot = (ev: PointerEvent) => {
      const r = slot.current?.getBoundingClientRect()
      // A little generous: dropping just above the slot counts too.
      return !!r && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top - 40 && ev.clientY <= r.bottom + 12
    }
    const move = (ev: PointerEvent) => {
      x = ev.clientX - startX
      const y = ev.clientY - startY
      if (!moved.current && Math.hypot(x, y) < 6) return
      if (!moved.current) {
        document.body.style.userSelect = "none"
        window.getSelection()?.removeAllRanges()
        onCarry(true)
      }
      moved.current = true
      // Placed against the unit (it is transformed, so fixed positions are its own).
      setCarry({
        left: own.left - (unit?.left ?? 0),
        top: own.top - (unit?.top ?? 0),
        width: own.width,
        height: own.height,
        x,
        y,
      })
      const now = overSlot(ev)
      if (now !== over) onHot((over = now))
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
      document.body.style.userSelect = ""
      setCarry(null)
      onCarry(false)
      onHot(false)
      if (!moved.current) return
      if (over) onShred()
      else if (-x >= PULL_OUT_AT) onPull()
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
  }

  return (
    // Its place on the rod stays held while it is carried.
    <li style={carry ? { height: carry.height } : undefined}>
      <button
        type="button"
        data-sheet
        onPointerDown={onPointerDown}
        onClick={(e) => {
          if (moved.current) {
            moved.current = false
            e.preventDefault()
            return
          }
          onPull()
        }}
        onKeyDown={(e) => {
          // Delete twice shreds it.
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault()
            press()
          }
          // ↑ ↓ through the stack, Enter draws the sheet out.
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault()
            const sheets = [...(e.currentTarget.closest("ol")?.querySelectorAll<HTMLElement>("[data-sheet]") ?? [])]
            sheets[sheets.indexOf(e.currentTarget) + (e.key === "ArrowDown" ? 1 : -1)]?.focus()
          }
        }}
        title="Pull it out to the left to read it, or drop it in the shredder below"
        style={
          carry
            ? {
                position: "fixed",
                left: carry.left,
                top: carry.top,
                width: carry.width,
                zIndex: 50,
                transform: `translate(${carry.x}px, ${carry.y}px) rotate(${carry.x / 70}deg)`,
              }
            : { transition: "transform 220ms cubic-bezier(0.3, 0.05, 0.2, 1)" }
        }
        className={`sheet group relative flex w-full items-stretch text-left font-mono uppercase text-ink outline-none focus-visible:ring-2 focus-visible:ring-phosphor ${
          out ? "opacity-35" : "hover:-translate-x-1"
        } ${fresh ? "file-in" : ""}`}
      >
        {/* The divider tab, sticking out past the stack towards the desk. */}
        <span className="-ml-3 flex w-12 items-center justify-center border-2 border-r-0 border-ink bg-[#e8dfb8] text-[11px] tracking-[0.08em]">
          W{String(week.week).padStart(2, "0")}
        </span>
        <span className="relative flex-1 py-2 pl-2 pr-8">
          {/* Shred: once arms it, twice shreds it. */}
          <span
            role="button"
            tabIndex={-1}
            aria-label={armed ? `Confirm: shred week ${week.week}` : `Shred week ${week.week}`}
            title={armed ? "Press again to shred it for good" : "Shred this week (press twice)"}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              press()
            }}
            className={`absolute right-7 top-1 px-1 text-[10px] tracking-[0.12em] ${
              armed ? "bg-alert text-sheet" : "text-ink/40 opacity-0 hover:text-ink group-hover:opacity-100 group-focus-visible:opacity-100"
            }`}
          >
            {armed ? "SHRED?" : "✕"}
          </span>
          <span className="block text-[12px] tracking-[0.18em]">
            Week {week.week} / {week.year}
          </span>
          <span className="block text-[10px] tracking-[0.12em] text-ink/55">
            {/* Which kind it is, the divider above it says. */}
            Filed {String(filedAt.getDate()).padStart(2, "0")} {MONTHS[filedAt.getMonth()]} · {formatHours(planned)}
          </span>
        </span>
      </button>
    </li>
  )
}

/**
 * A destructive key that asks twice: the first press arms it (and says so),
 * the second within a few seconds goes through; left alone it disarms.
 */
export function useArmed(action: () => void, timeout = 3000) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const id = window.setTimeout(() => setArmed(false), timeout)
    return () => window.clearTimeout(id)
  }, [armed, timeout])
  const press = () => {
    if (armed) {
      setArmed(false)
      action()
    } else setArmed(true)
  }
  return { armed, press }
}
