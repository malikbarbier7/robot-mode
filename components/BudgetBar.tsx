import type { BudgetReport } from "@/lib/types"
import { formatHours } from "@/lib/duration"

/**
 * The live time budget. Being over is a fact shown here, not an error dialog
 * thrown after the user presses generate.
 */
export function BudgetBar({ budget }: { budget: BudgetReport }) {
  const allocatable = budget.allocatableMinutesPerWeek
  const ratio = allocatable > 0 ? budget.requestedMinutes / allocatable : 0
  const fill = Math.min(ratio, 1) * 100

  return (
    <div className="flex items-baseline gap-4 px-6 py-3">
      <div className="label shrink-0 text-ink/50">Week budget</div>

      <div className="relative h-3 flex-1 border border-ink/40">
        <div
          className={`absolute inset-y-0 left-0 ${budget.feasible ? "bg-ink" : "hatch"}`}
          style={{ width: `${fill}%` }}
        />
        {/* Tick at every quarter, so the bar reads as a measure, not a progress bar. */}
        {[25, 50, 75].map((t) => (
          <div key={t} className="absolute inset-y-0 w-px bg-ink/25" style={{ left: `${t}%` }} />
        ))}
      </div>

      <div className="shrink-0 font-mono text-[11px] tabular-nums">
        {formatHours(budget.requestedMinutes)} / {formatHours(allocatable)}
      </div>

      {!budget.feasible && (
        <div className="shrink-0 font-mono text-[11px]">
          <span className="border-b-2 border-ink">Over by {formatHours(budget.overByMinutes)}</span>
          {budget.suggestion && <span className="text-ink/60"> — cut {budget.suggestion.name}</span>}
        </div>
      )}
    </div>
  )
}
