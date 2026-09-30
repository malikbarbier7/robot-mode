import type { Day } from "./types"

/*
 * How times and weeks are shown. Everything is stored and scheduled in 24-hour
 * minutes with Monday as day 0; these only change what people see and type.
 */

export type Clock = "12h" | "24h"
export type WeekStart = "monday" | "sunday"
export type Period = "am" | "pm"

/** The clock the browser's locale uses: 12h in the US, 24h in most places. */
export function detectClock(locale?: string): Clock {
  try {
    const cycle = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hourCycle
    return cycle === "h11" || cycle === "h12" ? "12h" : "24h"
  } catch {
    return "24h"
  }
}

/** 0–23 → 12, 1–11 with a period. Midnight is 12 AM, noon is 12 PM. */
export function to12(hour24: number): { hour: number; period: Period } {
  return { hour: hour24 % 12 || 12, period: hour24 < 12 ? "am" : "pm" }
}

export function from12(hour: number, period: Period): number {
  return (hour % 12) + (period === "pm" ? 12 : 0)
}

/**
 * Minutes from midnight as a clock reading: "07:30" or "7:30 AM". Wraps past
 * midnight. `compact` drops ":00" in 12h, for axis labels ("8 AM").
 */
export function formatClock(minutes: number, clock: Clock, { compact = false } = {}): string {
  const m = ((minutes % 1440) + 1440) % 1440
  const hour24 = Math.floor(m / 60)
  const minute = String(m % 60).padStart(2, "0")
  if (clock === "24h") return `${String(hour24).padStart(2, "0")}:${minute}`
  const { hour, period } = to12(hour24)
  const suffix = period === "am" ? "AM" : "PM"
  return compact && minute === "00" ? `${hour} ${suffix}` : `${hour}:${minute} ${suffix}`
}

/**
 * Rewrites the 24-hour times inside a sentence the engine wrote ("Gym at
 * 14:00"), so its messages follow the clock setting too.
 */
export function localizeTimes(text: string, clock: Clock): string {
  if (clock === "24h") return text
  return text.replace(/\b([01]\d|2[0-3]):([0-5]\d)\b/g, (_, h: string, m: string) =>
    formatClock(Number(h) * 60 + Number(m), clock),
  )
}

/** A length of time, never mistakable for a clock reading: "1H 15M", "45M", "2H". */
export function formatSpan(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}M`
  return m === 0 ? `${h}H` : `${h}H ${m}M`
}

/** The days in the order a week is shown. Day 0 is always Monday underneath. */
export function weekOrder(start: WeekStart): Day[] {
  return start === "sunday" ? [6, 0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6]
}
