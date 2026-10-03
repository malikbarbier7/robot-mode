import { describe, expect, it } from "vitest"
import { commandFor, complete, describe as describeActivity, formatDays, interpret, nextHint, normalize, parseClock, parseDays } from "./command"
import type { Activity } from "./types"
import { LANDING_LINES } from "./landing"

const gym: Activity = { id: "gym", name: "Gym", durationMinutes: 240, sessionsPerWeek: 4 }
const ctx = { activities: [gym], wakeTime: "07:30", sleepTime: "23:30" }

describe("interpret", () => {
  it("adds a new activity from a name, a length and a count", () => {
    expect(interpret("deep work 1h15 4x", ctx)).toMatchObject({
      kind: "add",
      activity: { name: "deep work", durationMinutes: 75, sessionsPerWeek: 4 },
    })
  })

  it("defaults a new activity to once a week, and reads the parts in either order", () => {
    expect(interpret("read 30m", ctx)).toMatchObject({ kind: "add", activity: { sessionsPerWeek: 1 } })
    expect(interpret("read 3x 30m", ctx)).toMatchObject({ kind: "add", activity: { durationMinutes: 30, sessionsPerWeek: 3 } })
    expect(interpret("read 30m daily", ctx)).toMatchObject({ kind: "add", activity: { sessionsPerWeek: 7 } })
  })

  it("changes an existing activity, whatever the case, with only the parts given", () => {
    expect(interpret("GYM 3x", ctx)).toMatchObject({ kind: "update", id: "gym", patch: { sessionsPerWeek: 3 } })
    expect(interpret("gym 1h30", ctx)).toMatchObject({ kind: "update", id: "gym", patch: { durationMinutes: 90 } })
  })

  it("previews what Enter will do", () => {
    expect(interpret("gym 3x", ctx)).toMatchObject({ preview: "GYM 4× → 3×" })
    expect(interpret("wake 7", ctx)).toMatchObject({ preview: "WAKE 07:30 → 07:00" })
    expect(interpret("yoga 45m 2x", ctx)).toMatchObject({ preview: "ADD YOGA 45M 2×" })
  })

  it("removes and opens activities by name", () => {
    expect(interpret("rm gym", ctx)).toMatchObject({ kind: "remove", id: "gym" })
    expect(interpret("edit Gym", ctx)).toMatchObject({ kind: "open", screen: "activities", id: "gym" })
    expect(interpret("rm yoga", ctx)).toMatchObject({ kind: "error" })
  })

  it("sets the day's hours and free time", () => {
    expect(interpret("wake 7", ctx)).toMatchObject({ kind: "settings", patch: { wakeTime: "07:00" } })
    expect(interpret("sleep 11:30pm", ctx)).toMatchObject({ kind: "settings", patch: { sleepTime: "23:30" } })
    // Free time isn't a setting: the terminal says how to keep some instead.
    expect(interpret("free 90", ctx)).toMatchObject({ kind: "error", reply: expect.stringContaining("ADD BREAK 1H DAILY") })
    expect(interpret("wake soon", ctx)).toMatchObject({ kind: "error" })
  })

  it("understands plain words", () => {
    expect(interpret("gym 3 times a week", ctx)).toMatchObject({ kind: "update", patch: { sessionsPerWeek: 3 } })
    expect(interpret("change gym to 90 min", ctx)).toMatchObject({ kind: "update", patch: { durationMinutes: 90 } })
    expect(interpret("add yoga 1 hour 30 twice", ctx)).toMatchObject({
      kind: "add",
      activity: { name: "yoga", durationMinutes: 90, sessionsPerWeek: 2 },
    })
    expect(interpret("read for 1.5 hours every day", ctx)).toMatchObject({
      kind: "add",
      activity: { durationMinutes: 90, sessionsPerWeek: 7 },
    })
    expect(interpret("delete gym", ctx)).toMatchObject({ kind: "remove" })
    expect(interpret("wake up at 7am", ctx)).toMatchObject({ patch: { wakeTime: "07:00" } })
    expect(interpret("go to bed at 11pm", ctx)).toMatchObject({ patch: { sleepTime: "23:00" } })
    expect(interpret("free time 2 hours a day", ctx)).toMatchObject({ kind: "error" })
  })

  it("adds with defaults as soon as it is asked to add", () => {
    expect(interpret("add surf", ctx)).toMatchObject({
      kind: "add",
      activity: { name: "surf", durationMinutes: 60, sessionsPerWeek: 1 },
      preview: "ADD SURF 1H 1×",
      note: "OPTIONAL: MTWTFSaSu · MORNING · ALWAYS AT 07:00",
    })
    expect(interpret("add surf 3 times", ctx)).toMatchObject({ activity: { durationMinutes: 60, sessionsPerWeek: 3 } })
    // ADD on an activity you have: one more of the same session.
    expect(interpret("add gym", ctx)).toMatchObject({ kind: "update", patch: { sessionsPerWeek: 5 } })
    // Without "add", a lone new name is still a question, not an addition.
    expect(interpret("surf", ctx)).toMatchObject({ kind: "error", reply: expect.stringContaining("ADD SURF") })
  })

  it("takes days, a time of day and a fixed time", () => {
    const line = interpret("surf 1h10 4x MTSaSu morning", ctx)
    expect(line).toMatchObject({
      kind: "add",
      activity: {
        name: "surf",
        durationMinutes: 70,
        sessionsPerWeek: 4,
        allowedDays: [0, 1, 5, 6],
        window: { start: "06:00", end: "12:00" },
      },
      preview: "ADD SURF 1H10 4× MTSaSu MORNING",
    })
    expect(interpret("surf 1h10 4x MTSaSu always at 06:00", ctx)).toMatchObject({
      activity: { fixedAt: { start: "06:00" } },
      preview: "ADD SURF 1H10 4× MTSaSu ALWAYS AT 06:00",
    })
    expect(interpret("gym TT evening", ctx)).toMatchObject({
      kind: "update",
      patch: { allowedDays: [1, 3], window: { start: "18:00", end: "23:00" }, fixedAt: undefined },
      preview: "GYM ANY DAY → TT · ANY TIME → EVENING",
    })
  })

  it("reads back what it writes", () => {
    const line = describeActivity({
      name: "Surf",
      durationMinutes: 70,
      sessionsPerWeek: 4,
      allowedDays: [0, 1, 5, 6],
      fixedAt: { start: "06:00" },
    })
    expect(interpret(line, ctx)).toMatchObject({
      kind: "add",
      activity: { durationMinutes: 70, sessionsPerWeek: 4, allowedDays: [0, 1, 5, 6], fixedAt: { start: "06:00" } },
    })
  })

  it("reads a line in any order", () => {
    const deep: Activity = { id: "deep-work", name: "Deep work", durationMinutes: 180, sessionsPerWeek: 4 }
    const list = { ...ctx, activities: [gym, deep] }
    const lines = [
      "add deep work monday morning 1h starting at 10h00",
      "add 1h starting at 10h00 monday deep work",
      "add monday deep work at 10:00 1h",
    ]
    for (const line of lines) {
      expect(interpret(line, list)).toMatchObject({
        kind: "add",
        activity: { name: "Deep work", extraOf: "deep-work", durationMinutes: 60, sessionsPerWeek: 1, allowedDays: [0], fixedAt: { start: "10:00" } },
      })
    }
    // A new activity reads in any order too.
    expect(interpret("add 2h tuesday yoga evening", ctx)).toMatchObject({
      kind: "add",
      activity: { name: "yoga", durationMinutes: 120, allowedDays: [1], window: { start: "18:00", end: "23:00" } },
    })
  })

  it("adds to an activity you have: more sessions, or an extra one of its own", () => {
    const deep: Activity = { id: "deep-work", name: "Deep work", durationMinutes: 180, sessionsPerWeek: 4 }
    const list = { ...ctx, activities: [deep] }
    expect(interpret("add deep work 2x", list)).toMatchObject({ kind: "update", patch: { sessionsPerWeek: 6 } })
    expect(interpret("add an extra session of deep work on friday", list)).toMatchObject({
      kind: "add",
      // What isn't said is taken from the activity.
      activity: { extraOf: "deep-work", durationMinutes: 180, allowedDays: [4] },
      preview: "ADD DEEP WORK EXTRA SESSION · +3H F",
    })
    // Without ADD, the same words change the regular sessions.
    expect(interpret("deep work monday 1h", list)).toMatchObject({ kind: "update", patch: { allowedDays: [0], durationMinutes: 60 } })
  })

  it("removes an extra session, or the activity with its extras", () => {
    const deep: Activity = { id: "deep-work", name: "Deep work", durationMinutes: 180, sessionsPerWeek: 4 }
    const extra: Activity = { ...deep, id: "deep-work-2", extraOf: "deep-work", durationMinutes: 60, sessionsPerWeek: 1, allowedDays: [0], fixedAt: { start: "10:00" } }
    const list = { ...ctx, activities: [deep, extra] }
    expect(interpret("remove deep work monday", list)).toMatchObject({ kind: "remove", id: "deep-work-2" })
    expect(interpret("remove deep work extra", list)).toMatchObject({ kind: "remove", id: "deep-work-2" })
    expect(interpret("remove deep work", list)).toMatchObject({ kind: "remove", id: "deep-work", preview: expect.stringContaining("1 EXTRA SESSION") })
    expect(interpret("remove deep work friday", list)).toMatchObject({ kind: "error" })
  })

  it("refuses words it can't place in a line about an activity you have", () => {
    expect(interpret("gym 3x banana", ctx)).toMatchObject({ kind: "error", reply: expect.stringContaining("BANANA") })
  })

  it("keeps the old start-time forms working", () => {
    expect(interpret("wake up at 7am", ctx)).toMatchObject({ patch: { wakeTime: "07:00" } })
    expect(interpret("go to bed at 11pm", ctx)).toMatchObject({ patch: { sleepTime: "23:00" } })
    expect(interpret("surf 1h always at 06:00", ctx)).toMatchObject({ activity: { fixedAt: { start: "06:00" } } })
  })

  describe("editing one session", () => {
    const deep: Activity = { id: "deep-work", name: "Deep work", durationMinutes: 180, sessionsPerWeek: 4 }
    const extra: Activity = { ...deep, id: "deep-work-2", extraOf: "deep-work", durationMinutes: 60, sessionsPerWeek: 1, allowedDays: [0], fixedAt: { start: "10:00" } }
    const sessions = [
      { activityId: "deep-work-2", day: 0 as const, start: 600, end: 660 },
      { activityId: "deep-work", day: 0 as const, start: 885, end: 1065 },
      { activityId: "deep-work", day: 1 as const, start: 885, end: 1065 },
    ]
    const both = { ...ctx, activities: [deep, extra], sessions }

    it("splits a regular session into an extra, kept at its time", () => {
      expect(interpret("edit deep work tuesday 2h", both)).toMatchObject({
        kind: "split",
        id: "deep-work",
        patch: { sessionsPerWeek: 3 },
        extra: { extraOf: "deep-work", durationMinutes: 120, allowedDays: [1], fixedAt: { start: "14:45" } },
        preview: "DEEP WORK TUE 14:45 · 3H → 2H · THIS SESSION ONLY, THE OTHER 3 STAY 3H",
      })
    })

    it("asks which one when a day has several", () => {
      const action = interpret("edit deep work monday 3h", both)
      expect(action).toMatchObject({ kind: "choose", preview: expect.stringContaining("[1] 10:00 1H EXTRA · [2] 14:45 3H") })
      if (action?.kind !== "choose") throw new Error("expected a choice")
      expect(action.options[0].action).toMatchObject({ kind: "update", id: "deep-work-2", patch: { durationMinutes: 180 } })
      expect(action.options[1].action).toMatchObject({ kind: "split" })
    })

    it("picks by the start time, or by the time of day", () => {
      expect(interpret("edit deep work monday 10:00 3h", both)).toMatchObject({ kind: "update", id: "deep-work-2", patch: { durationMinutes: 180 } })
      expect(interpret("edit deep work monday morning 3h", both)).toMatchObject({ kind: "update", id: "deep-work-2" })
      expect(interpret("edit deep work monday afternoon 2h", both)).toMatchObject({ kind: "split" })
    })

    it("reads a time after TO as the new start", () => {
      expect(interpret("edit deep work monday 10:00 to 2h at 11:00", both)).toMatchObject({
        kind: "update",
        id: "deep-work-2",
        patch: { durationMinutes: 120, fixedAt: { start: "11:00" } },
      })
      // A time no session starts at is a new start too.
      expect(interpret("edit deep work tuesday at 16:00", both)).toMatchObject({ kind: "split", extra: { fixedAt: { start: "16:00" } } })
    })

    it("says so when the day has none, or nothing changes", () => {
      expect(interpret("edit deep work friday 2h", both)).toMatchObject({ kind: "error", reply: expect.stringContaining("NO DEEP WORK SESSION ON FRIDAY") })
      expect(interpret("edit deep work tuesday", both)).toMatchObject({ kind: "error", reply: expect.stringContaining("WHAT SHOULD CHANGE") })
    })

    it("without a day, changes every regular session; the name alone opens the screen", () => {
      expect(interpret("edit deep work 2h", both)).toMatchObject({ kind: "update", id: "deep-work", patch: { durationMinutes: 120 } })
      expect(interpret("edit deep work", both)).toMatchObject({ kind: "open", screen: "activities", id: "deep-work" })
    })
  })

  describe("moving one session", () => {
    const deep: Activity = { id: "deep-work", name: "Deep work", durationMinutes: 180, sessionsPerWeek: 4 }
    const extra: Activity = { ...deep, id: "deep-work-2", extraOf: "deep-work", durationMinutes: 60, sessionsPerWeek: 1, allowedDays: [0], fixedAt: { start: "10:00" } }
    const sessions = [
      { id: "deep-work-2#0", activityId: "deep-work-2", day: 0 as const, start: 600, end: 660 },
      { id: "deep-work#0", activityId: "deep-work", day: 0 as const, start: 885, end: 1065 },
      { id: "deep-work#1", activityId: "deep-work", day: 1 as const, start: 885, end: 1065 },
    ]
    const both = { ...ctx, activities: [deep, extra], sessions }

    it("reads every hour as a time, however it is written", () => {
      for (const line of ["move deep work monday 10h to 11h", "move deep work monday 10:00 to 11:00", "move deep work monday at 10 to 11am"]) {
        expect(interpret(line, both)).toMatchObject({ kind: "move", blockId: "deep-work-2#0", day: 0, start: 660, preview: "MOVE DEEP WORK MON 10:00 → 11:00" })
      }
    })

    it("moves to another day, keeping the time, or to both", () => {
      expect(interpret("move deep work tuesday to friday", both)).toMatchObject({ kind: "move", blockId: "deep-work#1", day: 4, start: 885 })
      expect(interpret("move deep work tuesday to friday 9h", both)).toMatchObject({ day: 4, start: 540, preview: "MOVE DEEP WORK TUE 14:45 → FRI 09:00" })
    })

    it("asks which when the day has several and no start is given", () => {
      expect(interpret("move deep work monday to 18h", both)).toMatchObject({ kind: "choose" })
    })

    it("refuses what can't work", () => {
      expect(interpret("move deep work monday 9h to 11h", both)).toMatchObject({ kind: "error", reply: expect.stringContaining("STARTS AT 09:00") })
      expect(interpret("move deep work tuesday to 22h", both)).toMatchObject({ kind: "error", reply: expect.stringContaining("HAS TO FIT") })
      expect(interpret("move deep work monday 10h", both)).toMatchObject({ kind: "error", reply: expect.stringContaining("TO A TIME OR A DAY") })
      expect(interpret("move deep work to 11h", both)).toMatchObject({ kind: "error", reply: expect.stringContaining("WHICH DAY") })
    })
  })

  it("reads the count the way the preview writes it", () => {
    expect(interpret("surf 1h × 2 a week", ctx)).toMatchObject({ activity: { durationMinutes: 60, sessionsPerWeek: 2 } })
    expect(interpret("surf 1h x 2", ctx)).toMatchObject({ activity: { sessionsPerWeek: 2 } })
  })

  it("keeps names that only look like commands", () => {
    expect(interpret("Bedtime reading 30m", ctx)).toMatchObject({ kind: "add", activity: { name: "Bedtime reading" } })
  })

  it("suggests the activity a typo meant", () => {
    expect(interpret("gim 3x", ctx)).toMatchObject({ kind: "error", reply: expect.stringContaining("DID YOU MEAN GYM") })
    expect(interpret("rm gmy", ctx)).toMatchObject({ kind: "error", reply: expect.stringContaining("DID YOU MEAN GYM") })
  })

  it("opens the terminal's functions", () => {
    expect(interpret("add", ctx)).toMatchObject({ kind: "open", screen: "add" })
    expect(interpret("edit", ctx)).toMatchObject({ kind: "open", screen: "edit" })
    expect(interpret("edit meals", ctx)).toMatchObject({ kind: "open", screen: "meals" })
    expect(interpret("edit free time", ctx)).toMatchObject({ kind: "error", reply: expect.stringContaining("ADD BREAK") })
    expect(interpret("system", ctx)).toMatchObject({ kind: "open", screen: "system" })
    expect(interpret("restart", ctx)).toMatchObject({ kind: "open", screen: "restart" })
    expect(interpret("clear", ctx)?.kind).toBe("clear")
    expect(interpret("help", ctx)).toMatchObject({ kind: "open", screen: "help" })
    expect(interpret("today", ctx)).toMatchObject({ kind: "view", view: "today" })
    expect(interpret("tear", ctx)?.kind).toBe("tear")
    expect(interpret("new week", ctx)?.kind).toBe("tear")
    expect(interpret("print", ctx)?.kind).toBe("print")
    // FEED was the empty printer's key; printing the screen is what fills it now.
    expect(interpret("feed", ctx)?.kind).toBe("print")
    expect(interpret("backup", ctx)?.kind).toBe("backup")
    expect(interpret("screen", ctx)).toMatchObject({ kind: "view", view: "screen" })
    expect(complete("p", [gym])).toBe("print")
    expect(interpret("screen time 1h", ctx)).toMatchObject({ kind: "add", activity: { name: "screen time" } })
    expect(interpret("draft essay 2h", ctx)).toMatchObject({ kind: "add", activity: { name: "draft essay" } })
    expect(interpret("binder", ctx)).toMatchObject({ kind: "view", view: "binder" })
    for (const line of ["shred 39", "shred w39", "shred week 39"]) expect(interpret(line, ctx)).toMatchObject({ kind: "shred", week: 39 })
    expect(interpret("shred", ctx)).toMatchObject({ kind: "error" })
    // A new activity that only starts with "new" is still an activity.
    expect(interpret("new week review 1h", ctx)).toMatchObject({ kind: "add", activity: { name: "week review" } })
    expect(interpret("mute", ctx)).toMatchObject({ kind: "display", patch: { sound: false } })
    expect(interpret("sound", { ...ctx, sound: false })).toMatchObject({ patch: { sound: true } })
    expect(complete("t", [gym])).toBe("today")
    expect(complete("h", [gym])).toBe("help")
    expect(interpret("grid", ctx)).toMatchObject({ kind: "view", view: "grid" })
    expect(interpret("printout", ctx)).toMatchObject({ kind: "view", view: "printout" })
  })

  it("understands every line the landing page shows", () => {
    const sessions = [{ id: "gym#0", activityId: "gym", day: 0 as const, start: 1080, end: 1155 }]
    const withSessions = { ...ctx, sessions }
    expect(interpret("gym 1h15 4x", { ...ctx, activities: [] })).toMatchObject({ kind: "add", activity: { name: "gym", durationMinutes: 75, sessionsPerWeek: 4 } })
    expect(interpret("move gym mon to tue", withSessions)).toMatchObject({ kind: "move", day: 1 })
    expect(interpret("move gym monday to tuesday", withSessions)).toMatchObject({ kind: "move", day: 1 })
    expect(interpret("shuffle", ctx)?.kind).toBe("shuffle")
    expect(interpret("export", ctx)?.kind).toBe("export")
    for (const line of LANDING_LINES) {
      const action = interpret(line, withSessions)
      expect(action?.kind, `"${line}"`).toBeDefined()
      expect(action?.kind, `"${line}" → ${action && "reply" in action ? action.reply : ""}`).not.toBe("error")
    }
  })

  it("locks and unlocks sessions by day and start", () => {
    const sessions = [
      { id: "gym#0", activityId: "gym", day: 0 as const, start: 600, end: 660 },
      { id: "gym#1", activityId: "gym", day: 2 as const, start: 1080, end: 1140, locked: true },
      { id: "gym#2", activityId: "gym", day: 2 as const, start: 1200, end: 1260 },
    ]
    const withSessions = { ...ctx, sessions }
    expect(interpret("lock gym monday", withSessions)).toMatchObject({ kind: "lock", locked: true, blockIds: ["gym#0"] })
    expect(interpret("unlock gym wednesday 18:00", withSessions)).toMatchObject({ kind: "lock", locked: false, blockIds: ["gym#1"] })
    // Every session of it, when no day is named.
    expect(interpret("lock gym", withSessions)).toMatchObject({ kind: "lock", blockIds: ["gym#0", "gym#1", "gym#2"] })
    // Two on the day named: which one is asked.
    expect(interpret("lock gym wednesday", withSessions)).toMatchObject({ kind: "choose" })
    expect(interpret("lock gym friday", withSessions)).toMatchObject({ kind: "error" })
    expect(interpret("lock", withSessions)).toMatchObject({ kind: "error" })
  })

  it("knows the machine's own commands", () => {
    expect(interpret("shuffle", ctx)?.kind).toBe("shuffle")
    expect(interpret("12h", ctx)).toMatchObject({ kind: "display", patch: { clock: "12h" } })
    expect(interpret("sun", ctx)).toMatchObject({ kind: "display", patch: { weekStart: "sunday" } })
  })

  it("refuses what it can't use", () => {
    expect(interpret("   ", ctx)).toBeNull()
    expect(interpret("yoga", ctx)).toMatchObject({ kind: "error" })
    expect(interpret("gym", ctx)).toMatchObject({ kind: "error" })
    expect(interpret("gym 40x", ctx)).toMatchObject({ kind: "error" })
  })

  describe("removing one session from this week", () => {
    const walk: Activity = { id: "walk", name: "Walk daily", durationMinutes: 30, sessionsPerWeek: 9 }
    const sessions = [
      { id: "walk#0", activityId: "walk", day: 0 as const, start: 1200, end: 1230 },
      { id: "walk#1", activityId: "walk", day: 2 as const, start: 480, end: 510 },
      { id: "walk#2", activityId: "walk", day: 2 as const, start: 1200, end: 1230 },
      { id: "walk#3", activityId: "walk", day: 4 as const, start: 1200, end: 1230 },
    ]
    const week = { ...ctx, activities: [walk], sessions }

    it("takes that day's session out of the week, not the activity", () => {
      expect(interpret("remove walk daily monday", week)).toMatchObject({
        kind: "skip",
        blockIds: ["walk#0"],
        preview: "REMOVE WALK DAILY MON 20:00 FROM THIS WEEK",
      })
      expect(interpret("remove walk daily mon fri", week)).toMatchObject({ kind: "skip", blockIds: ["walk#0", "walk#3"] })
    })

    it("asks which, when the day has two, unless the start says", () => {
      const asked = interpret("remove walk daily wednesday", week)
      expect(asked).toMatchObject({ kind: "choose", preview: expect.stringContaining("2 SESSIONS ON WEDNESDAY") })
      expect(asked && "options" in asked && asked.options.map((o) => o.action)).toMatchObject([{ blockIds: ["walk#1"] }, { blockIds: ["walk#2"] }])
      expect(interpret("remove walk daily wednesday 20:00", week)).toMatchObject({ kind: "skip", blockIds: ["walk#2"] })
    })

    it("says so when there is nothing on that day", () => {
      expect(interpret("remove walk daily sunday", week)).toMatchObject({ kind: "error", reply: "NO WALK DAILY SESSION ON SUNDAY THIS WEEK" })
    })
  })

  it("keeps a setting word in the name when the setting is given again", () => {
    expect(interpret("add daily walk 30m daily", ctx)).toMatchObject({ activity: { name: "daily walk", sessionsPerWeek: 7 } })
    expect(interpret("add daily standup 15m 5x", ctx)).toMatchObject({ activity: { name: "daily standup", sessionsPerWeek: 5 } })
    expect(interpret("add morning pages 20m daily morning", ctx)).toMatchObject({ activity: { name: "morning pages", window: { start: "06:00" } } })
  })

  it("adds up days written one by one", () => {
    expect(interpret("add piano 30m mon wed fri", ctx)).toMatchObject({ activity: { name: "piano", allowedDays: [0, 2, 4] } })
  })

  it("reads back what commandFor writes", () => {
    expect(interpret(commandFor(gym), ctx)).toMatchObject({
      kind: "update",
      patch: { durationMinutes: 240, sessionsPerWeek: 4 },
    })
  })
})

describe("normalize", () => {
  it("leaves shorthand alone", () => {
    expect(normalize("gym 1h15 4x")).toBe("gym 1h15 4x")
  })
})

describe("complete", () => {
  it("finishes activity names and command words", () => {
    expect(complete("gy", [gym])).toBe("gym")
    expect(complete("rm G", [gym])).toBe("rm Gym")
    expect(complete("shu", [gym])).toBe("shuffle")
    // One letter is enough for a function: functions come first.
    expect(complete("e", [gym])).toBe("edit")
    expect(complete("g", [gym])).toBe("grid")
    expect(complete("gy", [gym])).toBe("gym")
    expect(complete("edit m", [gym])).toBe("edit meals")
    expect(complete("gym ", [gym])).toBeNull()
    expect(complete("zz", [gym])).toBeNull()
  })
})

describe("nextHint", () => {
  it("says what an activity or command word needs next", () => {
    expect(nextHint("gym", [gym])).toContain("NOW GYM 4H 4×")
    expect(nextHint("wake", [gym])).toContain("TIME")
    expect(nextHint("yoga", [gym])).toBeNull()
  })
})

describe("parseDays", () => {
  it("reads day letters in week order", () => {
    expect(parseDays("MTWTFSaSu")).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(parseDays("mtsasu")).toEqual([0, 1, 5, 6])
    expect(parseDays("TT")).toEqual([1, 3])
    expect(parseDays("Th")).toEqual([3])
    expect(parseDays("SS")).toEqual([5, 6])
    expect(parseDays("weekdays")).toEqual([0, 1, 2, 3, 4])
    expect(parseDays("Monday")).toEqual([0])
    expect(parseDays("thurs")).toEqual([3])
    expect(parseDays("sundays")).toEqual([6])
    expect(parseDays("work")).toBeNull()
    expect(parseDays("FM")).toBeNull()
  })

  it("writes them back the same way", () => {
    expect(formatDays([0, 1, 5, 6])).toBe("MTSaSu")
  })
})

describe("parseClock", () => {
  it("reads 24h and 12h times", () => {
    expect(parseClock("0730")).toBe("07:30")
    expect(parseClock("12am")).toBe("00:00")
    expect(parseClock("12pm")).toBe("12:00")
    expect(parseClock("25:00")).toBeNull()
    expect(parseClock("10h00")).toBe("10:00")
    expect(parseClock("10h")).toBe("10:00")
  })
})
