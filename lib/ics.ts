import type { PlacedBlock } from "./types"

const PRODID = "-//Robot Mode//Weekly Schedule//EN"

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** Floating local time: "20260921T083000". Calendars read it in the viewer's zone. */
function localStamp(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
}

function utcStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes(),
  )}${pad(d.getUTCSeconds())}Z`
}

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
}

/** RFC 5545 caps content lines at 75 octets. */
function fold(line: string): string {
  if (line.length <= 73) return line
  const parts = [line.slice(0, 73)]
  for (let i = 73; i < line.length; i += 72) parts.push(` ${line.slice(i, i + 72)}`)
  return parts.join("\r\n")
}

/** Monday of the week containing `date`, at local midnight. */
export function mondayOf(date: Date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

/**
 * The Monday the exported week lands on. Midweek that is this week, so the
 * days left still count; from Saturday on, what's left is a weekend and the
 * week being planned is the one coming, so it is next Monday.
 */
export function exportWeekStart(now: Date = new Date()): Date {
  const monday = mondayOf(now)
  if (now.getDay() === 6 || now.getDay() === 0) monday.setDate(monday.getDate() + 7)
  return monday
}

/**
 * The UID must be stable across regenerations, so re-importing REPLACES events
 * instead of duplicating them. A second export that piles 60 more events into
 * someone's calendar is how you lose a user permanently.
 */
function uidFor(block: PlacedBlock): string {
  return `${block.id.replace(/[^a-zA-Z0-9-]/g, "-")}@robot-mode`
}

export type IcsOptions = {
  /** Incremented on every export so calendar clients accept the update. */
  sequence: number
  weekStart?: Date
  calendarName?: string
  now?: Date
}

export function buildIcs(blocks: PlacedBlock[], options: IcsOptions): string {
  const weekStart = options.weekStart ?? exportWeekStart(options.now)
  const dtstamp = utcStamp(options.now ?? new Date())
  const name = options.calendarName ?? "Robot Mode"

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    // Lands as one named calendar the user can delete in a single click.
    `X-WR-CALNAME:${escapeText(name)}`,
  ]

  for (const block of blocks) {
    const start = new Date(weekStart)
    start.setDate(start.getDate() + block.day)
    start.setMinutes(start.getMinutes() + block.startMinute)

    const end = new Date(weekStart)
    end.setDate(end.getDate() + block.day)
    end.setMinutes(end.getMinutes() + block.endMinute)

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uidFor(block)}`,
      `DTSTAMP:${dtstamp}`,
      `SEQUENCE:${options.sequence}`,
      `DTSTART:${localStamp(start)}`,
      `DTEND:${localStamp(end)}`,
      fold(`SUMMARY:${escapeText(block.name)}`),
      fold(`DESCRIPTION:${escapeText(block.reason)}`),
      "END:VEVENT",
    )
  }

  lines.push("END:VCALENDAR")
  return `${lines.join("\r\n")}\r\n`
}

export function downloadIcs(blocks: PlacedBlock[], options: IcsOptions): void {
  const blob = new Blob([buildIcs(blocks, options)], { type: "text/calendar;charset=utf-8" })
  triggerDownload(blob, "robot-mode.ics")
}

export function downloadText(text: string, filename: string, type = "application/json"): void {
  triggerDownload(new Blob([text], { type: `${type};charset=utf-8` }), filename)
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
