/**
 * Accepts "1h15", "1h", "90", "45m", "1:30", "2". Returns minutes, or null.
 *
 * A bare number under 10 is hours: nobody means a 2-minute session, and the
 * engine rounds anything under 15 minutes up to a slot anyway. Write "5m" for
 * five minutes.
 */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, "")
  if (!s) return null

  let m = /^(\d+)h(\d+)?$/.exec(s)
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0)

  m = /^(\d+):(\d{1,2})$/.exec(s)
  if (m) return Number(m[1]) * 60 + Number(m[2])

  m = /^(\d+)m$/.exec(s)
  if (m) return Number(m[1])

  m = /^(\d+)$/.exec(s)
  if (m) return Number(m[1]) < 10 ? Number(m[1]) * 60 : Number(m[1])

  return null
}

/** 75 -> "1h15", 60 -> "1h", 30 -> "30m" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, "0")}`
}

/** 930 -> "15h30" for budget readouts. */
export function formatHours(minutes: number): string {
  const h = Math.round((minutes / 60) * 10) / 10
  return Number.isInteger(h) ? `${h}h` : `${h}h`
}
