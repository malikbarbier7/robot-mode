import { defaultMeals } from "./meals"
import type { Clock, WeekStart } from "./locale"
import type { PlacedBlock, Settings } from "./types"

/** How times and weeks are shown. A missing clock follows the browser's locale. */
export type Display = { clock?: Clock; weekStart?: WeekStart; sound?: boolean }

/** Sessions answered "done" on the terminal, for one ISO week ("2026-W40"); a new week starts empty. */
export type DoneLog = { week: string; ids: string[] }

const KEY = "robot-mode:v1"

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
  done?: DoneLog
  /** When the week was generated (ms since epoch): sessions that were over by then aren't asked about. */
  generatedAt?: number
}

export const emptySettings: Settings = {
  wakeTime: "07:30",
  sleepTime: "23:30",
  minFreeMinutesPerDay: 120,
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
      settings: {
        ...emptySettings,
        ...parsed.settings,
        meals: parsed.settings.meals ?? defaultMeals,
      },
      locked: parsed.locked ?? [],
      skipped: parsed.skipped ?? [],
      exportSequence: parsed.exportSequence ?? 0,
      templateId: parsed.templateId,
      generated: parsed.generated ?? false,
      display: parsed.display,
      done: parsed.done,
      generatedAt: parsed.generatedAt,
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
      settings: {
        ...emptySettings,
        ...parsed.settings,
        meals: parsed.settings.meals ?? defaultMeals,
      },
      locked: parsed.locked ?? [],
      skipped: parsed.skipped ?? [],
      exportSequence: parsed.exportSequence ?? 0,
      templateId: parsed.templateId,
      generated: parsed.generated ?? false,
      display: parsed.display,
      done: parsed.done,
      generatedAt: parsed.generatedAt,
    }
  } catch {
    return null
  }
}
