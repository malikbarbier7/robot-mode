import { describe, expect, it } from "vitest"
import { complete, interpret } from "./command"
import { generate } from "./scheduler"
import { SAMPLE, sampleConflict, sampleTranscript } from "./sample"

describe("the landing page's sample session", () => {
  it("is all lines the machine understands, about sessions that are really there", () => {
    const schedule = generate(SAMPLE)
    const transcript = sampleTranscript(SAMPLE, schedule)
    expect(transcript.length).toBe(7)
    const ctx = { ...SAMPLE, sessions: schedule.blocks.map((b) => ({ id: b.id, activityId: b.activityId, day: b.day, start: b.startMinute, end: b.endMinute })) }
    for (const { line } of transcript) {
      const action = interpret(line, ctx)
      expect(action?.kind, `"${line}" → ${action?.reply}`).not.toBe("error")
      expect(action?.kind, `"${line}" asks which session`).not.toBe("choose")
    }
  })
})

describe("what the landing page says about the command line", () => {
  const ctx = { activities: [], wakeTime: "07:00", sleepTime: "23:00" }
  it("reads plain words like shorthand, in any order, and completes the first letters", () => {
    const short = interpret("gym 1h15 4x", ctx)
    expect(interpret("gym 1 hour 15, 4 times a week", ctx)).toMatchObject({ kind: "add", activity: (short as { activity: object }).activity })
    expect(interpret("1h monday gym", ctx)).toEqual(interpret("gym monday 1h", ctx))
    expect(complete("e", [])).toBe("edit")
  })
})

describe("the landing page's conflict", () => {
  it("is a real conflict on the sample week, with fixes the engine has verified", () => {
    const conflict = sampleConflict(SAMPLE)
    expect(conflict.placed).toBeLessThan(conflict.requested)
    expect(conflict.fixes.length).toBeGreaterThan(0)
  })
})

describe("what the landing page's FAQ tells people to type", () => {
  it("pins a job to fixed hours on weekdays", () => {
    expect(interpret("work 8h 5x at 9:00 weekdays", { activities: [], wakeTime: "07:00", sleepTime: "23:00" })).toMatchObject({
      kind: "add",
      activity: { name: "work", durationMinutes: 480, sessionsPerWeek: 5, allowedDays: [0, 1, 2, 3, 4], fixedAt: { start: "09:00" } },
    })
  })
})
