"use client"

import { useWords } from "@/lib/words"
import { Lamp } from "./Machine"

const VENTS = 22
const SPROCKETS = 3

/**
 * The line printer the week comes out of, drawn in the panel's machined
 * style: a lid with vents and a nameplate, a window onto the print head and
 * its rail, the control panel's lamps and keys, platen knobs either side and
 * a slot with tractor sprockets where the paper leaves.
 */
export function Printer({
  printing,
  name,
  spec,
  width = "max-w-[760px]",
  compact = false,
}: {
  printing: boolean
  /** The nameplate on the lid, and the spec plate beside it: which output unit this is. */
  name?: string
  spec?: string
  /** The casing's width, as a Tailwind max-width class, so it suits its paper. */
  width?: string
  /** A lower casing, for output that needs the room (the plotter's full-week chart). */
  compact?: boolean
}) {
  const words = useWords()
  return (
    <div className={`relative z-10 mx-auto ${width} no-print`}>
      <Knob side="left" compact={compact} />
      <Knob side="right" compact={compact} />

      {/* Lid: nameplate, vents, spec plate. */}
      <div className={`flex items-center justify-between gap-4 border border-black bg-[#2a2620] px-5 ${compact ? "py-1" : "py-2"}`}>
        <span className="label border border-paper/40 px-2 py-0.5 text-paper/85">{name ?? words.printers.line.name}</span>
        <span aria-hidden className="hidden flex-1 justify-center gap-[3px] sm:flex">
          {Array.from({ length: VENTS }, (_, i) => (
            <span key={i} className="h-3 w-[3px] bg-black/80" />
          ))}
        </span>
        <span className="label hidden text-paper/45 sm:inline">{spec ?? words.printers.line.spec}</span>
      </div>

      {/* Body: the head's window, then the lamps. Its keys are the terminal's PRINT and EXPORT; a phone shows neither. */}
      <div className={`hidden flex-wrap items-center sm:flex gap-x-5 gap-y-3 border-x border-black bg-[#c9c1ad] px-5 ${compact ? "py-1.5" : "py-3"}`}>
        <div aria-hidden className={`relative ${compact ? "h-7" : "h-11"} hidden min-w-[200px] flex-1 overflow-hidden border-2 border-black bg-screen sm:block`}>
          {/* Rail and ribbon the head rides along. */}
          <span className="absolute inset-x-2 top-1/2 h-px bg-phosphor/30" />
          <span className="absolute inset-x-2 bottom-2 h-[3px] bg-black" />
          <span
            className={`absolute top-1 bottom-1 w-12 border border-black bg-[#3a342b] ${printing ? "carriage" : "left-2"}`}
          >
            <span
              className={`absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 ${
                printing ? "bg-phosphor" : "bg-phosphor/30"
              }`}
              style={printing ? { filter: "drop-shadow(0 0 4px #ffb238)" } : undefined}
            />
          </span>
        </div>

        <div className={compact ? "flex gap-3" : "space-y-1"}>
          <Indicator label="Power" on />
          <Indicator label="On line" on={printing} blink={printing} />
          <Indicator label="Paper" on />
        </div>
      </div>

      {/* The slot, with the tractor feed's sprockets where the paper's holes run. */}
      <div className={`relative ${compact ? "h-3.5" : "h-5"} border border-black bg-[#2a2620]`}>
        <span className="absolute inset-x-[34px] top-1/2 h-2 -translate-y-1/2 bg-black" />
        <Sprockets className="left-[42px]" />
        <Sprockets className="right-[42px]" />
      </div>
    </div>
  )
}

function Indicator({ label, on, blink = false }: { label: string; on: boolean; blink?: boolean }) {
  return (
    <div className={`label flex items-center gap-2 text-[9px] ${on ? "text-ink" : "text-ink/40"}`}>
      <Lamp on={on} blink={blink} />
      {label}
    </div>
  )
}

/** A platen knob: a gripped block standing proud of the casing. */
function Knob({ side, compact }: { side: "left" | "right"; compact: boolean }) {
  return (
    <span
      aria-hidden
      className={`absolute hidden w-4 border border-black sm:block ${compact ? "top-[30px] h-9" : "top-[46px] h-14"} ${side === "left" ? "-left-4" : "-right-4"}`}
      style={{
        background: "repeating-linear-gradient(to bottom, #1b1914 0 3px, #3a342b 3px 5px)",
      }}
    />
  )
}

function Sprockets({ className }: { className: string }) {
  return (
    <span aria-hidden className={`absolute top-1/2 flex -translate-y-1/2 gap-1 ${className}`}>
      {Array.from({ length: SPROCKETS }, (_, i) => (
        <span key={i} className="h-1.5 w-1.5 bg-[#5a5244]" />
      ))}
    </span>
  )
}
