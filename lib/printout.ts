import type { PlacedBlock } from "./types"

export type PrintRow =
  | { kind: "wake" | "sleep"; minute: number }
  | { kind: "block"; minute: number; block: PlacedBlock }

/**
 * One day as the printer lists it: wake, then every block in order, then
 * sleep. Free time isn't printed; it is whatever the times leave between.
 * Times are minutes from midnight of that day, so `sleep` may exceed 1440
 * when bedtime is after midnight.
 */
export function dayTimeline(blocks: PlacedBlock[], wake: number, sleep: number): PrintRow[] {
  return [
    { kind: "wake", minute: wake },
    ...[...blocks]
      .sort((a, b) => a.startMinute - b.startMinute)
      .map((block): PrintRow => ({ kind: "block", minute: block.startMinute, block })),
    { kind: "sleep", minute: sleep },
  ]
}

/** ISO 8601 week number, which is what a printed timetable would carry. */
export function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const weekday = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - weekday)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  return { week: Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7), year: d.getUTCFullYear() }
}
