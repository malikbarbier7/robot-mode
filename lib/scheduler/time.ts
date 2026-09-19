import type { Day } from "@/lib/types"

export const SLOT_MINUTES = 15
export const SLOTS_PER_DAY = 96
export const DAYS = 7
/** One extra day of tail so blocks may run past Sunday midnight. */
export const GRID_SLOTS = (DAYS + 1) * SLOTS_PER_DAY

export const ALL_DAYS: Day[] = [0, 1, 2, 3, 4, 5, 6]
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

/** "07:30" -> 450 */
export function parseTime(t: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) throw new Error(`Invalid time: "${t}" (expected HH:MM)`)
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) throw new Error(`Invalid time: "${t}"`)
  return h * 60 + min
}

/** 450 -> "07:30". Wraps past 24h. */
export function formatTime(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

/** Slot index within a day, for a time string. */
export function timeToSlot(t: string): number {
  return Math.floor(parseTime(t) / SLOT_MINUTES)
}

/** Durations always round UP to whole slots, so blocks never overlap by a few minutes. */
export function slotsFor(minutes: number): number {
  return Math.max(1, Math.ceil(minutes / SLOT_MINUTES))
}

export type DayWindow = {
  day: Day
  /** Absolute slot index (from Monday 00:00) where waking time starts. */
  startAbs: number
  /** Exclusive. Greater than startAbs; may run into the next day when sleep is past midnight. */
  endAbs: number
}

/**
 * Waking window per day. When sleepTime <= wakeTime the window runs past midnight,
 * so a 02:00 bedtime is a late Monday evening rather than an early Tuesday morning.
 */
export function dayWindows(wakeTime: string, sleepTime: string): DayWindow[] {
  const wake = timeToSlot(wakeTime)
  let sleep = timeToSlot(sleepTime)
  if (sleep <= wake) sleep += SLOTS_PER_DAY
  return ALL_DAYS.map((day) => ({
    day,
    startAbs: day * SLOTS_PER_DAY + wake,
    endAbs: day * SLOTS_PER_DAY + sleep,
  }))
}

export function wakingSlotsPerDay(wakeTime: string, sleepTime: string): number {
  const wake = timeToSlot(wakeTime)
  let sleep = timeToSlot(sleepTime)
  if (sleep <= wake) sleep += SLOTS_PER_DAY
  return sleep - wake
}

/** Absolute slot -> minutes from midnight of `day` (may exceed 1440 past midnight). */
export function absToMinuteOfDay(abs: number, day: Day): number {
  return (abs - day * SLOTS_PER_DAY) * SLOT_MINUTES
}

/** Time of day of an absolute slot, ignoring which day it falls on. */
export function slotOfDay(abs: number): number {
  return ((abs % SLOTS_PER_DAY) + SLOTS_PER_DAY) % SLOTS_PER_DAY
}
