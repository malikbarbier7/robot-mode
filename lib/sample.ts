import type { Activity, Day, PlacedBlock, Schedule, Settings } from "./types"
import { interpret } from "./command"
import { generate } from "./scheduler/generate"
import { suggestFixes } from "./suggest"

/**
 * The week shown on the landing page. Not a drawing: the real engine solves it
 * from these lines when the page is built, so what a visitor sees is what the
 * machine prints.
 */
export const SAMPLE: Settings = {
  seed: 1,
  wakeTime: "07:00",
  sleepTime: "23:00",
  meals: [
    { id: "breakfast", name: "Breakfast", start: "07:30", durationMinutes: 30, enabled: false },
    { id: "lunch", name: "Lunch", start: "12:30", durationMinutes: 45, enabled: true },
    { id: "dinner", name: "Dinner", start: "19:30", durationMinutes: 45, enabled: true },
  ],
  activities: [
    { id: "deep-work", name: "Deep work", durationMinutes: 180, sessionsPerWeek: 5, allowedDays: [0, 1, 2, 3, 4], window: { start: "09:00", end: "12:30" } },
    { id: "gym", name: "Gym", durationMinutes: 75, sessionsPerWeek: 4, window: { start: "17:00", end: "19:30" }, bufferMinutes: 15 },
    { id: "spanish", name: "Spanish", durationMinutes: 30, sessionsPerWeek: 5, window: { start: "13:15", end: "17:00" } },
    { id: "reading", name: "Reading", durationMinutes: 45, sessionsPerWeek: 7, window: { start: "21:00", end: "23:00" } },
    { id: "side-project", name: "Side project", durationMinutes: 120, sessionsPerWeek: 2, allowedDays: [5, 6], window: { start: "10:00", end: "13:00" } },
  ],
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
const FULL_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

/**
 * A short session at the machine's keyboard, on the sample week: lines a
 * visitor might type, each with the machine's answer, read by the real
 * command interpreter. Days and times come from the solved week itself, so
 * every line names a session that is really there.
 */
export function sampleTranscript(settings: Settings, schedule: Schedule): { line: string; reply: string }[] {
  const first = (activityId: string): PlacedBlock | undefined =>
    schedule.blocks.filter((b) => b.activityId === activityId).sort((a, b) => a.day - b.day || a.startMinute - b.startMinute)[0]
  const gym = first("gym")
  const spanish = first("spanish")
  const free = (gym ? ([1, 2, 3, 4, 5, 6, 0].map((d) => ((gym.day + d) % 7) as Day)) : []).find(
    (d) => !schedule.blocks.some((b) => b.activityId === "gym" && b.day === d),
  )
  const lines = [
    "add yoga 45 min twice",
    "gym 3 times a week",
    gym && free !== undefined ? `move gym ${DAYS[gym.day]} to ${DAYS[free]}` : "",
    "lock deep work monday",
    spanish ? `remove spanish ${FULL_DAYS[spanish.day]}` : "",
    "wake 6:30",
    "print",
  ].filter(Boolean)
  const ctx = {
    ...settings,
    sessions: schedule.blocks.map((b) => ({ id: b.id, activityId: b.activityId, day: b.day, start: b.startMinute, end: b.endMinute, locked: b.locked })),
  }
  return lines.map((line) => {
    const action = interpret(line, ctx)
    return { line, reply: action ? (action.kind === "error" ? action.reply : action.preview) : "" }
  })
}

/** A line added to the sample week that cannot fit as asked: the run is pinned before the alarm goes off. */
export const CONFLICT_LINE = "run 45m 3x at 6:30"

export type SampleConflict = { line: string; reply: string; name: string; placed: number; requested: number; why: string; fixes: string[] }

/**
 * What the machine's FIX screen says when the line above is added to the
 * sample week: why it failed, and the ways out the engine has verified by
 * re-solving. Worked out by the real interpreter and engine when the page is
 * built, like the week itself.
 */
export function sampleConflict(settings: Settings): SampleConflict {
  const action = interpret(CONFLICT_LINE, { ...settings, sessions: [] })
  if (action?.kind !== "add") throw new Error(`"${CONFLICT_LINE}" is not an add`)
  const activity: Activity = { id: "run", ...action.activity }
  const withRun = { ...settings, activities: [...settings.activities, activity] }
  const conflict = generate(withRun).unplaced.find((u) => u.activityId === "run")
  if (!conflict) throw new Error(`"${CONFLICT_LINE}" fits the sample week: it no longer shows a conflict`)
  return {
    line: CONFLICT_LINE,
    reply: action.reply,
    name: conflict.name,
    placed: conflict.sessionsPlaced,
    requested: conflict.sessionsRequested,
    why: conflict.why,
    fixes: suggestFixes(withRun, conflict).map((f) => f.label),
  }
}
