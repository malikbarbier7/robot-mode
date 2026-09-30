import type { PlacedBlock } from "./types"

export type PrintRow =
  | { kind: "wake" | "sleep"; minute: number }
  | { kind: "block"; minute: number; block: PlacedBlock }
  | { kind: "free"; minute: number; minutes: number }

/** Gaps shorter than this are transitions, not free time worth a line. */
const MIN_FREE = 15

/**
 * One day as the printer lists it: wake, then every block in order with the
 * free stretches between them, then sleep. Times are minutes from midnight of
 * that day, so `sleep` may exceed 1440 when bedtime is after midnight.
 */
export function dayTimeline(blocks: PlacedBlock[], wake: number, sleep: number): PrintRow[] {
  const rows: PrintRow[] = [{ kind: "wake", minute: wake }]
  let cursor = wake
  for (const block of [...blocks].sort((a, b) => a.startMinute - b.startMinute)) {
    if (block.startMinute - cursor >= MIN_FREE) {
      rows.push({ kind: "free", minute: cursor, minutes: block.startMinute - cursor })
    }
    rows.push({ kind: "block", minute: block.startMinute, block })
    cursor = Math.max(cursor, block.endMinute)
  }
  if (sleep - cursor >= MIN_FREE) rows.push({ kind: "free", minute: cursor, minutes: sleep - cursor })
  rows.push({ kind: "sleep", minute: sleep })
  return rows
}

/** ISO 8601 week number, which is what a printed timetable would carry. */
export function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const weekday = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - weekday)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  return { week: Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7), year: d.getUTCFullYear() }
}
