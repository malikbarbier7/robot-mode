import type { Activity, Day, Priority } from "./types"

/**
 * What the add-activity stepper collects. Every field is optional: each step can
 * be skipped with "Decide for me", which leaves the engine to choose.
 */
export type Draft = {
  name: string
  durationMinutes: number
  sessionsPerWeek: number
  allowedDays?: Day[]
  priority?: Priority
  bufferMinutes?: number
  window?: { start: string; end: string }
  fixedAt?: { start: string }
}

/**
 * A preferred window and a fixed time are the same question answered two ways,
 * so they share one step rather than making you walk past the one you don't want.
 */
export const STEPS = ["Days", "Priority", "Travel buffer", "When"] as const
export type Step = (typeof STEPS)[number]

/** Ready-made windows, since "mornings" is how people actually think about this. */
export const WINDOW_PRESETS: { label: string; start: string; end: string }[] = [
  { label: "Morning", start: "06:00", end: "12:00" },
  { label: "Afternoon", start: "12:00", end: "18:00" },
  { label: "Evening", start: "18:00", end: "23:00" },
]

export function emptyDraft(): Draft {
  return { name: "", durationMinutes: 0, sessionsPerWeek: 1 }
}

/** True once the three base fields are usable, regardless of the optional steps. */
export function isDraftValid(draft: Draft): boolean {
  return draft.name.trim().length > 0 && draft.durationMinutes > 0 && draft.sessionsPerWeek > 0
}

/**
 * Turn a draft into an activity. Anything the user skipped is simply left off,
 * so the scheduler keeps its freedom rather than inheriting a fake preference.
 */
export function draftToActivity(draft: Draft): Omit<Activity, "id"> {
  const activity: Omit<Activity, "id"> = {
    name: draft.name.trim(),
    durationMinutes: draft.durationMinutes,
    sessionsPerWeek: draft.sessionsPerWeek,
    priority: draft.priority ?? "medium",
  }

  // All seven days is the same as no restriction, so don't store it as one.
  if (draft.allowedDays && draft.allowedDays.length > 0 && draft.allowedDays.length < 7) {
    activity.allowedDays = [...draft.allowedDays].sort((a, b) => a - b)
  }
  if (draft.bufferMinutes && draft.bufferMinutes > 0) activity.bufferMinutes = draft.bufferMinutes

  // A fixed time pins every session, which makes a preferred window meaningless.
  if (draft.fixedAt?.start) {
    activity.fixedAt = { start: draft.fixedAt.start }
  } else if (draft.window?.start && draft.window?.end) {
    activity.window = { start: draft.window.start, end: draft.window.end }
  }

  return activity
}

/** A summary line tagged with the step it came from. */
export type DraftSummaryItem = { step: number; text: string }

/**
 * Choices made so far. Each is tagged with its step so the stepper can leave out
 * the one being edited — the controls already show that, and repeating it back
 * is just noise.
 */
export function describeDraft(draft: Draft): DraftSummaryItem[] {
  const out: DraftSummaryItem[] = []
  if (draft.allowedDays && draft.allowedDays.length > 0 && draft.allowedDays.length < 7) {
    const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    // Sorted, because they are stored in the order they were clicked.
    const days = [...draft.allowedDays].sort((a, b) => a - b)
    out.push({ step: 0, text: days.map((d) => names[d]).join(" ") })
  }
  if (draft.priority) out.push({ step: 1, text: draft.priority })
  if (draft.bufferMinutes) out.push({ step: 2, text: `+${draft.bufferMinutes}m travel` })
  if (draft.fixedAt?.start) out.push({ step: 3, text: `always ${draft.fixedAt.start}` })
  else if (draft.window) out.push({ step: 3, text: `${draft.window.start}–${draft.window.end}` })
  return out
}

/** Only the steps already passed, as display text. */
export function recapBefore(draft: Draft, step: number): string[] {
  return describeDraft(draft)
    .filter((item) => item.step < step)
    .map((item) => item.text)
}
