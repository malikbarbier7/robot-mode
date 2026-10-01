import type { Day, PlacedBlock } from "./types"

/** A point in the week: which day (0 = Monday) and how far into it, in minutes. */
export type Moment = { day: Day; minute: number }

export function momentOf(date: Date): Moment {
  return { day: ((date.getDay() + 6) % 7) as Day, minute: date.getHours() * 60 + date.getMinutes() }
}

/**
 * Where the day stands right now, as the terminal's NOW / NEXT line reads it.
 * `wake` and `sleep` are minutes from midnight; `sleep` may be past 1440.
 */
export type DayStatus =
  | { kind: "asleep"; next?: PlacedBlock }
  | { kind: "block"; block: PlacedBlock; left: number; next?: PlacedBlock }
  | { kind: "free"; until: number; next?: PlacedBlock }
  | { kind: "done" }

export function dayStatus(blocks: PlacedBlock[], wake: number, sleep: number, now: Moment): DayStatus {
  // Before waking, the minutes after midnight still belong to yesterday's late night.
  const minute = now.minute < wake && sleep > 1440 ? now.minute + 1440 : now.minute
  const today = blocks.filter((b) => b.day === now.day).sort((a, b) => a.startMinute - b.startMinute)
  const next = today.find((b) => b.startMinute > minute)

  if (minute < wake) return { kind: "asleep", ...(next ? { next } : {}) }
  if (minute >= sleep) return { kind: "done" }
  const current = today.find((b) => b.startMinute <= minute && minute < b.endMinute)
  if (current) {
    const after = today.find((b) => b.startMinute >= current.endMinute)
    return { kind: "block", block: current, left: current.endMinute - minute, ...(after ? { next: after } : {}) }
  }
  return { kind: "free", until: next ? next.startMinute : sleep, ...(next ? { next } : {}) }
}

/**
 * The session that has just ended and still wants an answer: did it happen?
 * The latest one today that is over, belongs to an activity (meals aren't
 * asked about) and hasn't been answered.
 */
export function pendingCheck(
  blocks: PlacedBlock[],
  now: Moment,
  activityIds: Set<string>,
  answered: Set<string>,
  /** Minute of today the week was generated at, when that was today: sessions already over by then were never planned. */
  since = -1,
): PlacedBlock | null {
  const over = blocks
    .filter(
      (b) =>
        b.day === now.day &&
        b.endMinute <= now.minute &&
        b.endMinute > since &&
        activityIds.has(b.activityId) &&
        !answered.has(b.id),
    )
    .sort((a, b) => b.endMinute - a.endMinute)
  return over[0] ?? null
}
