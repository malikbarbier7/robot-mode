/** 0 = Monday ... 6 = Sunday */
export type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type Priority = "critical" | "high" | "medium" | "low"

export type Activity = {
  id: string
  name: string
  /** Length of ONE session. Rounded up to a 15-minute multiple by the engine. */
  durationMinutes: number
  sessionsPerWeek: number
  priority: Priority

  /** Defaults to every day. */
  allowedDays?: Day[]
  /** Soft preference, e.g. { start: "18:00", end: "23:00" }. May cross midnight. */
  window?: { start: string; end: string }
  /** Travel / transition time, reserved on both sides. Clipped at day edges. */
  bufferMinutes?: number
  /**
   * Anchors every session of this activity to the same clock time.
   * `days` narrows which days it may land on (defaults to `allowedDays`).
   *   Doctor, once:   { start: "14:00", days: [2] }  + sessionsPerWeek: 1
   *   Breakfast daily: { start: "08:00" }            + sessionsPerWeek: 7
   */
  fixedAt?: { start: string; days?: Day[] }
  /**
   * Set on a one-off extra session of another activity (its id): same name,
   * its own length, days and time. Shown with that activity, removed with it.
   */
  extraOf?: string
}

/**
 * A recurring meal. Not an activity: meals are part of the shape of a day, not
 * something you'd list under "what do you want to do".
 */
export type Meal = {
  id: string
  name: string
  /** HH:MM, the same time every day. */
  start: string
  durationMinutes: number
  enabled: boolean
}

export type Settings = {
  wakeTime: string
  sleepTime: string
  activities: Activity[]
  meals?: Meal[]
  /** Unscheduled time protected on every day. */
  minFreeMinutesPerDay: number
  seed: number
}

export type PlacedBlock = {
  /** Stable across regenerations: `${activityId}#${sessionIndex}`. Used for ICS UIDs. */
  id: string
  activityId: string
  name: string
  priority: Priority
  day: Day
  /** Minutes from midnight of `day`. May exceed 1440 when the block runs past midnight. */
  startMinute: number
  endMinute: number
  locked: boolean
  /** Why the engine put it here. */
  reason: string
}

/** Something already placed that stood where an activity needed to go. */
export type Blocker = {
  activityId: string
  name: string
  startMinute: number
}

export type Unplaced = {
  activityId: string
  name: string
  sessionsRequested: number
  sessionsPlaced: number
  /** One line saying what went wrong, in the user's terms. */
  why: string
  /** The blocks that were sitting in the way, when the engine can name them. */
  blockedBy?: Blocker[]
}

export type BudgetReport = {
  wakingMinutesPerWeek: number
  /** Waking time minus protected free time. */
  allocatableMinutesPerWeek: number
  /** What the activity list asks for, including buffers. */
  requestedMinutes: number
  overByMinutes: number
  feasible: boolean
  /** The cheapest thing to cut, when over budget. */
  suggestion?: { activityId: string; name: string; minutes: number }
}

export type Schedule = {
  blocks: PlacedBlock[]
  unplaced: Unplaced[]
  /** Lower is better. Only comparable between runs of the same settings. */
  score: number
  budget: BudgetReport
}
