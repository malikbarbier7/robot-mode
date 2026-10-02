import type { PlacedBlock, Settings } from "./types"
import type { PrintedWeek } from "./storage"

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

/** "2026-10-02": which day a ticket belongs to, in local time. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** "2026-W40": which week a sheet belongs to. */
export function weekKey(date: Date): string {
  const { week, year } = isoWeek(date)
  return `${year}-W${String(week).padStart(2, "0")}`
}

/** Whether the paper already shows this week: the same hours, and every session in the same place. */
export function samePrint(printed: PrintedWeek | null | undefined, settings: Pick<Settings, "wakeTime" | "sleepTime">, blocks: PlacedBlock[]): boolean {
  if (!printed) return false
  if (printed.wakeTime !== settings.wakeTime || printed.sleepTime !== settings.sleepTime) return false
  if (printed.blocks.length !== blocks.length) return false
  const key = (b: PlacedBlock) => `${b.id}|${b.name}|${b.day}|${b.startMinute}|${b.endMinute}|${b.locked}`
  const onPaper = new Set(printed.blocks.map(key))
  return blocks.every((b) => onPaper.has(key(b)))
}
export type { PlacedBlock }
