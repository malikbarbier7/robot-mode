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
  | { kind: "view"; view: "printout" | "grid" | "today" | "binder" }
  /** Tear the sheet off: file this week in the binder; the printer stays empty. */
  | { kind: "tear" }
  /** Print a fresh sheet of the week in front of you, after it was torn off. */
  | { kind: "feed" }
  /** Send what is showing to a real printer. */
  | { kind: "print" }
  /** Shred a filed week from the binder, by its week number. */
  | { kind: "shred"; week: number }
  | { kind: "settings"; patch: { wakeTime?: string; sleepTime?: string } }
  | { kind: "display"; patch: { clock?: Clock; weekStart?: WeekStart; sound?: boolean } }
  | { kind: "shuffle" | "export" }
  /** One regular session becomes an extra of its own: the activity loses a session, the extra takes it. */
  | { kind: "split"; id: string; patch: Partial<Activity>; extra: Omit<Activity, "id"> }
  /** Take placed sessions out of this week only, as the BLOCK screen's REMOVE does. The activity stays. */
  | { kind: "skip"; blockIds: string[] }
  /** Put one placed session somewhere else and lock it there, as the BLOCK screen's MOVE does. */
  | { kind: "move"; blockId: string; day: Day; start: number }
  /** The line could mean several sessions: each option is what picking it would do. */
  | { kind: "choose"; options: { label: string; action: CommandAction }[] }
)

export type CommandError = { kind: "error"; reply: string }

/** The terminal's screens, each opened by a function. */
export type Screen = "add" | "edit" | "activities" | "hours" | "meals" | "system" | "fix" | "restart" | "reset" | "help"

/** What the command line needs to know to read a line against. */
export type CommandContext = {
  activities: Activity[]
  wakeTime?: string
  sleepTime?: string
  /** Whether the machine's sounds are on, so "sound" alone can flip them. */
  sound?: boolean
  /** The sessions placed in the week, so EDIT can find "Monday's" one. */
  sessions?: SessionRef[]
}

/** A placed session, as EDIT needs to know it: whose, which day, when. */
export type SessionRef = { id?: string; activityId: string; day: Day; start: number; end: number }

const MAX_SESSIONS = 28

/** There is no free-time setting: free time is what the activities leave. Asked for anyway, say so. */
const FREE_TIME = "FREE TIME IS WHAT YOUR ACTIVITIES LEAVE EMPTY · TO KEEP A BREAK, ADD IT: ADD BREAK 1H DAILY"

/**
 * The function row, in the order completion offers them: typing "e" means
 * EDIT before EXPORT. They come before activity names, so one letter and
 * Enter is enough to open a function.
 */
export const FUNCTIONS = ["add", "edit", "today", "tear", "feed", "shuffle", "print", "export", "grid", "list", "binder", "system", "fix", "clear", "restart", "save", "load", "help"]
/** Other command words, offered after activity names. */
const VERBS = ["wake", "sleep", "remove", "move", "meals", "hours"]
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
}

const SCREEN_NAMES: Record<Screen, string> = {
  add: "ADD AN ACTIVITY",
  edit: "EDIT",
  activities: "EDIT › ACTIVITIES",
  hours: "EDIT › HOURS",
  meals: "EDIT › MEALS",
  system: "SYSTEM",
  fix: "FIX CONFLICTS",
  restart: "RESTART",
  reset: "RESET TO TEMPLATE",
  help: "HELP",
}

function open(screen: Screen, id?: string, label = SCREEN_NAMES[screen]): CommandAction {
  return { kind: "open", screen, ...(id ? { id } : {}), preview: `OPEN ${label}`, reply: label }
}

/**
 * Reads one command line, in shorthand or in plain words:
 *   gym 1h15 4x · gym 3 times a week · add yoga 45 min twice
 *                   add Gym, or change it if it exists (either part may be left out on a change)
 *   remove gym      edit gym        wake up at 7    sleep at 11pm
 *   shuffle · export · help · 12h · 24h · mon · sun
 */
export function interpret(input: string, ctx: CommandContext): CommandAction | CommandError | null {
  const words = normalize(input).split(/\s+/).filter(Boolean)
  if (words.length === 0) return null
  const { activities } = ctx
  const [head, ...rest] = words
  const verb = head.toLowerCase()
  const arg = rest.join(" ")
  if (/^\s*(?:new|next)\s+week\s*$/i.test(input)) return interpret("tear", ctx)
  // "add …" with more after it is always about an activity, whatever word comes next ("add monday deep work").
  const explicitAdd = /^\s*(?:add|new|create)\s/i.test(input)
  if (explicitAdd) return activityLine(words, activities, true)

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
    case "tear":
    case "file":
      return { kind: "tear", preview: "TEAR OFF THE SHEET ON SHOW · FILE IT IN THE BINDER", reply: "SHEET FILED IN THE BINDER" }
    case "feed":
      return { kind: "feed", preview: "PRINT A FRESH SHEET OF THE WEEK", reply: "PRINTED" }
    case "print":
      return { kind: "print", preview: "SEND THE SHEET TO YOUR PRINTER", reply: "SENT TO THE PRINTER" }
    case "shred": {
      // "shred 39", "shred w39", "shred week 39".
      const m = /^(?:week\s*|w)?(\d{1,2})$/i.exec(arg.trim())
      if (!m) return error("SHRED WHICH WEEK? E.G. SHRED 39")
      const week = Number(m[1])
      return {
        kind: "shred",
        week,
        preview: `SHRED WEEK ${week} FROM THE BINDER · THIS CAN'T BE UNDONE`,
        reply: `WEEK ${week} SHREDDED`,
      }
    }
    case "binder":
    case "archive":
    case "history":
      return { kind: "view", view: "binder", preview: "OPEN THE BINDER OF PAST WEEKS", reply: "BINDER" }
    case "today":
    case "ticket":
      return { kind: "view", view: "today", preview: "SHOW TODAY'S TICKET", reply: "TODAY VIEW" }
    case "sound":
    case "mute":
    case "unmute": {
      const on = verb === "mute" ? false : verb === "unmute" ? true : arg === "on" ? true : arg === "off" ? false : !(ctx.sound ?? true)
      return { kind: "display", patch: { sound: on }, preview: on ? "SOUND ON" : "SOUND OFF", reply: on ? "SOUND ON" : "SOUND OFF" }
    }
    case "printout":
    case "list":
      return { kind: "view", view: "printout", preview: "SHOW THE WEEK AS A LIST", reply: "LIST VIEW" }
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
      // Only on its own: "monday deep work 1h" is an activity line.
      if (rest.length) break
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
      const time = parseClock(arg.replace(/^@/, ""))
      if (!time) return error(`${verb.toUpperCase()} NEEDS A TIME, E.G. ${verb === "wake" ? "WAKE 7:00" : "SLEEP 23:30"}`)
      const was = verb === "wake" ? ctx.wakeTime : ctx.sleepTime
      return {
        kind: "settings",
        patch: verb === "wake" ? { wakeTime: time } : { sleepTime: time },
        preview: `${verb.toUpperCase()} ${was ? `${was} → ` : ""}${time}`,
        reply: `${verb.toUpperCase()} ${time}`,
      }
    }
    case "free":
      return error(FREE_TIME)
    case "move":
      if (!arg) return error("MOVE WHICH SESSION? E.G. MOVE GYM MONDAY 10H TO 11H")
      return moveLine(rest, ctx)
    case "edit": {
      if (!arg) return open("edit")
      if (/^free( time)?$/i.test(arg)) return error(FREE_TIME)
      const target = EDIT_TARGETS[arg.toLowerCase()]
      if (target) return open(target)
      const found = findActivity(arg, activities)
      if (found) return open("activities", found.id, `EDIT › ${upper(found)}`)
      return editLine(rest, ctx)
    }
    case "rm": {
      if (!arg) return error("REMOVE WHICH ACTIVITY?")
      // As in EDIT, "20:00" names a session by its start, never a length.
      const { parent, parts } = readLine(rest.map((w) => (/^\d{1,2}:\d{2}$/.test(w) ? `@${w}` : w)), activities)
      if (!parent) return error(notFound(arg, activities))
      const extras = extrasOf(parent, activities)
      // "remove deep work monday", "remove deep work extra": one of its extra sessions, not the activity;
      // with no such extra, that day's regular session, out of this week only.
      const aboutExtra = Object.keys(parts).length > 0 || /\bextras?\b/i.test(arg)
      if (aboutExtra) {
        const match = extras.find(
          (x) =>
            (!parts.allowedDays || parts.allowedDays.every((d) => x.allowedDays?.includes(d))) &&
            (!parts.fixedAt || x.fixedAt?.start === parts.fixedAt.start) &&
            (!parts.durationMinutes || x.durationMinutes === parts.durationMinutes),
        )
        if (!match) return skipLine(parent, parts, ctx) ?? error(`NO EXTRA ${upper(parent)} SESSION LIKE THAT`)
        return {
          kind: "remove",
          id: match.id,
          preview: `REMOVE ${upper(parent)} EXTRA SESSION ${describeExtra(match)}`,
          reply: `REMOVED ${upper(parent)} ${describeExtra(match)}`,
        }
      }
      return {
        kind: "remove",
        id: parent.id,
        preview: `REMOVE ${describe(parent)}${extras.length ? ` AND ITS ${extras.length} EXTRA SESSION${extras.length > 1 ? "S" : ""}` : ""}`,
        reply: `REMOVED ${upper(parent)}`,
      }
    }
  }

  return activityLine(words, activities)
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

/** Words that only join a line together when it names an activity you have: "add an extra session of gym". */
const FILLERS = new Set(["a", "an", "the", "and", "of", "on", "every", "extra", "another", "more", "session", "sessions", "additional", "new"])

/**
 * Reads an activity line in any order: "deep work monday morning 1h @10:00"
 * and "1h @10:00 monday deep work" are the same. A name you already have is
 * found first, wherever it sits, so its words are never mistaken for days;
 * then every word that is a length, a count, days, a time of day or a start
 * time (`@`, from normalize) is taken as one. What is left is the name.
 */
function readLine(words: string[], activities: Activity[]) {
  const lower = words.map((w) => w.toLowerCase())
  // The longest name on the list that appears as consecutive words.
  let parent: Activity | undefined
  let at = -1
  let length = 0
  for (const a of activities) {
    if (a.extraOf) continue
    const tokens = a.name.toLowerCase().split(/\s+/).filter(Boolean)
    if (tokens.length <= length) continue
    for (let i = 0; i + tokens.length <= lower.length; i++) {
      if (tokens.every((t, j) => lower[i + j] === t)) {
        parent = a
        at = i
        length = tokens.length
        break
      }
    }
  }

  const parts: Parts = {}
  const rest: string[] = []
  const unknown: string[] = []
  const named = parent ? new Set<number>() : nameWords(lower)
  words.forEach((word, i) => {
    if (parent && i >= at && i < at + length) return
    if (named.has(i)) return void rest.push(word)
    const w = word.toLowerCase()
    const time = w.startsWith("@") ? parseClock(w.slice(1)) : null
    const count = parseSessions(w)
    const days = parseDays(w)
    const window = WINDOW_PRESETS.find((p) => p.label.toLowerCase() === w.replace(/s$/, ""))
    if (time && !parts.fixedAt) parts.fixedAt = { start: time }
    else if (count !== null && parts.sessionsPerWeek === undefined) parts.sessionsPerWeek = count
    // Days add up: "mon wed fri" is three days, however they are written.
    else if (days) parts.allowedDays = [...new Set([...(parts.allowedDays ?? []), ...days])].sort((a, b) => a - b)
    else if (window && !parts.window) parts.window = { start: window.start, end: window.end }
    else {
      const minutes = w.startsWith("@") ? null : parseDuration(w)
      if (minutes !== null && parts.durationMinutes === undefined) parts.durationMinutes = minutes
      else if (parent) {
        if (!FILLERS.has(w)) unknown.push(word)
      } else rest.push(word)
    }
  })
  return { parent, parts, name: parent ? parent.name : rest.join(" "), unknown }
}

/**
 * Words of a new activity's name that would otherwise read as a setting: when
 * the same kind of setting is given twice, the earlier one names the activity.
 * "daily walk 30m daily" is a walk called Daily walk, every day, not a "walk
 * daily" seven times.
 */
function nameWords(lower: string[]): Set<number> {
  // Days aren't here: they add up rather than repeat.
  const kindOf = (w: string): string | null => {
    if (w.startsWith("@") && parseClock(w.slice(1))) return "time"
    if (parseSessions(w) !== null) return "count"
    if (WINDOW_PRESETS.some((p) => p.label.toLowerCase() === w.replace(/s$/, ""))) return "window"
    if (parseDuration(w) !== null) return "length"
    return null
  }
  const kinds = lower.map(kindOf)
  const named = new Set<number>()
  kinds.forEach((kind, i) => {
    if (kind && kinds.indexOf(kind, i + 1) > i) named.add(i)
  })
  return named
}

/**
 * "surf 1h10 4x MTSaSu morning always at 06:00", in any order: adds an
 * activity, or changes one you have. With ADD, a line about one you have adds
 * to it instead: "add gym" is one more session, and "add deep work monday 1h
 * at 10:00" is an extra session of its own (`extraOf`), the regular ones untouched.
 */
function activityLine(words: string[], activities: Activity[], explicitAdd = false): CommandAction | CommandError {
  const { parent, parts, name, unknown } = readLine(words, activities)
  if (unknown.length) return error(`DIDN'T UNDERSTAND: ${unknown.join(" ").toUpperCase()}. TYPE HELP FOR WHAT GOES IN A LINE`)
  if (!name) return error("WHICH ACTIVITY? E.G. ADD SURF 1H 2×")
  if (parts.sessionsPerWeek !== undefined && (parts.sessionsPerWeek < 1 || parts.sessionsPerWeek > MAX_SESSIONS)) {
    return error(`BETWEEN 1 AND ${MAX_SESSIONS} SESSIONS A WEEK`)
  }
  if (parts.durationMinutes !== undefined && parts.durationMinutes <= 0) return error("A SESSION NEEDS A LENGTH")
  if (parts.allowedDays?.length === 7) parts.allowedDays = undefined

  if (parent && explicitAdd) return addTo(parent, parts)

  if (parent) {
    if (!Object.keys(parts).length) {
      return error(`${upper(parent)}: WHAT SHOULD CHANGE? E.G. ${upper(parent)} 2H 3× MTW MORNING`)
    }
    const patch: Partial<Activity> = { ...parts }
    // A fixed time and a preferred window answer the same question; the newer answer wins.
    if (parts.fixedAt) patch.window = undefined
    else if (parts.window) patch.fixedAt = undefined
    // Every day is no restriction at all.
    if (words.some((w) => ["daily", "any"].includes(w.toLowerCase())) && !parts.allowedDays) patch.allowedDays = undefined
    const next = { ...parent, ...patch }
    return {
      kind: "update",
      id: parent.id,
      patch,
      preview: `${upper(parent)} ${changes(parent, next).join(" · ")}`,
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
    ...(parts.allowedDays ? { allowedDays: parts.allowedDays } : {}),
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

/**
 * ADD on an activity you already have. Only a count ("add gym", "add gym
 * 2x") means more of the same sessions. Anything else (a length, days, a
 * time) describes a different session, so it becomes an extra of its own,
 * taking the rest from the activity.
 */
function addTo(parent: Activity, parts: Parts): CommandAction {
  const { sessionsPerWeek, ...shape } = parts
  if (!Object.keys(shape).length) {
    const more = sessionsPerWeek ?? 1
    const next = Math.min(MAX_SESSIONS, parent.sessionsPerWeek + more)
    return {
      kind: "update",
      id: parent.id,
      patch: { sessionsPerWeek: next },
      preview: `${upper(parent)} +${more} SESSION${more > 1 ? "S" : ""} · ${parent.sessionsPerWeek}× → ${next}×`,
      reply: `${upper(parent)} NOW ${next}×`,
    }
  }
  const extra: Omit<Activity, "id"> = {
    name: parent.name,
    extraOf: parent.id,
    durationMinutes: parts.durationMinutes ?? parent.durationMinutes,
    sessionsPerWeek: sessionsPerWeek ?? 1,
    ...(parts.allowedDays ? { allowedDays: parts.allowedDays } : parent.allowedDays ? { allowedDays: parent.allowedDays } : {}),
    ...(parts.fixedAt
      ? { fixedAt: parts.fixedAt }
      : parts.window
        ? { window: parts.window }
        : parent.fixedAt
          ? { fixedAt: { start: parent.fixedAt.start } }
          : parent.window
            ? { window: parent.window }
            : {}),
  }
  return {
    kind: "add",
    activity: extra,
    preview: `ADD ${upper(parent)} EXTRA SESSION · ${describeExtra(extra)}`,
    reply: `ADDED ${upper(parent)} ${describeExtra(extra)}`,
  }
}

/** An extra session as the terminal lists it after its activity: "+1H M AT 10:00". */
export function describeExtra(a: Omit<Activity, "id">): string {
  return [
    `+${span(a.durationMinutes)}`,
    a.sessionsPerWeek > 1 ? `${a.sessionsPerWeek}×` : "",
    a.allowedDays && a.allowedDays.length < 7 ? formatDays(a.allowedDays) : "",
    a.fixedAt ? `AT ${a.fixedAt.start}` : a.window ? windowName(a.window) : "",
  ]
    .filter(Boolean)
    .join(" ")
}

/** The extra sessions that belong to an activity. */
export function extrasOf(parent: Activity, activities: Activity[]): Activity[] {
  return activities.filter((a) => a.extraOf === parent.id)
}

const DAY_WORDS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]

function hhmm(minute: number): string {
  const m = ((minute % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
}

/**
 * "edit deep work monday 3h", "edit deep work monday 10:00 to 3h at 11:00":
 * which session (a day, and its start time when the day has several), then
 * what changes. "to" separates the two when a time could be either. Without
 * a day it changes every regular session, like a plain activity line.
 */
function editLine(input: string[], ctx: CommandContext): CommandAction | CommandError {
  const { activities } = ctx
  // In EDIT, "10:00" names a session's start (or a new one), never a 10-hour length.
  const words = input.map((w) => (/^\d{1,2}:\d{2}$/.test(w) ? `@${w}` : w))
  const split = words.findIndex((w) => w.toLowerCase() === "to")
  const left = split >= 0 ? words.slice(0, split) : words
  const { parent, parts: picked, unknown } = readLine(left, activities)
  if (!parent) return error(notFound(left.join(" "), activities))
  if (unknown.length) return error(`DIDN'T UNDERSTAND: ${unknown.join(" ").toUpperCase()}`)

  let change: Parts
  let sel: Parts
  if (split >= 0) {
    const right = readLine(words.slice(split + 1), [])
    if (right.name) return error(`DIDN'T UNDERSTAND: ${right.name.toUpperCase()}`)
    sel = picked
    change = right.parts
  } else {
    // Without "to", the day picks; a time picks only if a session starts at it, otherwise it is the new start.
    const { allowedDays, fixedAt, window, ...rest } = picked
    sel = { allowedDays }
    change = { ...rest, ...(window ? { window } : {}) }
    if (fixedAt) {
      const family = new Set([parent.id, ...extrasOf(parent, activities).map((x) => x.id)])
      const startsThere = (ctx.sessions ?? []).some(
        (s) => family.has(s.activityId) && allowedDays?.includes(s.day) && hhmm(s.start) === fixedAt.start,
      )
      if (startsThere) sel.fixedAt = fixedAt
      else change.fixedAt = fixedAt
    }
  }

  // No day: every regular session, as "deep work 2h" would.
  if (!sel.allowedDays) return activityLine(words.filter((w) => w.toLowerCase() !== "to"), activities)
  if (sel.allowedDays.length !== 1) return error("EDIT ONE DAY AT A TIME, E.G. EDIT DEEP WORK MONDAY 3H")
  const day = sel.allowedDays[0]
  const family = new Map([[parent.id, parent], ...extrasOf(parent, activities).map((x) => [x.id, x] as const)])
  let candidates = (ctx.sessions ?? [])
    .filter((s) => family.has(s.activityId) && s.day === day)
    .sort((a, b) => a.start - b.start)
  if (!candidates.length) {
    return error(`NO ${upper(parent)} SESSION ON ${DAY_WORDS[day]}. TO ADD ONE: ADD ${upper(parent)} ${DAY_WORDS[day]} ${span(parent.durationMinutes)}`)
  }
  if (sel.fixedAt) candidates = candidates.filter((s) => hhmm(s.start) === sel.fixedAt!.start)
  // A time of day narrows several down to one; with one session, it is a change instead.
  if (candidates.length > 1 && change.window) {
    const inWindow = candidates.filter((s) => hhmm(s.start) >= change.window!.start && hhmm(s.start) < change.window!.end)
    if (inWindow.length === 1) {
      candidates = inWindow
      delete change.window
    }
  }
  if (!Object.keys(change).length) return error(`${upper(parent)} ${DAY_WORDS[day]}: WHAT SHOULD CHANGE? E.G. 3H OR AT 11:00`)

  const options = candidates.map((s) => {
    const owner = family.get(s.activityId)!
    const label = `${hhmm(s.start)} ${span(s.end - s.start)}${owner.extraOf ? " EXTRA" : ""}`
    return { label, action: editSession(parent, owner, s, change) }
  })
  if (options.length === 1) return options[0].action
  const list = options.map((o, i) => `[${i + 1}] ${o.label}`).join(" · ")
  return {
    kind: "choose",
    options,
    preview: `${upper(parent)} HAS ${options.length} SESSIONS ON ${DAY_WORDS[day]} · ${list} · WHICH?`,
    reply: `${upper(parent)} ${DAY_WORDS[day]}: WHICH SESSION? ${list}`,
  }
}

/** What editing one placed session does: an extra changes; a regular one becomes an extra of its own. */
function editSession(parent: Activity, owner: Activity, session: SessionRef, change: Parts): CommandAction {
  const where = `${upper(parent)} ${DAY_WORDS[session.day].slice(0, 3)} ${hhmm(session.start)}`
  const when: Partial<Activity> = change.fixedAt
    ? { fixedAt: change.fixedAt, window: undefined }
    : change.window
      ? { window: change.window, fixedAt: undefined }
      : {}
  const length = change.durationMinutes ?? owner.durationMinutes
  const shown = [
    change.durationMinutes !== undefined && change.durationMinutes !== owner.durationMinutes
      ? `${span(owner.durationMinutes)} → ${span(change.durationMinutes)}`
      : "",
    change.fixedAt ? `→ AT ${change.fixedAt.start}` : change.window ? `→ ${windowName(change.window)}` : "",
  ]
    .filter(Boolean)
    .join(" · ")

  if (owner.extraOf || parent.sessionsPerWeek === 1) {
    // Already a session of its own (or the only one): change it where it is.
    const patch: Partial<Activity> = {
      durationMinutes: length,
      ...when,
      ...(owner.extraOf ? {} : { allowedDays: [session.day] }),
    }
    return { kind: "update", id: owner.id, patch, preview: `${where} · ${shown || "NO CHANGE"}`, reply: `CHANGED ${where}` }
  }

  // A regular session can't change alone: it leaves the regular ones and becomes an extra, kept at its time.
  const extra: Omit<Activity, "id"> = {
    name: parent.name,
    extraOf: parent.id,
    durationMinutes: length,
    sessionsPerWeek: 1,
    allowedDays: [session.day],
    ...(change.fixedAt ? { fixedAt: change.fixedAt } : change.window ? { window: change.window } : { fixedAt: { start: hhmm(session.start) } }),
  }
  const others = parent.sessionsPerWeek - 1
  return {
    kind: "split",
    id: parent.id,
    patch: { sessionsPerWeek: others },
    extra,
    preview: `${where} · ${shown || "NO CHANGE"} · THIS SESSION ONLY, THE OTHER ${others} STAY ${span(parent.durationMinutes)}`,
    reply: `CHANGED ${where} · NOW AN EXTRA SESSION`,
  }
}

/** In a MOVE line every hour is a time: "10h", "10h30", "10:00", "10", "7pm", "@10". Null if the word isn't one. */
function asTime(word: string): string | null {
  const w = word.toLowerCase().replace(/^@/, "")
  return /^\d{1,2}(?:[:h.]\d{2}|h)?\s*(?:am|pm)?$/.test(w) ? parseClock(w) : null
}

/**
 * "remove walk wednesday": that day's session of a regular activity, out of
 * this week only (CLEAR EDITS brings it back). Null when the line names more
 * than days and a start, so the caller can say what it couldn't match.
 */
function skipLine(parent: Activity, parts: Parts, ctx: CommandContext): CommandAction | CommandError | null {
  const { allowedDays, fixedAt, ...other } = parts
  if (!allowedDays || Object.keys(other).length) return null
  let sessions = (ctx.sessions ?? []).filter((x) => x.activityId === parent.id && allowedDays.includes(x.day) && x.id)
  if (fixedAt) sessions = sessions.filter((x) => hhmm(x.start) === fixedAt.start)
  const when = allowedDays.length === 1 ? DAY_WORDS[allowedDays[0]] : allowedDays.map((d) => DAY_WORDS[d].slice(0, 3)).join(" ")
  if (!sessions.length) return error(`NO ${upper(parent)} SESSION ON ${when}${fixedAt ? ` AT ${fixedAt.start}` : ""} THIS WEEK`)
  const skip = (picked: SessionRef[]): CommandAction => {
    const days = [...new Set(picked.map((x) => DAY_WORDS[x.day].slice(0, 3)))].join(" ")
    return {
      kind: "skip",
      blockIds: picked.map((x) => x.id!),
      preview: `REMOVE ${upper(parent)} ${days}${picked.length === 1 ? ` ${hhmm(picked[0].start)}` : ` · ${picked.length} SESSIONS`} FROM THIS WEEK`,
      note: "THE ACTIVITY STAYS · CLEAR EDITS BRINGS IT BACK",
      reply: `REMOVED ${upper(parent)} ${days} FROM THIS WEEK`,
    }
  }
  // Two sessions on the one day named: which one is the question, as MOVE asks it.
  if (allowedDays.length === 1 && !fixedAt && sessions.length > 1) {
    const options = sessions
      .sort((a, b) => a.start - b.start)
      .map((x) => ({ label: `${hhmm(x.start)} ${span(x.end - x.start)}`, action: skip([x]) }))
    const list = options.map((o, i) => `[${i + 1}] ${o.label}`).join(" · ")
    return {
      kind: "choose",
      options,
      preview: `${upper(parent)} HAS ${options.length} SESSIONS ON ${when} · ${list} · WHICH?`,
      reply: `${upper(parent)} ${when}: WHICH SESSION? ${list}`,
    }
  }
  return skip(sessions)
}

/**
 * "move gym monday 10h to 11h", "move gym monday to tuesday", "move deep work
 * monday 10:00 to wednesday 9am": which session (a day, and its start when the
 * day has several), then where it goes. Every hour here is a time, never a
 * length. It does what the BLOCK screen's MOVE does: locks the session there.
 */
function moveLine(words: string[], ctx: CommandContext): CommandAction | CommandError {
  const { activities } = ctx
  const split = words.findIndex((w) => w.toLowerCase() === "to")
  if (split < 0) return error("MOVE … TO A TIME OR A DAY, E.G. MOVE GYM MONDAY 10H TO 11H")

  // Which session: the activity, a day, maybe its start.
  const left = words.slice(0, split).map((w) => (asTime(w) ? `@${asTime(w)}` : w))
  const { parent, parts, unknown } = readLine(left, activities)
  if (!parent) return error(notFound(words.slice(0, split).join(" "), activities))
  const stray = [...unknown, ...(parts.durationMinutes || parts.sessionsPerWeek || parts.window ? ["?"] : [])]
  if (stray.length) return error("MOVE NAMES A SESSION BY ITS DAY AND START, E.G. MOVE GYM MONDAY 10H TO 11H")
  if (!parts.allowedDays || parts.allowedDays.length !== 1) return error(`WHICH DAY'S ${upper(parent)}? E.G. MOVE ${upper(parent)} MONDAY TO 11H`)
  const day = parts.allowedDays[0]

  // Where it goes: a time, a day, or both.
  let toDay: Day | undefined
  let toTime: string | undefined
  for (const w of words.slice(split + 1)) {
    const time = asTime(w)
    const days = parseDays(w)
    if (time && !toTime) toTime = time
    else if (days?.length === 1 && toDay === undefined) toDay = days[0]
    else if (!["at", "on", "the"].includes(w.toLowerCase())) return error(`DIDN'T UNDERSTAND: ${w.toUpperCase()}. MOVE … TO 11H, TO TUESDAY, OR TO TUESDAY 11H`)
  }
  if (toDay === undefined && !toTime) return error("MOVE IT TO WHAT? A TIME, A DAY, OR BOTH")

  const family = new Map([[parent.id, parent], ...extrasOf(parent, activities).map((x) => [x.id, x] as const)])
  let candidates = (ctx.sessions ?? []).filter((s) => family.has(s.activityId) && s.day === day).sort((a, b) => a.start - b.start)
  if (!candidates.length) return error(`NO ${upper(parent)} SESSION ON ${DAY_WORDS[day]}`)
  if (parts.fixedAt) {
    candidates = candidates.filter((s) => hhmm(s.start) === parts.fixedAt!.start)
    if (!candidates.length) return error(`NO ${upper(parent)} SESSION STARTS AT ${parts.fixedAt.start} ON ${DAY_WORDS[day]}`)
  }

  const results = candidates.map((s) => {
    const owner = family.get(s.activityId)!
    const label = `${hhmm(s.start)} ${span(s.end - s.start)}${owner.extraOf ? " EXTRA" : ""}`
    return { label, result: moveSession(parent, s, toDay, toTime, ctx) }
  })
  const options = results.flatMap(({ label, result }) => (result.kind === "error" ? [] : [{ label, action: result }]))
  if (!options.length) return results[0].result
  if (options.length === 1) return options[0].action
  const list = options.map((o, i) => `[${i + 1}] ${o.label}`).join(" · ")
  return {
    kind: "choose",
    options,
    preview: `${upper(parent)} HAS ${options.length} SESSIONS ON ${DAY_WORDS[day]} · ${list} · WHICH?`,
    reply: `${upper(parent)} ${DAY_WORDS[day]}: WHICH SESSION? ${list}`,
  }
}

/** Where one session lands: the new day and/or start, refused when it wouldn't fit in the waking day. */
function moveSession(parent: Activity, s: SessionRef, toDay: Day | undefined, toTime: string | undefined, ctx: CommandContext): CommandAction | CommandError {
  const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
  const length = s.end - s.start
  const day = toDay ?? s.day
  let start = toTime ? minutes(toTime) : s.start
  if (ctx.wakeTime && ctx.sleepTime) {
    const wake = minutes(ctx.wakeTime)
    let sleep = minutes(ctx.sleepTime)
    if (sleep <= wake) sleep += 1440
    // Past midnight, on a day that ends after midnight, still belongs to that day.
    if (start < wake && sleep > 1440) start += 1440
    if (start < wake || start + length > sleep) {
      return error(`${upper(parent)} HAS TO FIT BETWEEN ${ctx.wakeTime} AND ${ctx.sleepTime}`)
    }
  }
  const from = `${DAY_WORDS[s.day].slice(0, 3)} ${hhmm(s.start)}`
  const to = `${toDay !== undefined ? `${DAY_WORDS[day].slice(0, 3)} ` : ""}${hhmm(start)}`
  return {
    kind: "move",
    blockId: s.id ?? "",
    day,
    start,
    preview: `MOVE ${upper(parent)} ${from} → ${to}`,
    note: "LOCKED THERE · CLEAR EDITS UNDOES IT",
    reply: `MOVED ${upper(parent)} TO ${DAY_WORDS[day].slice(0, 3)} ${hhmm(start)} · LOCKED`,
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

/** Days written out: "monday", "mon", "mondays". */
const DAY_NAMES = [
  ["monday", "mon"],
  ["tuesday", "tue", "tues"],
  ["wednesday", "wed"],
  ["thursday", "thu", "thur", "thurs"],
  ["friday", "fri"],
  ["saturday", "sat"],
  ["sunday", "sun"],
]

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
 * the next day it can be, so "TT" is Tuesday and Thursday. Also a day's name
 * ("monday", "mon"), "weekdays" and "weekends". Null unless the whole word is days.
 */
export function parseDays(word: string): Day[] | null {
  const s = word.toLowerCase()
  if (s === "weekdays") return [0, 1, 2, 3, 4]
  if (s === "weekends" || s === "weekend") return [5, 6]
  const named = DAY_NAMES.findIndex((names) => names.includes(s.replace(/s$/, "")))
  if (named >= 0) return [named as Day]
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

  // Start times, marked "@" so they are never read as lengths: "at 10h00", "starting at 10", "from 7am".
  const clock = "(\\d{1,2}(?:[:h.]\\d{2})?(?: ?[ap]m)?|\\d{1,2}h)"
  s = s.replace(new RegExp(` (?:(?:always|starting|start|beginning) )?(?:at|from) ${clock}(?= )`, "gi"), (_, t) => ` @${t.replace(/ /g, "")}`)
  s = s.replace(new RegExp(` (?:always|starting|start) ${clock}(?= )`, "gi"), (_, t) => ` @${t.replace(/ /g, "")}`)

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
  // Linking words before a number: "gym to 3x", "yoga for 45m". In EDIT, "to" separates which session from what changes.
  s = s.replace(/^\s*(?:edit|open|move)\s/i.test(input) ? / for (?=\d)/gi : / (?:to|for) (?=\d)/gi, " ")

  s = s.trim()
  // Verbs, only at the start of the line.
  s = s.replace(/^(?:add|new|create) /i, "")
  s = s.replace(/^(?:change|set|make|update) /i, "")
  s = s.replace(/^(?:delete|remove|drop|del|rm) /i, "rm ")
  s = s.replace(/^(?:edit|open) /i, "edit ")
  s = s.replace(/^wake(?: up)? /i, "wake ")
  // Only before a time, so "Bedtime reading 30m" stays an activity.
  s = s.replace(/^(?:go to sleep|go to bed|bedtime|bed) (?=@?\d)/i, "sleep ")
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
  const names = activities.filter((a) => !a.extraOf).map((a) => a.name)
  const editing = verb?.[1].toLowerCase().startsWith("edit")
  const pool = verb ? (editing ? [...names, "meals", "hours", "activities"] : names) : [...FUNCTIONS, ...names, ...VERBS]
  const match = pool.find((n) => n.toLowerCase().startsWith(lower) && n.length > typed.length)
  return match ? prefix + typed + match.slice(typed.length) : null
}

/** What to type next, once a line names something but gives nothing else. */
export function nextHint(input: string, activities: Activity[]): string | null {
  const s = normalize(input).toLowerCase()
  if (s === "wake" || s === "sleep") return "A TIME, E.G. 7:00"
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
  return activities.find((a) => !a.extraOf && a.name.trim().toLowerCase() === key)
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
  const m = /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?$/.exec(input.trim().toLowerCase().replace(/^(\d{1,2})[h.](\d{2})?/, (_, h, mm) => (mm ? `${h}:${mm}` : h)))
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
