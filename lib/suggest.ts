import type { Activity, Meal, Schedule, Settings, Unplaced } from "./types"
import { generate } from "./scheduler/generate"
import { formatTime, parseTime } from "./scheduler/time"
import { formatDuration } from "./duration"
import { mealsOf } from "./meals"

/** Cheap solve for screening candidates; the shortlist is re-checked in full. */
const TRIAL_PASSES = 4

export type SuggestionKind =
  | "move"
  | "move-blocker"
  | "drop-buffer"
  | "unpin"
  | "disable-meal"
  | "wake"
  | "sleep"
  | "free-time"
  | "shorten"
  | "fewer"

export type Suggestion = {
  id: string
  /** What the user reads, e.g. "Move Breakfast to 09:30". */
  label: string
  kind: SuggestionKind
  /** How much it disturbs what was asked for. Lower is better. */
  cost: number
  /** The settings to adopt. Already computed, so applying is just assignment. */
  settings: Settings
}

/**
 * Finds changes that actually resolve a conflict.
 *
 * Rather than reasoning about why something doesn't fit, this tries a short list
 * of small tweaks and re-runs the solver on each. Nothing is ever suggested that
 * has not been shown to work, which is exactly what a clever guess would get
 * wrong. The solver takes about 30ms, so trying two dozen is affordable on demand.
 */
export function suggestFixes(settings: Settings, conflict: Unplaced, limit = 3): Suggestion[] {
  const baseline = missedTotal(generate(settings))

  const viable = buildCandidates(settings, conflict).filter((candidate) => {
    const trial = generate(candidate.settings, { passes: TRIAL_PASSES })
    if (missedFor(trial, conflict.activityId) > 0) return false
    // It must be a net gain: fixing this by breaking something else is not a fix.
    return missedTotal(trial) < baseline
  })

  // One of each kind, so three suggestions are three genuinely different moves
  // rather than the same one at 15, 30 and 45 minutes.
  const byKind = new Map<SuggestionKind, Suggestion>()
  for (const candidate of [...viable].sort((a, b) => a.cost - b.cost)) {
    if (!byKind.has(candidate.kind)) byKind.set(candidate.kind, candidate)
  }

  return [...byKind.values()]
    .sort((a, b) => a.cost - b.cost)
    .slice(0, limit)
    .filter((candidate) => {
      // Confirm at full quality: a screening solve is not what the user will get.
      const full = generate(candidate.settings)
      return missedFor(full, conflict.activityId) === 0 && missedTotal(full) < baseline
    })
}

function missedTotal(schedule: Schedule): number {
  return schedule.unplaced.reduce((n, u) => n + (u.sessionsRequested - u.sessionsPlaced), 0)
}

function missedFor(schedule: Schedule, activityId: string): number {
  const found = schedule.unplaced.find((u) => u.activityId === activityId)
  return found ? found.sessionsRequested - found.sessionsPlaced : 0
}

function shift(time: string, deltaMinutes: number): string {
  return formatTime(parseTime(time) + deltaMinutes)
}

function mealIdOf(activityId: string): string | null {
  return activityId.startsWith("meal-") ? activityId.slice("meal-".length) : null
}

function withActivity(settings: Settings, id: string, patch: Partial<Activity>): Settings {
  return {
    ...settings,
    activities: settings.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  }
}

function withMeal(settings: Settings, id: string, patch: Partial<Meal>): Settings {
  return { ...settings, meals: mealsOf(settings).map((m) => (m.id === id ? { ...m, ...patch } : m)) }
}

function buildCandidates(settings: Settings, conflict: Unplaced): Suggestion[] {
  const out: Suggestion[] = []
  const activity = settings.activities.find((a) => a.id === conflict.activityId)
  const mealId = mealIdOf(conflict.activityId)
  const meal = mealId ? mealsOf(settings).find((m) => m.id === mealId) : undefined

  // Move the thing that did not fit.
  if (activity?.fixedAt) {
    for (const delta of [-60, -45, -30, -15, 15, 30, 45, 60]) {
      const at = shift(activity.fixedAt.start, delta)
      out.push({
        id: `move:${delta}`,
        kind: "move",
        cost: Math.abs(delta) / 15,
        label: `Move ${activity.name} to ${at}`,
        settings: withActivity(settings, activity.id, { fixedAt: { ...activity.fixedAt, start: at } }),
      })
    }
    out.push({
      id: "unpin",
      kind: "unpin",
      cost: 6,
      label: `Let Robot Mode choose when ${activity.name} happens`,
      settings: withActivity(settings, activity.id, { fixedAt: undefined }),
    })
  }

  if (activity?.bufferMinutes) {
    out.push({
      id: "drop-buffer",
      kind: "drop-buffer",
      cost: 3,
      label: `Drop ${activity.name}'s ${activity.bufferMinutes}-minute travel buffer`,
      settings: withActivity(settings, activity.id, { bufferMinutes: undefined }),
    })
  }

  if (meal) {
    for (const delta of [-60, -30, -15, 15, 30, 60]) {
      const at = shift(meal.start, delta)
      out.push({
        id: `move:${delta}`,
        kind: "move",
        cost: Math.abs(delta) / 15,
        label: `Move ${meal.name} to ${at}`,
        settings: withMeal(settings, meal.id, { start: at }),
      })
    }
    out.push({
      id: "disable-meal",
      kind: "disable-meal",
      cost: 7,
      label: `Stop reserving time for ${meal.name}`,
      settings: withMeal(settings, meal.id, { enabled: false }),
    })
  }

  // Move whatever was standing in the way.
  for (const blocker of (conflict.blockedBy ?? []).slice(0, 2)) {
    const blockerMealId = mealIdOf(blocker.activityId)
    const blockerMeal = blockerMealId ? mealsOf(settings).find((m) => m.id === blockerMealId) : undefined
    const blockerActivity = settings.activities.find((a) => a.id === blocker.activityId)

    for (const delta of [-30, -15, 15, 30]) {
      // Slightly dearer than moving your own: it disturbs something already settled.
      const cost = Math.abs(delta) / 15 + 1
      if (blockerMeal) {
        const at = shift(blockerMeal.start, delta)
        out.push({
          id: `blocker:${blockerMeal.id}:${delta}`,
          kind: "move-blocker",
          cost,
          label: `Move ${blockerMeal.name} to ${at}`,
          settings: withMeal(settings, blockerMeal.id, { start: at }),
        })
      } else if (blockerActivity?.fixedAt) {
        const at = shift(blockerActivity.fixedAt.start, delta)
        out.push({
          id: `blocker:${blockerActivity.id}:${delta}`,
          kind: "move-blocker",
          cost,
          label: `Move ${blockerActivity.name} to ${at}`,
          settings: withActivity(settings, blockerActivity.id, {
            fixedAt: { ...blockerActivity.fixedAt, start: at },
          }),
        })
      }
    }
  }

  // Change the shape of the day. Dearer, because it touches every day of the week.
  for (const minutes of [15, 30]) {
    out.push({
      id: `wake:${minutes}`,
      kind: "wake",
      cost: 4 + minutes / 15,
      label: `Wake up at ${shift(settings.wakeTime, -minutes)} instead of ${settings.wakeTime}`,
      settings: { ...settings, wakeTime: shift(settings.wakeTime, -minutes) },
    })
    out.push({
      id: `sleep:${minutes}`,
      kind: "sleep",
      cost: 4 + minutes / 15,
      label: `Go to sleep at ${shift(settings.sleepTime, minutes)} instead of ${settings.sleepTime}`,
      settings: { ...settings, sleepTime: shift(settings.sleepTime, minutes) },
    })
  }

  if (settings.minFreeMinutesPerDay >= 30) {
    for (const minutes of [30, 60]) {
      const next = Math.max(0, settings.minFreeMinutesPerDay - minutes)
      out.push({
        id: `free:${minutes}`,
        kind: "free-time",
        cost: 5 + minutes / 30,
        label: `Keep ${next} min of free time a day instead of ${settings.minFreeMinutesPerDay}`,
        settings: { ...settings, minFreeMinutesPerDay: next },
      })
    }
  }

  // Last resort: change what was actually asked for.
  if (activity) {
    for (const minutes of [15, 30]) {
      const next = activity.durationMinutes - minutes
      if (next < 15) continue
      out.push({
        id: `shorten:${minutes}`,
        kind: "shorten",
        cost: 8 + minutes / 15,
        label: `Make ${activity.name} ${formatDuration(next)} instead of ${formatDuration(activity.durationMinutes)}`,
        settings: withActivity(settings, activity.id, { durationMinutes: next }),
      })
    }
    if (activity.sessionsPerWeek > 1) {
      out.push({
        id: "fewer",
        kind: "fewer",
        cost: 10,
        label: `Do ${activity.name} ${activity.sessionsPerWeek - 1}× a week instead of ${activity.sessionsPerWeek}×`,
        settings: withActivity(settings, activity.id, { sessionsPerWeek: activity.sessionsPerWeek - 1 }),
      })
    }
  }

  return out
}
