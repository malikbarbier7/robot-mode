import type { Settings } from "@/lib/types"

/** A week that should schedule cleanly with room to spare. */
export const comfortableWeek: Settings = {
  wakeTime: "07:30",
  sleepTime: "23:30",
  seed: 42,
  activities: [
    { id: "breakfast", name: "Breakfast", durationMinutes: 30, sessionsPerWeek: 7, fixedAt: { start: "08:00" } },
    { id: "lunch", name: "Lunch", durationMinutes: 60, sessionsPerWeek: 7, fixedAt: { start: "13:00" } },
    { id: "dinner", name: "Dinner", durationMinutes: 60, sessionsPerWeek: 7, fixedAt: { start: "19:30" } },
    { id: "work", name: "Work", durationMinutes: 120, sessionsPerWeek: 10, allowedDays: [0, 1, 2, 3, 4] },
    { id: "gym", name: "Gym", durationMinutes: 75, sessionsPerWeek: 4, allowedDays: [0, 1, 3, 4], window: { start: "16:00", end: "19:00" }, bufferMinutes: 15 },
    { id: "language", name: "Language", durationMinutes: 60, sessionsPerWeek: 5, allowedDays: [0, 1, 2, 3, 4], window: { start: "08:30", end: "12:30" } },
    { id: "reading", name: "Reading", durationMinutes: 120, sessionsPerWeek: 7, window: { start: "20:30", end: "23:30" } },
  ],
}

/** Nearly full: should still place everything, but with little slack. */
export const tightWeek: Settings = {
  ...comfortableWeek,
  activities: [
    ...comfortableWeek.activities,
    { id: "study", name: "Class study", durationMinutes: 60, sessionsPerWeek: 5, allowedDays: [0, 1, 2, 3, 4] },
    { id: "leisure", name: "Leisure", durationMinutes: 60, sessionsPerWeek: 7 },
  ],
}

/** The §7 example: far more hours than the week contains. */
export const impossibleWeek: Settings = {
  wakeTime: "08:00",
  sleepTime: "00:00",
  seed: 42,
  activities: [
    { id: "work", name: "Work", durationMinutes: 240, sessionsPerWeek: 14 },
    { id: "reading", name: "Reading", durationMinutes: 120, sessionsPerWeek: 7 },
    { id: "language", name: "Language", durationMinutes: 120, sessionsPerWeek: 7 },
    { id: "study", name: "Class study", durationMinutes: 120, sessionsPerWeek: 7 },
    { id: "gym", name: "Gym", durationMinutes: 120, sessionsPerWeek: 7 },
    { id: "extra", name: "Extra leisure", durationMinutes: 180, sessionsPerWeek: 7 },
  ],
}

/** Gym is only legal on four days, and wants exactly four sessions. */
export const gymRestrictedWeek: Settings = {
  wakeTime: "07:00",
  sleepTime: "23:00",
  seed: 7,
  activities: [
    { id: "gym", name: "Gym", durationMinutes: 75, sessionsPerWeek: 4, allowedDays: [0, 1, 3, 4], window: { start: "17:00", end: "20:00" }, bufferMinutes: 30 },
    { id: "work", name: "Work", durationMinutes: 180, sessionsPerWeek: 5, allowedDays: [0, 1, 2, 3, 4] },
  ],
}

/** A late-night schedule: bedtime past midnight. */
export const nightOwlWeek: Settings = {
  wakeTime: "10:00",
  sleepTime: "02:00",
  seed: 3,
  activities: [
    { id: "work", name: "Work", durationMinutes: 180, sessionsPerWeek: 5, allowedDays: [0, 1, 2, 3, 4] },
    { id: "winddown", name: "Wind down", durationMinutes: 90, sessionsPerWeek: 7, fixedAt: { start: "23:00" } },
    // Its window opens at 23:00, but wind-down holds 23:00-00:30, so this must land after midnight.
    { id: "reading", name: "Reading", durationMinutes: 60, sessionsPerWeek: 7, window: { start: "23:00", end: "01:30" } },
  ],
}
