import type { Activity, Day, PlacedBlock, Priority, Schedule, Settings, Unplaced } from "@/lib/types"
import { computeBudget } from "./budget"
import { makeRng, shuffled } from "./rng"
import {
  ALL_DAYS,
  GRID_SLOTS,
  SLOTS_PER_DAY,
  SLOT_MINUTES,
  dayWindows,
  formatTime,
  slotOfDay,
  slotsFor,
  timeToSlot,
  type DayWindow,
} from "./time"

/** Soft-constraint penalties. Lower total is a better week. */
const P_OUTSIDE_WINDOW = 1000
const P_SAME_DAY_REPEAT = 200
const P_INCONSISTENT_PER_SLOT = 3
const P_LATE_NIGHT = 60
const P_ORPHAN_GAP = 40
/** Charged for squatting on slots that windowed activities are competing for. */
const P_CONTENTION = 100
/**
 * Charged to an activity's FIRST session for choosing a time of day that other
 * activities already occupy. Only the anchor pays it; later sessions follow it
 * by consistency, so "same time every day" still holds.
 *
 * It has to be measured by time of day across the whole week, not per day: an
 * anchor can always find an empty day, so a per-day measure left everything
 * sitting at wake time and the evenings empty.
 */
const P_ANCHOR_SPREAD = 1.5
/** Slots either side of a candidate that still count as the same time of day. */
const SPREAD_RADIUS = 2
/** Tiny nudge so equal-scoring slots resolve to the earliest one, deterministically. */
const P_EARLY_BIAS = 0.01
/**
 * Seeded tie-break. Smaller than any real penalty (the cheapest is 3 per slot of
 * drift), so it only separates candidates the constraints rate as equal. Without
 * it Shuffle returns a byte-identical week and looks broken.
 */
const P_JITTER = 0.8

const UNPLACED_PENALTY: Record<Priority, number> = {
  critical: 1e7,
  high: 1e6,
  medium: 1e5,
  low: 1e4,
}

const PRIORITY_ORDER: Priority[] = ["critical", "high", "medium", "low"]

/** Number of shuffled greedy attempts. Best-scoring week wins. */
const PASSES = 20

export type GenerateOptions = {
  /** Blocks the user pinned. Never moved. */
  locked?: PlacedBlock[]
  /** Nothing new is scheduled before this instant — used by "I missed this". */
  notBefore?: { day: Day; minuteOfDay: number }
  /** Session keys the user removed from this week. Not placed at all. */
  skip?: string[]
  passes?: number
}

type SessionSpec = {
  key: string
  activity: Activity
  index: number
  slots: number
  bufferSlots: number
}

type PassState = {
  occupied: Uint8Array
  /** How many blocks already sit at each of the 96 times of day, across all seven days. */
  usageByTimeOfDay: Float64Array
  allocatedByDay: number[]
  placed: PlacedBlock[]
  anchorByActivity: Map<string, number>
  countByActivityDay: Map<string, number>
  penalty: number
}

type Candidate = {
  startAbs: number
  day: Day
  score: number
  outsideWindow: boolean
  consistent: boolean
  bufStart: number
  bufEnd: number
}

export function generate(settings: Settings, options: GenerateOptions = {}): Schedule {
  const windows = dayWindows(settings.wakeTime, settings.sleepTime)
  const budget = computeBudget(settings)
  const passes = options.passes ?? PASSES

  const capSlotsPerDay =
    windows[0].endAbs - windows[0].startAbs - Math.ceil(Math.max(0, settings.minFreeMinutesPerDay) / SLOT_MINUTES)

  // A locked block already satisfies its session, so it must not be placed a second time.
  const lockedKeys = new Set((options.locked ?? []).map((b) => b.id))
  const skippedKeys = new Set(options.skip ?? [])
  const demand = buildDemand(settings.activities, windows)
  const sessions = expandSessions(settings.activities).filter(
    (s) => !lockedKeys.has(s.key) && !skippedKeys.has(s.key),
  )
  const fixed = sessions.filter((s) => s.activity.fixedAt)
  const flexible = sessions.filter((s) => !s.activity.fixedAt)

  let best: { state: PassState; unplaced: Unplaced[] } | null = null

  for (let pass = 0; pass < passes; pass++) {
    const passSeed = settings.seed + pass * 7919
    const rng = makeRng(passSeed)
    const state = seedState(settings, windows, options)
    const unplacedKeys: SessionSpec[] = []

    // Fixed anchors first — they constrain everything else.
    for (const session of fixed) {
      const placedOk = placeFixed(session, state, windows, settings, capSlotsPerDay, demand, passSeed)
      if (!placedOk) unplacedKeys.push(session)
    }

    // Then by priority tier, shuffled within each tier.
    for (const tier of PRIORITY_ORDER) {
      const tierSessions = flexible.filter((s) => s.activity.priority === tier)
      for (const session of shuffled(tierSessions, rng)) {
        const placedOk = placeFlexible(session, state, windows, capSlotsPerDay, demand, passSeed)
        if (!placedOk) unplacedKeys.push(session)
      }
    }

    for (const session of unplacedKeys) {
      state.penalty += UNPLACED_PENALTY[session.activity.priority]
    }

    if (!best || state.penalty < best.state.penalty) {
      best = { state, unplaced: summariseUnplaced(unplacedKeys, settings.activities) }
    }
  }

  const state = best!.state
  const blocks = [...state.placed].sort((a, b) => a.day - b.day || a.startMinute - b.startMinute)

  return { blocks, unplaced: best!.unplaced, score: state.penalty, budget }
}

/**
 * How badly each slot is wanted by activities that have a preferred window.
 * Without this, an unwindowed critical activity placed first eats the exact hours a
 * windowed one needs, and the windowed activity gets exiled for no reason.
 */
function buildDemand(activities: Activity[], windows: DayWindow[]): Float64Array {
  const demand = new Float64Array(GRID_SLOTS)
  for (const activity of activities) {
    if (!activity.window || activity.durationMinutes <= 0 || activity.sessionsPerWeek <= 0) continue
    const days = allowedDaysOf(activity)
    const slots = slotsFor(activity.durationMinutes)
    const sessionsPerDay = activity.sessionsPerWeek / days.length

    for (const day of days) {
      const win = windows[day]
      const range = windowRange(activity, win)
      if (!range) continue
      const from = Math.max(range.from, win.startAbs)
      const to = Math.min(range.to, win.endAbs)
      const width = to - from
      if (width <= 0) continue
      // Fraction of this window the activity needs: 1.0 means it needs the whole thing.
      const pressure = (sessionsPerDay * slots) / width
      for (let i = from; i < to; i++) demand[i] += pressure
    }
  }
  return demand
}

function expandSessions(activities: Activity[]): SessionSpec[] {
  const out: SessionSpec[] = []
  for (const activity of activities) {
    if (activity.durationMinutes <= 0 || activity.sessionsPerWeek <= 0) continue
    const slots = slotsFor(activity.durationMinutes)
    const bufferSlots = activity.bufferMinutes ? slotsFor(activity.bufferMinutes) : 0
    for (let i = 0; i < activity.sessionsPerWeek; i++) {
      out.push({ key: `${activity.id}#${i}`, activity, index: i, slots, bufferSlots })
    }
  }
  return out
}

function seedState(settings: Settings, windows: DayWindow[], options: GenerateOptions): PassState {
  const state: PassState = {
    occupied: new Uint8Array(GRID_SLOTS),
    usageByTimeOfDay: new Float64Array(SLOTS_PER_DAY),
    allocatedByDay: new Array(7).fill(0),
    placed: [],
    anchorByActivity: new Map(),
    countByActivityDay: new Map(),
    penalty: 0,
  }

  // Everything before `notBefore` is the past: unavailable for new placements.
  if (options.notBefore) {
    const boundary = options.notBefore.day * SLOTS_PER_DAY + Math.floor(options.notBefore.minuteOfDay / SLOT_MINUTES)
    for (let i = 0; i < Math.min(boundary, GRID_SLOTS); i++) state.occupied[i] = 1
  }

  for (const block of options.locked ?? []) {
    const startAbs = block.day * SLOTS_PER_DAY + Math.floor(block.startMinute / SLOT_MINUTES)
    const endAbs = block.day * SLOTS_PER_DAY + Math.ceil(block.endMinute / SLOT_MINUTES)
    for (let i = startAbs; i < endAbs && i < GRID_SLOTS; i++) {
      state.occupied[i] = 1
      state.usageByTimeOfDay[slotOfDay(i)] += 1
    }
    state.allocatedByDay[block.day] += endAbs - startAbs
    state.placed.push({ ...block, locked: true })
    notePlacement(state, block.activityId, block.day, startAbs)
  }

  void windows
  return state
}

function notePlacement(state: PassState, activityId: string, day: Day, startAbs: number) {
  if (!state.anchorByActivity.has(activityId)) {
    state.anchorByActivity.set(activityId, slotOfDay(startAbs))
  }
  const key = `${activityId}:${day}`
  state.countByActivityDay.set(key, (state.countByActivityDay.get(key) ?? 0) + 1)
}

function allowedDaysOf(activity: Activity): Day[] {
  return activity.allowedDays && activity.allowedDays.length > 0 ? activity.allowedDays : ALL_DAYS
}

function isFree(state: PassState, from: number, to: number): boolean {
  if (from < 0 || to > GRID_SLOTS) return false
  for (let i = from; i < to; i++) if (state.occupied[i]) return false
  return true
}

/** Free slots between the candidate and the nearest occupied slot (or window edge). */
function gapBefore(state: PassState, startAbs: number, win: DayWindow): number {
  let gap = 0
  for (let i = startAbs - 1; i >= win.startAbs; i--) {
    if (state.occupied[i]) break
    gap++
  }
  return gap
}

function gapAfter(state: PassState, endAbs: number, win: DayWindow): number {
  let gap = 0
  for (let i = endAbs; i < win.endAbs; i++) {
    if (state.occupied[i]) break
    gap++
  }
  return gap
}

/**
 * Window as an absolute slot range within a given day.
 *
 * A clock time is ambiguous once bedtime runs past midnight: 01:00 could mean
 * tonight's small hours or this morning's. Rather than guess from whether the
 * window opens before wake time — which wrongly exiled a 06:00 window to the
 * next day for anyone waking at 07:30 — both readings are scored and the one
 * that overlaps the waking window more wins.
 */
function windowRange(activity: Activity, win: DayWindow): { from: number; to: number } | null {
  if (!activity.window) return null
  const dayStart = win.day * SLOTS_PER_DAY
  const from = timeToSlot(activity.window.start)
  let to = timeToSlot(activity.window.end)
  if (to <= from) to += SLOTS_PER_DAY

  let best = { from: dayStart + from, to: dayStart + to }
  let bestOverlap = -Infinity
  for (const shift of [0, SLOTS_PER_DAY]) {
    const candidate = { from: dayStart + from + shift, to: dayStart + to + shift }
    const overlap = Math.min(candidate.to, win.endAbs) - Math.max(candidate.from, win.startAbs)
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      best = candidate
    }
  }
  return best
}

/** Deterministic per (pass seed, session, slot). Same seed always gives the same week. */
function jitter(passSeed: number, key: string, startAbs: number): number {
  let h = (passSeed ^ (startAbs * 2654435761)) >>> 0
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193)
  return ((h >>> 0) / 4294967296) * P_JITTER
}

function circularSlotDistance(a: number, b: number): number {
  const d = Math.abs(a - b)
  return Math.min(d, SLOTS_PER_DAY - d)
}

function scoreCandidate(
  session: SessionSpec,
  state: PassState,
  startAbs: number,
  win: DayWindow,
  demand: Float64Array,
  passSeed: number,
): Candidate | null {
  const endAbs = startAbs + session.slots
  const bufStart = Math.max(win.startAbs, startAbs - session.bufferSlots)
  const bufEnd = Math.min(win.endAbs, endAbs + session.bufferSlots)

  if (startAbs < win.startAbs || endAbs > win.endAbs) return null
  if (!isFree(state, bufStart, bufEnd)) return null

  const activity = session.activity
  let score = 0

  const range = windowRange(activity, win)
  const outsideWindow = range !== null && (startAbs < range.from || endAbs > range.to)
  if (outsideWindow) score += P_OUTSIDE_WINDOW

  // Slots inside this activity's own window are free to use; everything else is contested.
  let contention = 0
  for (let i = bufStart; i < bufEnd; i++) {
    if (range && i >= range.from && i < range.to) continue
    contention += demand[i]
  }
  score += contention * P_CONTENTION

  const repeats = state.countByActivityDay.get(`${activity.id}:${win.day}`) ?? 0
  score += repeats * P_SAME_DAY_REPEAT

  const anchor = state.anchorByActivity.get(activity.id)
  let consistent = false
  if (anchor !== undefined) {
    const drift = circularSlotDistance(slotOfDay(startAbs), anchor)
    score += Math.min(drift, 48) * P_INCONSISTENT_PER_SLOT
    consistent = drift === 0
  } else {
    // Placing the anchor: prefer a time of day the rest of the week is not using.
    let crowding = 0
    for (let i = bufStart - SPREAD_RADIUS; i < bufEnd + SPREAD_RADIUS; i++) {
      crowding += state.usageByTimeOfDay[slotOfDay(i)]
    }
    score += crowding * P_ANCHOR_SPREAD
  }

  if (activity.priority === "critical" || activity.priority === "high") {
    if (endAbs > win.endAbs - 8) score += P_LATE_NIGHT
  }

  const before = gapBefore(state, bufStart, win)
  const after = gapAfter(state, bufEnd, win)
  if (before > 0 && before <= 2) score += P_ORPHAN_GAP
  if (after > 0 && after <= 2) score += P_ORPHAN_GAP

  score += (startAbs - win.startAbs) * P_EARLY_BIAS
  score += jitter(passSeed, session.key, startAbs)

  return { startAbs, day: win.day, score, outsideWindow, consistent, bufStart, bufEnd }
}

function commit(session: SessionSpec, state: PassState, candidate: Candidate, reason: string) {
  for (let i = candidate.bufStart; i < candidate.bufEnd; i++) {
    state.occupied[i] = 1
    state.usageByTimeOfDay[slotOfDay(i)] += 1
  }
  state.allocatedByDay[candidate.day] += candidate.bufEnd - candidate.bufStart

  const dayStart = candidate.day * SLOTS_PER_DAY
  state.placed.push({
    id: session.key,
    activityId: session.activity.id,
    name: session.activity.name,
    priority: session.activity.priority,
    day: candidate.day,
    startMinute: (candidate.startAbs - dayStart) * SLOT_MINUTES,
    endMinute: (candidate.startAbs + session.slots - dayStart) * SLOT_MINUTES,
    locked: false,
    reason,
  })
  state.penalty += candidate.score
  notePlacement(state, session.activity.id, candidate.day, candidate.startAbs)
}

function fitsCap(session: SessionSpec, state: PassState, candidate: Candidate, capSlotsPerDay: number): boolean {
  // Critical activities are exempt: protected free time must not block work or sleep.
  if (session.activity.priority === "critical") return true
  const cost = candidate.bufEnd - candidate.bufStart
  return state.allocatedByDay[candidate.day] + cost <= capSlotsPerDay
}

function placeFlexible(
  session: SessionSpec,
  state: PassState,
  windows: DayWindow[],
  capSlotsPerDay: number,
  demand: Float64Array,
  passSeed: number,
): boolean {
  const days = allowedDaysOf(session.activity)
  let best: Candidate | null = null

  for (const day of days) {
    const win = windows[day]
    for (let start = win.startAbs; start + session.slots <= win.endAbs; start++) {
      const candidate = scoreCandidate(session, state, start, win, demand, passSeed)
      if (!candidate) continue
      if (!fitsCap(session, state, candidate, capSlotsPerDay)) continue
      if (!best || candidate.score < best.score) best = candidate
    }
  }

  if (!best) return false
  commit(session, state, best, describe(session, best))
  return true
}

function placeFixed(
  session: SessionSpec,
  state: PassState,
  windows: DayWindow[],
  settings: Settings,
  capSlotsPerDay: number,
  demand: Float64Array,
  passSeed: number,
): boolean {
  const activity = session.activity
  const anchor = activity.fixedAt!
  const wakeOffset = windows[0].startAbs - 0
  let anchorSlot = timeToSlot(anchor.start)
  if (anchorSlot < wakeOffset) anchorSlot += SLOTS_PER_DAY

  const allowed = allowedDaysOf(activity)
  const candidateDays = (anchor.days && anchor.days.length > 0 ? anchor.days : allowed).filter((d) =>
    allowed.includes(d),
  )

  for (const day of candidateDays) {
    if ((state.countByActivityDay.get(`${activity.id}:${day}`) ?? 0) > 0) continue
    const win = windows[day]
    const candidate = scoreCandidate(session, state, day * SLOTS_PER_DAY + anchorSlot, win, demand, passSeed)
    if (!candidate) continue
    if (!fitsCap(session, state, candidate, capSlotsPerDay)) continue
    commit(session, state, candidate, `Fixed at ${anchor.start}`)
    return true
  }

  void settings
  return false
}

function describe(session: SessionSpec, candidate: Candidate): string {
  const at = formatTime((candidate.startAbs % SLOTS_PER_DAY) * SLOT_MINUTES)
  const w = session.activity.window
  if (candidate.outsideWindow && w) return `No room in ${w.start}–${w.end}; nearest fit at ${at}`
  if (candidate.consistent) return `Same time as other sessions (${at})`
  if (w) return `Inside ${w.start}–${w.end} window; best fit at ${at}`
  return `Earliest good fit at ${at}`
}

function summariseUnplaced(unplaced: SessionSpec[], activities: Activity[]): Unplaced[] {
  const byActivity = new Map<string, number>()
  for (const s of unplaced) byActivity.set(s.activity.id, (byActivity.get(s.activity.id) ?? 0) + 1)

  return [...byActivity.entries()].map(([activityId, missed]) => {
    const activity = activities.find((a) => a.id === activityId)!
    const requested = activity.sessionsPerWeek
    return {
      activityId,
      name: activity.name,
      sessionsRequested: requested,
      sessionsPlaced: requested - missed,
      why: activity.fixedAt
        ? `No free day left at ${activity.fixedAt.start}`
        : `No ${activity.durationMinutes}-minute gap left on the allowed days`,
    }
  })
}
