import type { PlacedBlock, Settings } from "./types"
import { parseTime } from "./scheduler/time"
import { dayTimeline, type PrintRow } from "./printout"
import { momentOf } from "./today"

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

/** What a day's ticket says, whether it is drawn on the screen or saved as a picture. */
export type TicketContent = {
  /** "Sun 04 OCT 2026". */
  date: string
  rows: PrintRow[]
  /** The day's own activities (meals aren't counted), and the time they take. */
  tasks: number
  planned: number
}

export function ticketContent(settings: Settings, blocks: PlacedBlock[], now: Date): TicketContent {
  const moment = momentOf(now)
  const wake = parseTime(settings.wakeTime)
  let sleep = parseTime(settings.sleepTime)
  if (sleep <= wake) sleep += 1440

  const activityIds = new Set(settings.activities.map((a) => a.id))
  const day = blocks.filter((b) => b.day === moment.day)
  const tasks = day.filter((b) => activityIds.has(b.activityId))
  return {
    date: `${DAYS[moment.day]} ${String(now.getDate()).padStart(2, "0")} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`,
    rows: dayTimeline(day, wake, sleep),
    tasks: tasks.length,
    planned: tasks.reduce((sum, b) => sum + b.endMinute - b.startMinute, 0),
  }
}
