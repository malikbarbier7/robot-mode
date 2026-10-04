import { defaultMeals } from "./meals"
import { generate } from "./scheduler/generate"
import type { Clock, WeekStart } from "./locale"
import type { Day, PlacedBlock, Settings } from "./types"
import { dateInWeek, dayKey, weekKey } from "./printout"

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
  /** A ticket's day ("2026-10-05"): any day of the week can be printed and torn off, not only today. */
  day?: string
  wakeTime: string
  sleepTime: string
  /** The sessions as they stood, moves and removals included. */
  blocks: PlacedBlock[]
  /**
   * The document that was torn off: the printed list, the plotted grid, or one
   * day's ticket (then `blocks` is that day's, and `day` its date). Older sheets were grids.
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

/**
 * What each printer holds, each printed on its own: the list, the grid, and
 * one ticket per day ("2026-10-05", that day's lines only). A sheet; null once
 * it was torn off and nothing printed there since; missing if that printer
 * hasn't printed yet.
 */
export type Sheets = {
  list?: PrintedWeek | null
  grid?: PrintedWeek | null
  tickets?: Record<string, PrintedWeek | null>
}

/** Saves from before; they had one PRINT for every printer, and kept which ones were torn off. */
type OlderPaper = { emptied?: unknown; printerEmpty?: unknown; ticketsTorn?: unknown; ticketTornOn?: unknown }

function readSheets(parsed: Partial<SavedState> & OlderPaper, printed: PrintedWeek | null | undefined): Sheets {
  const sheet = (value: unknown) => (value === null ? null : (readPrinted(value) ?? undefined))
  if (parsed.sheets && typeof parsed.sheets === "object") {
    const { list, grid, tickets } = parsed.sheets as Sheets
    const days: Record<string, PrintedWeek | null> = {}
    for (const [key, value] of Object.entries(tickets && typeof tickets === "object" ? tickets : {})) {
      const read = sheet(value)
      if (read !== undefined) days[key] = read
    }
    return { list: sheet(list), grid: sheet(grid), tickets: days }
  }
  // One PRINT filled every printer: each holds that week, except the ones torn off since.
  if (!printed) return {}
  const emptied = Array.isArray(parsed.emptied) ? parsed.emptied : parsed.printerEmpty === true ? ["list", "grid"] : []
  const torn = Array.isArray(parsed.ticketsTorn) ? parsed.ticketsTorn : typeof parsed.ticketTornOn === "string" ? [parsed.ticketTornOn] : []
  const week = parsed.currentWeek ?? weekKey(new Date())
  const tickets: Record<string, PrintedWeek | null> = {}
  for (let d = 0; d < 7; d++) {
    const key = dayKey(dateInWeek(week, d as Day))
    tickets[key] = torn.includes(key) ? null : { ...printed, blocks: printed.blocks.filter((b) => b.day === d) }
  }
  return {
    list: emptied.includes("list") ? null : printed,
    grid: emptied.includes("grid") ? null : printed,
    tickets,
  }
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
  /** What each printer holds: every printer prints on its own, and keeps its sheet until it prints again or it is torn off. */
  sheets?: Sheets
  /**
   * The week as last printed, on whichever printer. Null once a week has been
   * drafted and not yet printed; missing in saves from before the draft moved
   * to the screen (their week is then printed as it stands, so nobody's paper
   * goes blank).
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
 * What is on paper, read from a save. A save from before the paper was a copy
 * of the screen had its week on paper as it stood, so it is printed now, and
 * nobody's paper goes blank; one from before each printer printed on its own
 * has every printer holding that week, except the ones torn off since.
 */
function withPaper(state: Omit<SavedState, "sheets"> & { sheets: Partial<SavedState> & OlderPaper }): SavedState {
  let printed = state.printed
  if (state.generated && printed === undefined) {
    const { blocks } = generate(state.settings, { locked: state.locked, skip: state.skipped })
    printed = { at: Date.now(), wakeTime: state.settings.wakeTime, sleepTime: state.settings.sleepTime, blocks }
  }
  return { ...state, printed, sheets: readSheets(state.sheets, printed) }
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
      printed: readPrinted(parsed.printed),
      sheets: parsed as Partial<SavedState> & OlderPaper,
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
      printed: readPrinted(parsed.printed),
      sheets: parsed as Partial<SavedState> & OlderPaper,
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
