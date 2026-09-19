import type { BudgetReport, Priority, Settings } from "@/lib/types"
import { DAYS, SLOT_MINUTES, slotsFor, wakingSlotsPerDay } from "./time"

const PRIORITY_RANK: Record<Priority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

/** Minutes one session actually consumes, including both buffers. */
export function sessionCost(durationMinutes: number, bufferMinutes = 0): number {
  return slotsFor(durationMinutes) * SLOT_MINUTES + 2 * slotsFor(bufferMinutes || 0) * (bufferMinutes ? SLOT_MINUTES : 0)
}

/** Minutes an activity asks for across the whole week. */
export function activityCost(durationMinutes: number, sessionsPerWeek: number, bufferMinutes = 0): number {
  return sessionCost(durationMinutes, bufferMinutes) * sessionsPerWeek
}

/**
 * The live time budget. Computed without running the solver, so it can update
 * on every keystroke — this is what replaces a post-generate "impossible" error.
 */
export function computeBudget(settings: Settings): BudgetReport {
  const wakingPerDay = wakingSlotsPerDay(settings.wakeTime, settings.sleepTime) * SLOT_MINUTES
  const wakingMinutesPerWeek = wakingPerDay * DAYS
  const protectedFree = Math.max(0, settings.minFreeMinutesPerDay) * DAYS
  const allocatableMinutesPerWeek = Math.max(0, wakingMinutesPerWeek - protectedFree)

  let requestedMinutes = 0
  for (const a of settings.activities) {
    requestedMinutes += activityCost(a.durationMinutes, a.sessionsPerWeek, a.bufferMinutes)
  }

  const overByMinutes = Math.max(0, requestedMinutes - allocatableMinutesPerWeek)

  let suggestion: BudgetReport["suggestion"]
  if (overByMinutes > 0) {
    // The cheapest thing to cut: lowest priority tier present, biggest consumer within it.
    const ranked = settings.activities
      .filter((a) => a.sessionsPerWeek > 0 && a.durationMinutes > 0)
      .map((a) => ({
        activityId: a.id,
        name: a.name,
        minutes: activityCost(a.durationMinutes, a.sessionsPerWeek, a.bufferMinutes),
        rank: PRIORITY_RANK[a.priority],
      }))
      .sort((x, y) => x.rank - y.rank || y.minutes - x.minutes)
    if (ranked.length > 0) {
      const { activityId, name, minutes } = ranked[0]
      suggestion = { activityId, name, minutes }
    }
  }

  return {
    wakingMinutesPerWeek,
    allocatableMinutesPerWeek,
    requestedMinutes,
    overByMinutes,
    feasible: overByMinutes === 0,
    suggestion,
  }
}
