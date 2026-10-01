import type { Activity, Day } from "./types"
import { WINDOW_PRESETS } from "./draft"
import { formatDuration, parseDuration } from "./duration"
import type { Clock, WeekStart } from "./locale"

/**
 * What a line typed at the command prompt asks for. Activity commands are
 * already resolved against the list, so the caller only has to apply them.
 * `preview` says what Enter will do, while typing; `reply` is what the machine
 * answers once it has done it.
 */
export type CommandAction = { preview: string; reply: string; note?: string } & (
  | { kind: "add"; activity: Omit<Activity, "id"> }
  | { kind: "update"; id: string; patch: Partial<Activity> }
  | { kind: "remove"; id: string }
  /** Open one of the terminal's screens; `id` is the activity to open on it. */
  | { kind: "open"; screen: Screen; id?: string }
  | { kind: "clear" | "save" | "load" }
  /** Show the week as the printed list or as the calendar grid. */
  | { kind: "view"; view: "printout" | "grid" | "today" }
  | { kind: "settings"; patch: { wakeTime?: string; sleepTime?: string; minFreeMinutesPerDay?: number } }
  | { kind: "display"; patch: { clock?: Clock; weekStart?: WeekStart; sound?: boolean } }
  | { kind: "shuffle" | "export" }
)

export type CommandError = { kind: "error"; reply: string }

/** The terminal's screens, each opened by a function. */
export type Screen = "add" | "edit" | "activities" | "hours" | "meals" | "free" | "system" | "fix" | "restart" | "help"

/** What the command line needs to know to read a line against. */
export type CommandContext = {
  activities: Activity[]
  wakeTime?: string
  sleepTime?: string
  minFreeMinutesPerDay?: number
  /** Whether the machine's sounds are on, so "sound" alone can flip them. */
  sound?: boolean
}

const MAX_SESSIONS = 28

/**
 * The function row, in the order completion offers them: typing "e" means
 * EDIT before EXPORT. They come before activity names, so one letter and
 * Enter is enough to open a function.
 */
export const FUNCTIONS = ["add", "edit", "today", "shuffle", "export", "grid", "printout", "system", "fix", "clear", "restart", "save", "load", "help"]
/** Other command words, offered after activity names. */
const VERBS = ["wake", "sleep", "free", "remove", "meals", "hours"]
/** What EDIT can open besides an activity. */
const EDIT_TARGETS: Record<string, Screen> = {
  activities: "activities",
  activity: "activities",
  meals: "meals",
  meal: "meals",
  hours: "hours",
  day: "hours",
  wake: "hours",
  sleep: "hours",
  free: "free",
  "free time": "free",
}

const SCREEN_NAMES: Record<Screen, string> = {
  add: "ADD AN ACTIVITY",
  edit: "EDIT",
  activities: "EDIT › ACTIVITIES",
  hours: "EDIT › HOURS",
  meals: "EDIT › MEALS",
  free: "EDIT › FREE TIME",
  system: "SYSTEM",
  fix: "FIX CONFLICTS",
  restart: "RESTART",
  help: "HELP",
}

function open(screen: Screen, id?: string, label = SCREEN_NAMES[screen]): CommandAction {
  return { kind: "open", screen, ...(id ? { id } : {}), preview: `OPEN ${label}`, reply: label }
}

/**
 * Reads one command line, in shorthand or in plain words:
 *   gym 1h15 4x · gym 3 times a week · add yoga 45 min twice
 *                   add Gym, or change it if it exists (either part may be left out on a change)
 *   remove gym      edit gym        wake up at 7    sleep at 11pm   free time 2h
 *   shuffle · export · help · 12h · 24h · mon · sun
 */
export function interpret(input: string, ctx: CommandContext): CommandAction | CommandError | null {
  const words = normalize(input).split(/\s+/).filter(Boolean)
  if (words.length === 0) return null
  const { activities } = ctx
  const [head, ...rest] = words
  const verb = head.toLowerCase()
  const arg = rest.join(" ")

  switch (verb) {
    case "add":
      // "add" alone; "add yoga 1h" has already lost its "add" to normalize().
      return open("add")
    case "system":
    case "settings":
    case "menu":
      return open("system")
    case "fix":
    case "conflicts":
      return open("fix")
    case "restart":
      return open("restart")
    case "meals":
    case "hours":
      return open(verb)
    case "grid":
    case "calendar":
      return { kind: "view", view: "grid", preview: "SHOW THE WEEK AS A GRID", reply: "GRID VIEW" }
    case "today":
    case "ticket":
      return { kind: "view", view: "today", preview: "PRINT TODAY'S TICKET", reply: "TODAY" }
    case "sound":
    case "mute":
    case "unmute": {
      const on = verb === "mute" ? false : verb === "unmute" ? true : arg === "on" ? true : arg === "off" ? false : !(ctx.sound ?? true)
      return { kind: "display", patch: { sound: on }, preview: on ? "SOUND ON" : "SOUND OFF", reply: on ? "SOUND ON" : "SOUND OFF" }
    }
    case "printout":
    case "list":
      return { kind: "view", view: "printout", preview: "SHOW THE WEEK AS THE PRINTOUT", reply: "PRINTOUT VIEW" }
    case "clear":
      return { kind: "clear", preview: "UNLOCK EVERYTHING AND RESTORE REMOVED BLOCKS", reply: "EDITS CLEARED" }
    case "save":
      return { kind: "save", preview: "DOWNLOAD A BACKUP OF YOUR SETUP", reply: "SAVED" }
    case "load":
      return { kind: "load", preview: "OPEN A SAVED SETUP", reply: "LOADING" }
    case "help":
    case "?":
    case "man":
      return open("help")
    case "shuffle":
      return { kind: "shuffle", preview: "SHUFFLE THE WEEK", reply: "SHUFFLED" }
    case "export":
      return { kind: "export", preview: "DOWNLOAD THE WEEK AS .ICS", reply: "EXPORTED .ICS" }
    case "12h":
    case "24h":
      return {
        kind: "display",
        patch: { clock: verb },
        preview: `SHOW A ${verb.toUpperCase()} CLOCK`,
        reply: `CLOCK ${verb.toUpperCase()}`,
      }
    case "mon":
    case "monday":
    case "sun":
    case "sunday": {
      const day = verb.startsWith("mon") ? "MONDAY" : "SUNDAY"
      return {
        kind: "display",
        patch: { weekStart: day === "MONDAY" ? "monday" : "sunday" },
        preview: `START THE WEEK ON ${day}`,
        reply: `WEEK STARTS ${day}`,
      }
    }
    case "wake":
    case "sleep": {
      const time = parseClock(arg)
      if (!time) return error(`${verb.toUpperCase()} NEEDS A TIME, E.G. ${verb === "wake" ? "WAKE 7:00" : "SLEEP 23:30"}`)
      const was = verb === "wake" ? ctx.wakeTime : ctx.sleepTime
      return {
        kind: "settings",
        patch: verb === "wake" ? { wakeTime: time } : { sleepTime: time },
        preview: `${verb.toUpperCase()} ${was ? `${was} → ` : ""}${time}`,
        reply: `${verb.toUpperCase()} ${time}`,
      }
    }
    case "free": {
      const minutes = parseDuration(arg.replace(/\s*(?:a|per|each)\s+day$/i, ""))
      if (minutes === null) return error("FREE NEEDS A LENGTH, E.G. FREE 2H")
      const was = ctx.minFreeMinutesPerDay
      return {
        kind: "settings",
        patch: { minFreeMinutesPerDay: minutes },
        preview: `FREE TIME ${was !== undefined ? `${span(was)} → ` : ""}${span(minutes)} A DAY`,
        reply: `FREE ${span(minutes)} / DAY`,
      }
    }
    case "edit": {
      if (!arg) return open("edit")
      const target = EDIT_TARGETS[arg.toLowerCase()]
      if (target) return open(target)
      const found = findActivity(arg, activities)
      if (!found) return error(notFound(arg, activities))
      return open("activities", found.id, `EDIT › ${upper(found)}`)
    }
    case "rm": {
      if (!arg) return error("REMOVE WHICH ACTIVITY?")
      const found = findActivity(arg, activities)
      if (!found) return error(notFound(arg, activities))
      return {
        kind: "remove",
        id: found.id,
        preview: `REMOVE ${describe(found)}`,
        reply: `REMOVED ${upper(found)}`,
      }
    }
  }

  // "add surf" asks for a new activity outright, so it may lean on defaults; a bare "surf" might be a typo.
  return activityLine(words, activities, /^\s*(?:add|new|create)\s/i.test(input))
}

/** "gym 1h15 4x", "deep work 2h", "gym 3x": a name, then a length and/or a count, in either order. */
/** A new activity's length when none is given: an hour is the usual guess. */
const DEFAULT_LENGTH = 60

/** What an activity line can set, each part optional. */
type Parts = {
  durationMinutes?: number
  sessionsPerWeek?: number
  allowedDays?: Day[]
  window?: { start: string; end: string }
  fixedAt?: { start: string }
}

/**
 * "surf 1h10 4x MTSaSu morning always at 06:00": a name, then any of a
 * length, a count, days, a time of day and a fixed time, in any order.
 */
function activityLine(words: string[], activities: Activity[], explicitAdd = false): CommandAction | CommandError {
  const parts: Parts = {}
  const nameWords = [...words]

  // Read the parameters off the end, so a name may have spaces in it.
  while (nameWords.length > 1) {
    const last = nameWords[nameWords.length - 1]
    const before = nameWords[nameWords.length - 2]?.toLowerCase()
    const time = before === "always" && nameWords.length > 2 ? parseClock(last) : null
    const count = parseSessions(last)
    const days = parseDays(last)
    const window = WINDOW_PRESETS.find((w) => w.label.toLowerCase() === last.toLowerCase().replace(/s$/, ""))
    if (time && !parts.fixedAt) {
      parts.fixedAt = { start: time }
      nameWords.pop()
    } else if (count !== null && parts.sessionsPerWeek === undefined) {
      parts.sessionsPerWeek = count
    } else if (days && !parts.allowedDays) {
      parts.allowedDays = days
    } else if (window && !parts.window) {
      parts.window = { start: window.start, end: window.end }
    } else {
      const minutes = parseDuration(last)
      if (minutes === null || parts.durationMinutes !== undefined) break
      parts.durationMinutes = minutes
    }
    nameWords.pop()
  }

  const name = nameWords.join(" ")
  const given = Object.keys(parts).length > 0
  if (parts.sessionsPerWeek !== undefined && (parts.sessionsPerWeek < 1 || parts.sessionsPerWeek > MAX_SESSIONS)) {
    return error(`BETWEEN 1 AND ${MAX_SESSIONS} SESSIONS A WEEK`)
  }
  if (parts.durationMinutes !== undefined && parts.durationMinutes <= 0) return error("A SESSION NEEDS A LENGTH")

  const existing = findActivity(name, activities)
  if (existing) {
    if (explicitAdd && !given) {
      return error(`${upper(existing)} IS ALREADY ON YOUR LIST. TO CHANGE IT: ${upper(existing)} 2H 3×`)
    }
    if (!given) return error(`${upper(existing)}: WHAT SHOULD CHANGE? E.G. ${upper(existing)} 2H 3× MTW MORNING`)
    const patch: Partial<Activity> = { ...parts }
    // A fixed time and a preferred window answer the same question; the newer answer wins.
    if (parts.fixedAt) patch.window = undefined
    else if (parts.window) patch.fixedAt = undefined
    // Every day is no restriction at all.
    if (parts.allowedDays?.length === 7) patch.allowedDays = undefined
    const next = { ...existing, ...patch }
    return {
      kind: "update",
      id: existing.id,
      patch,
      preview: `${upper(existing)} ${changes(existing, next).join(" · ")}`,
      reply: `CHANGED ${describe(next)}`,
    }
  }

  if (parts.durationMinutes === undefined && !explicitAdd) {
    const near = closest(name, activities)
    if (near) return error(`NO ${name.toUpperCase()} ON YOUR LIST. DID YOU MEAN ${upper(near)}?`)
    return error(`${name.toUpperCase()} ISN'T ON YOUR LIST. TO ADD IT: ADD ${name.toUpperCase()}`)
  }
  const activity: Omit<Activity, "id"> = {
    name,
    durationMinutes: parts.durationMinutes ?? DEFAULT_LENGTH,
    sessionsPerWeek: parts.sessionsPerWeek ?? 1,
    priority: "medium",
    ...(parts.allowedDays && parts.allowedDays.length < 7 ? { allowedDays: parts.allowedDays } : {}),
    ...(parts.fixedAt ? { fixedAt: parts.fixedAt } : parts.window ? { window: parts.window } : {}),
  }
  // The parts not given yet, as what could still be typed.
  const optional = [
    !parts.allowedDays && "MTWTFSaSu",
    !parts.window && !parts.fixedAt && "MORNING",
    !parts.fixedAt && "ALWAYS AT 07:00",
  ].filter(Boolean)
  return {
    kind: "add",
    activity,
    preview: `ADD ${describe(activity)}`,
    ...(optional.length ? { note: `OPTIONAL: ${optional.join(" · ")}` } : {}),
    reply: `ADDED ${describe(activity)}`,
  }
}

/** An activity as one command line: "SURF 1H10 4× MTSaSu MORNING ALWAYS AT 06:00". */
export function describe(a: Omit<Activity, "id">): string {
  return [
    a.name.toUpperCase(),
    span(a.durationMinutes),
    `${a.sessionsPerWeek}×`,
    a.allowedDays && a.allowedDays.length < 7 ? formatDays(a.allowedDays) : "",
    a.fixedAt ? `ALWAYS AT ${a.fixedAt.start}` : a.window ? windowName(a.window) : "",
  ]
    .filter(Boolean)
    .join(" ")
}

/** What differs between two versions of an activity: "4× → 3×", "ANY DAY → MTW". */
function changes(from: Activity, to: Activity): string[] {
  const out: string[] = []
  if (from.durationMinutes !== to.durationMinutes) out.push(`${span(from.durationMinutes)} → ${span(to.durationMinutes)}`)
  if (from.sessionsPerWeek !== to.sessionsPerWeek) out.push(`${from.sessionsPerWeek}× → ${to.sessionsPerWeek}×`)
  const days = (a: Activity) => (a.allowedDays && a.allowedDays.length < 7 ? formatDays(a.allowedDays) : "ANY DAY")
  if (days(from) !== days(to)) out.push(`${days(from)} → ${days(to)}`)
  const when = (a: Activity) => (a.fixedAt ? `ALWAYS AT ${a.fixedAt.start}` : a.window ? windowName(a.window) : "ANY TIME")
  if (when(from) !== when(to)) out.push(`${when(from)} → ${when(to)}`)
  return out.length ? out : ["NO CHANGE"]
}

function windowName(window: { start: string; end: string }): string {
  const preset = WINDOW_PRESETS.find((w) => w.start === window.start && w.end === window.end)
  return preset ? preset.label.toUpperCase() : `${window.start}–${window.end}`
}

const DAY_CODES = ["M", "T", "W", "T", "F", "Sa", "Su"] as const

/** Days as their letters, in week order: [0, 1, 5, 6] -> "MTSaSu". */
export function formatDays(days: Day[]): string {
  return [...days].sort((a, b) => a - b).map((d) => DAY_CODES[d]).join("")
}

/** Letters that may stand for a day, and which days each could be. */
const DAY_LETTERS: [string, Day[]][] = [
  ["tu", [1]],
  ["th", [3]],
  ["sa", [5]],
  ["su", [6]],
  ["m", [0]],
  ["t", [1, 3]],
  ["w", [2]],
  ["f", [4]],
  ["s", [5, 6]],
]

/**
 * "MTSaSu" -> Mon, Tue, Sat, Sun. Letters are read in week order, each taking
 * the next day it can be, so "TT" is Tuesday and Thursday. Also "weekdays"
 * and "weekends". Null unless the whole word is days.
 */
export function parseDays(word: string): Day[] | null {
  const s = word.toLowerCase()
  if (s === "weekdays") return [0, 1, 2, 3, 4]
  if (s === "weekends" || s === "weekend") return [5, 6]
  const days: Day[] = []
  let at = 0
  let next = 0
  while (at < s.length) {
    const match = DAY_LETTERS.find(([letters, candidates]) => s.startsWith(letters, at) && candidates.some((d) => d >= next))
    if (!match) return null
    const day = match[1].find((d) => d >= next)!
    days.push(day)
    next = day + 1
    at += match[0].length
  }
  return days.length ? days : null
}

/**
 * Rewrites plain words into the shorthand the parser reads: "3 times a week"
 * -> "3x", "1 hour 30 min" -> "1h30", "wake up at 7" -> "wake 7", "delete gym"
 * -> "rm gym". Names keep their case.
 */
export function normalize(input: string): string {
  let s = ` ${input.trim().replace(/[,;]/g, " ").replace(/\s+/g, " ")} `

  // Lengths.
  s = s.replace(
    / (\d+) ?(?:hours?|hrs?|h) ?(?:and )?(\d+) ?(?:minutes?|mins?|m)?(?= )/gi,
    (_, h, m) => ` ${h}h${m.padStart(2, "0")}`,
  )
  s = s.replace(/ (\d+[.]\d+) ?(?:hours?|hrs?|h)(?= )/gi, (_, h) => ` ${Math.round(Number(h) * 60)}m`)
  s = s.replace(/ (\d+) ?(?:hours?|hrs?)(?= )/gi, " $1h")
  s = s.replace(/ (\d+) ?(?:minutes?|mins?)(?= )/gi, " $1m")

  // How often. "× 2" first, as the preview writes it, before "2 a week" can take the number.
  s = s.replace(/ [x×] ?(\d+)(?: ?(?:a|per|\/|each) ?(?:week|wk))?(?= )/gi, " $1x")
  s = s.replace(/ (\d+) ?(?:x|×|times?)(?: ?(?:a|per|\/|each) ?(?:week|wk))?(?= )/gi, " $1x")
  s = s.replace(/ (\d+) ?(?:a|per|\/) ?(?:week|wk)(?= )/gi, " $1x")
  s = s.replace(/ once(?: (?:a|per) week)?(?= )/gi, " 1x")
  s = s.replace(/ twice(?: (?:a|per) week)?(?= )/gi, " 2x")
  s = s.replace(/ (?:(?:every|each) ?day|daily)(?= )/gi, " daily")
  // Linking words before a number: "gym to 3x", "yoga for 45m".
  s = s.replace(/ (?:to|for|at) (?=\d)/gi, " ")

  s = s.trim()
  // Verbs, only at the start of the line.
  s = s.replace(/^(?:add|new|create) /i, "")
  s = s.replace(/^(?:change|set|make|update) /i, "")
  s = s.replace(/^(?:delete|remove|drop|del|rm) /i, "rm ")
  s = s.replace(/^(?:edit|open) /i, "edit ")
  s = s.replace(/^wake(?: up)? /i, "wake ")
  // Only before a time, so "Bedtime reading 30m" stays an activity.
  s = s.replace(/^(?:go to sleep|go to bed|bedtime|bed) (?=\d)/i, "sleep ")
  s = s.replace(/^free(?: time)? /i, "free ")
  return s
}

/**
 * The line as it would read if completed: the rest of an activity's name (or
 * a command word) after what has been typed. Null when nothing fits.
 */
export function complete(input: string, activities: Activity[]): string | null {
  if (!input.trim() || /\s$/.test(input)) return null
  const verb = /^((?:rm|remove|delete|edit)\s+)(.*)$/i.exec(input)
  const prefix = verb ? verb[1] : ""
  const typed = verb ? verb[2] : input
  if (!typed) return null
  const lower = typed.toLowerCase()
  const names = activities.map((a) => a.name)
  const editing = verb?.[1].toLowerCase().startsWith("edit")
  const pool = verb ? (editing ? [...names, "meals", "hours", "free time", "activities"] : names) : [...FUNCTIONS, ...names, ...VERBS]
  const match = pool.find((n) => n.toLowerCase().startsWith(lower) && n.length > typed.length)
  return match ? prefix + typed + match.slice(typed.length) : null
}

/** What to type next, once a line names something but gives nothing else. */
export function nextHint(input: string, activities: Activity[]): string | null {
  const s = normalize(input).toLowerCase()
  if (s === "wake" || s === "sleep") return "A TIME, E.G. 7:00"
  if (s === "free") return "A LENGTH, E.G. 2H"
  if (s === "rm") return "AN ACTIVITY"
  const found = findActivity(s, activities)
  if (found) {
    return `NOW ${describe(found)} · TYPE WHAT CHANGES, E.G. 2H 3× MTW MORNING`
  }
  return null
}

/** How an activity reads as a command, so picking one puts it on the line ready to change. */
export function commandFor(activity: Activity): string {
  return `${activity.name} ${formatDuration(activity.durationMinutes)} ${activity.sessionsPerWeek}x`
}

export function findActivity(name: string, activities: Activity[]): Activity | undefined {
  const key = name.trim().toLowerCase()
  return activities.find((a) => a.name.trim().toLowerCase() === key)
}

function span(minutes: number): string {
  return formatDuration(minutes).toUpperCase()
}

function upper(activity: Activity): string {
  return activity.name.toUpperCase()
}

function notFound(name: string, activities: Activity[]): string {
  const near = closest(name, activities)
  return `NO ${name.toUpperCase()} ON YOUR LIST${near ? `. DID YOU MEAN ${upper(near)}?` : ""}`
}

/** The activity a typo most likely meant: a prefix, or within two letters. */
function closest(name: string, activities: Activity[]): Activity | undefined {
  const key = name.trim().toLowerCase()
  if (!key) return undefined
  const prefix = activities.find((a) => a.name.toLowerCase().startsWith(key))
  if (prefix) return prefix
  let best: Activity | undefined
  let bestDistance = Infinity
  for (const a of activities) {
    const d = distance(key, a.name.toLowerCase())
    if (d < bestDistance) {
      best = a
      bestDistance = d
    }
  }
  return bestDistance <= Math.min(2, key.length - 1) ? best : undefined
}

/** Levenshtein distance. */
function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = row
  }
  return prev[b.length]
}

/** "4x", "4×", "x4", "daily". */
function parseSessions(word: string): number | null {
  const s = word.toLowerCase()
  if (s === "daily") return 7
  const m = /^(\d+)[x×]$/.exec(s) ?? /^[x×](\d+)$/.exec(s)
  return m ? Number(m[1]) : null
}

/** "7", "7:30", "0730", "7am", "11:30pm" -> "HH:MM", or null. */
export function parseClock(input: string): string | null {
  const m = /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$/.exec(input.trim().toLowerCase())
  if (!m) return null
  let h = Number(m[1])
  const min = Number(m[2] ?? 0)
  if (m[3]) {
    if (h < 1 || h > 12) return null
    h = (h % 12) + (m[3] === "pm" ? 12 : 0)
  }
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
}

function error(reply: string): CommandError {
  return { kind: "error", reply }
}
