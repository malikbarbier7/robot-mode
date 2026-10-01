import { describe, expect, it } from "vitest"
import { commandFor, complete, describe as describeActivity, formatDays, interpret, nextHint, normalize, parseClock, parseDays } from "./command"
import type { Activity } from "./types"

const gym: Activity = { id: "gym", name: "Gym", durationMinutes: 240, sessionsPerWeek: 4, priority: "medium" }
const ctx = { activities: [gym], wakeTime: "07:30", sleepTime: "23:30", minFreeMinutesPerDay: 120 }

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
    expect(interpret("free 90", ctx)).toMatchObject({ kind: "settings", patch: { minFreeMinutesPerDay: 90 } })
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
    expect(interpret("free time 2 hours a day", ctx)).toMatchObject({ patch: { minFreeMinutesPerDay: 120 } })
  })

  it("adds with defaults as soon as it is asked to add", () => {
    expect(interpret("add surf", ctx)).toMatchObject({
      kind: "add",
      activity: { name: "surf", durationMinutes: 60, sessionsPerWeek: 1 },
      preview: "ADD SURF 1H 1×",
      note: "OPTIONAL: MTWTFSaSu · MORNING · ALWAYS AT 07:00",
    })
    expect(interpret("add surf 3 times", ctx)).toMatchObject({ activity: { durationMinutes: 60, sessionsPerWeek: 3 } })
    expect(interpret("add gym", ctx)).toMatchObject({ kind: "error", reply: expect.stringContaining("ALREADY") })
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
      priority: "medium",
      allowedDays: [0, 1, 5, 6],
      fixedAt: { start: "06:00" },
    })
    expect(interpret(line, ctx)).toMatchObject({
      kind: "add",
      activity: { durationMinutes: 70, sessionsPerWeek: 4, allowedDays: [0, 1, 5, 6], fixedAt: { start: "06:00" } },
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
    expect(interpret("edit free time", ctx)).toMatchObject({ kind: "open", screen: "free" })
    expect(interpret("system", ctx)).toMatchObject({ kind: "open", screen: "system" })
    expect(interpret("restart", ctx)).toMatchObject({ kind: "open", screen: "restart" })
    expect(interpret("clear", ctx)?.kind).toBe("clear")
    expect(interpret("help", ctx)).toMatchObject({ kind: "open", screen: "help" })
    expect(interpret("today", ctx)).toMatchObject({ kind: "view", view: "today" })
    expect(interpret("mute", ctx)).toMatchObject({ kind: "display", patch: { sound: false } })
    expect(interpret("sound", { ...ctx, sound: false })).toMatchObject({ patch: { sound: true } })
    expect(complete("t", [gym])).toBe("today")
    expect(complete("h", [gym])).toBe("help")
    expect(interpret("grid", ctx)).toMatchObject({ kind: "view", view: "grid" })
    expect(interpret("printout", ctx)).toMatchObject({ kind: "view", view: "printout" })
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
  })
})
