import { defaultMeals } from "./meals"
import { generate } from "./scheduler/generate"
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
  /**
   * The document that was torn off: the printed list, the plotted grid, or one
   * day's ticket (then `blocks` is that day's, and `filedAt` its date). Older sheets were grids.
   */
  format?: "list" | "grid" | "ticket"
}

/**
 * The week as it was last PRINTed: what the paper shows, and everything that
 * leaves the machine (the binder, the ticket, .ics) is taken from. The screen
 * holds the draft; this changes only on PRINT.
 */
export type PrintedWeek = {
  /** When it was printed (ms since epoch). */
  at: number
  wakeTime: string
  sleepTime: string
  blocks: PlacedBlock[]
}

/** A saved printed week, or null when it isn't one. */
function readPrinted(value: unknown): PrintedWeek | null | undefined {
  // Null is a week drafted and never printed; missing is a save from before there was paper to print on.
  if (value === null) return null
  if (!value || typeof value !== "object") return undefined
  const p = value as Partial<PrintedWeek>
  if (!Array.isArray(p.blocks) || typeof p.wakeTime !== "string" || typeof p.sleepTime !== "string") return undefined
  return { at: typeof p.at === "number" ? p.at : 0, wakeTime: p.wakeTime, sleepTime: p.sleepTime, blocks: p.blocks }
}

/** The week's two printers: the line printer's list and the plotter's grid. */
export type Sheet = "list" | "grid"

/** Which printers stand empty. A save from when one tear-off emptied both says so with `printerEmpty`. */
function readEmptied(parsed: Partial<SavedState> & { printerEmpty?: unknown }): Sheet[] {
  if (Array.isArray(parsed.emptied)) return parsed.emptied.filter((x): x is Sheet => x === "list" || x === "grid")
  return parsed.printerEmpty === true ? ["list", "grid"] : []
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
  /** Printers whose sheet was torn off with nothing printed since: each stands empty on its own, even after a reload. */
  emptied?: Sheet[]
  /** The day ("2026-10-02") whose ticket was torn off: the ticket printer stays empty until the next day, or a fresh one is asked for. */
  ticketTornOn?: string
  /**
   * The week on paper. Null once a week has been drafted and not yet printed;
   * missing in saves from before the draft moved to the screen (their week is
   * then printed as it stands, so nobody's paper goes blank).
   */
  printed?: PrintedWeek | null
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

/**
 * A save from before the paper was a copy of the screen: its week was on paper
 * as it stood, so it is printed now, and nobody's paper goes blank.
 */
function withPaper(state: SavedState): SavedState {
  if (!state.generated || state.printed !== undefined) return state
  const { blocks } = generate(state.settings, { locked: state.locked, skip: state.skipped })
  return { ...state, printed: { at: Date.now(), wakeTime: state.settings.wakeTime, sleepTime: state.settings.sleepTime, blocks } }
}

/** Never throws: a stale or corrupt entry falls back to a clean slate. */
export function load(): SavedState {
  if (typeof window === "undefined") return initialState
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return initialState
    const parsed = JSON.parse(raw) as Partial<SavedState>
    if (parsed.version !== 1 || !parsed.settings) return initialState
    return withPaper({
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
      emptied: readEmptied(parsed),
      ticketTornOn: typeof parsed.ticketTornOn === "string" ? parsed.ticketTornOn : undefined,
      printed: readPrinted(parsed.printed),
    })
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
    return withPaper({
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
      emptied: readEmptied(parsed),
      ticketTornOn: typeof parsed.ticketTornOn === "string" ? parsed.ticketTornOn : undefined,
      printed: readPrinted(parsed.printed),
    })
  } catch {
    return null
  }
}

const SETUP_PREFIX = "#setup="

/**
 * The setup (hours, meals, activities) packed into a link, so it can be opened
 * on another device or handed to someone else without an account. The week
 * itself is not carried: the same setup solves to the same week anyway.
 */
export function setupLink(settings: Settings, base: string): string {
  const { wakeTime, sleepTime, seed, activities, meals } = settings
  const bytes = new TextEncoder().encode(JSON.stringify({ wakeTime, sleepTime, seed, activities, meals }))
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  return `${base.split("#")[0]}${SETUP_PREFIX}${b64}`
}

/** The setup in a link's hash, or null when there is none or it is not one of ours. */
export function setupFromHash(hash: string): Settings | null {
  if (!hash.startsWith(SETUP_PREFIX)) return null
  try {
    const b64 = hash.slice(SETUP_PREFIX.length).replace(/-/g, "+").replace(/_/g, "/")
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Settings>
    if (!Array.isArray(parsed.activities) || typeof parsed.wakeTime !== "string" || typeof parsed.sleepTime !== "string") return null
    return readSettings(parsed)
  } catch {
    return null
  }
}
