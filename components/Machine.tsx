import type { ReactNode } from "react"

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
