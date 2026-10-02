import { defaultMeals } from "./meals"
import type { Clock, WeekStart } from "./locale"
import type { PlacedBlock, Settings } from "./types"

/** How times and weeks are shown. A missing clock follows the browser's locale. */
export type Display = {
  clock?: Clock
  weekStart?: WeekStart
  sound?: boolean
}

const KEY = "robot-mode:v1"

/** A week torn off and filed: the sheet as it was, to read or print again. */
export type ArchivedWeek = {
  id: string
  week: number
  year: number
  /** When it was torn off (ms since epoch). */
  filedAt: number
  wakeTime: string
  sleepTime: string
  /** The sessions as they stood, moves and removals included. */
  blocks: PlacedBlock[]
  /** The document that was torn off: the printed list or the plotted grid. Older sheets were grids. */
  format?: "list" | "grid"
}

export type SavedState = {
  version: 1
  settings: Settings
  locked: PlacedBlock[]
  skipped: string[]
  /** Bumped on every ICS export so calendars accept the update. */
  exportSequence: number
  /** The template this week started from, so edits can be rolled back to it. */
  templateId?: string
  /** True once the user has pressed Generate. Before that, the list is the app. */
  generated?: boolean
  display?: Display
  /** The week the current sheet belongs to ("2026-W40"); a later date means a new week is due. */
  currentWeek?: string
  /** Weeks torn off, newest first. */
  archive?: ArchivedWeek[]
}

export const emptySettings: Settings = {
  wakeTime: "07:30",
  sleepTime: "23:30",
  seed: 1,
  activities: [],
  meals: defaultMeals,
}

export const initialState: SavedState = {
  version: 1,
  settings: emptySettings,
  locked: [],
  skipped: [],
  exportSequence: 0,
}

/**
 * Saved settings, filled in with defaults. Older saves carry a
 * `minFreeMinutesPerDay` and per-activity priorities; neither means anything
 * now, so both are left behind.
 */
function readSettings(saved: Partial<Settings> & { minFreeMinutesPerDay?: unknown }): Settings {
  const { minFreeMinutesPerDay: _dropped, ...rest } = saved
  void _dropped
  // Priorities were once chosen per activity; now every activity weighs the same, so old ones go.
  const activities = (rest.activities ?? []).map(({ priority: _priority, ...activity }) => {
    void _priority
    return activity
  })
  return { ...emptySettings, ...rest, activities, meals: rest.meals ?? defaultMeals }
}

/** Never throws: a stale or corrupt entry falls back to a clean slate. */
export function load(): SavedState {
  if (typeof window === "undefined") return initialState
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return initialState
    const parsed = JSON.parse(raw) as Partial<SavedState>
    if (parsed.version !== 1 || !parsed.settings) return initialState
    return {
      version: 1,
      settings: readSettings(parsed.settings),
      locked: parsed.locked ?? [],
      skipped: parsed.skipped ?? [],
      exportSequence: parsed.exportSequence ?? 0,
      templateId: parsed.templateId,
      generated: parsed.generated ?? false,
      display: parsed.display,
      currentWeek: parsed.currentWeek,
      archive: Array.isArray(parsed.archive) ? parsed.archive : [],
    }
  } catch {
    return initialState
  }
}

export function save(state: SavedState): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Private browsing or a full quota. The app keeps working in memory.
  }
}

export function toJson(state: SavedState): string {
  return JSON.stringify(state, null, 2)
}

export function fromJson(text: string): SavedState | null {
  try {
    const parsed = JSON.parse(text) as Partial<SavedState>
    if (!parsed.settings || !Array.isArray(parsed.settings.activities)) return null
    return {
      version: 1,
      settings: readSettings(parsed.settings),
      locked: parsed.locked ?? [],
      skipped: parsed.skipped ?? [],
      exportSequence: parsed.exportSequence ?? 0,
      templateId: parsed.templateId,
      generated: parsed.generated ?? false,
      display: parsed.display,
      currentWeek: parsed.currentWeek,
      archive: Array.isArray(parsed.archive) ? parsed.archive : [],
    }
  } catch {
    return null
  }
}
