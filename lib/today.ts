import type { Day } from "./types"

/** A point in the week: which day (0 = Monday) and how far into it, in minutes. */
export type Moment = { day: Day; minute: number }

export function momentOf(date: Date): Moment {
  return { day: ((date.getDay() + 6) % 7) as Day, minute: date.getHours() * 60 + date.getMinutes() }
}
