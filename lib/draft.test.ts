import { describe, expect, it } from "vitest"
import { STEPS, describeDraft, draftToActivity, emptyDraft, isDraftValid, type Draft } from "./draft"

const base: Draft = { name: "Gym", durationMinutes: 75, sessionsPerWeek: 4 }

describe("isDraftValid", () => {
  it("needs a name, a duration and a frequency", () => {
    expect(isDraftValid(base)).toBe(true)
    expect(isDraftValid(emptyDraft())).toBe(false)
    expect(isDraftValid({ ...base, name: "  " })).toBe(false)
    expect(isDraftValid({ ...base, durationMinutes: 0 })).toBe(false)
    expect(isDraftValid({ ...base, sessionsPerWeek: 0 })).toBe(false)
  })
})

describe("draftToActivity", () => {
  it("leaves every skipped step off the activity", () => {
    expect(draftToActivity(base)).toEqual({
      name: "Gym",
      durationMinutes: 75,
      sessionsPerWeek: 4,
      priority: "medium",
    })
  })

  it("trims the name", () => {
    expect(draftToActivity({ ...base, name: "  Gym  " }).name).toBe("Gym")
  })

  it("keeps a partial day selection, sorted", () => {
    const a = draftToActivity({ ...base, allowedDays: [4, 0, 2] })
    expect(a.allowedDays).toEqual([0, 2, 4])
  })

  it("drops a full week of days, which is the same as no restriction", () => {
    expect(draftToActivity({ ...base, allowedDays: [0, 1, 2, 3, 4, 5, 6] }).allowedDays).toBeUndefined()
  })

  it("drops an empty day selection", () => {
    expect(draftToActivity({ ...base, allowedDays: [] }).allowedDays).toBeUndefined()
  })

  it("keeps a chosen priority", () => {
    expect(draftToActivity({ ...base, priority: "high" }).priority).toBe("high")
  })

  it("ignores a zero travel buffer", () => {
    expect(draftToActivity({ ...base, bufferMinutes: 0 }).bufferMinutes).toBeUndefined()
    expect(draftToActivity({ ...base, bufferMinutes: 15 }).bufferMinutes).toBe(15)
  })

  it("keeps a preferred window", () => {
    const a = draftToActivity({ ...base, window: { start: "06:00", end: "12:00" } })
    expect(a.window).toEqual({ start: "06:00", end: "12:00" })
  })

  it("lets a fixed time win over a window, since it pins every session anyway", () => {
    const a = draftToActivity({ ...base, window: { start: "06:00", end: "12:00" }, fixedAt: { start: "07:00" } })
    expect(a.fixedAt).toEqual({ start: "07:00" })
    expect(a.window).toBeUndefined()
  })
})

describe("describeDraft", () => {
  it("is empty when nothing was chosen", () => {
    expect(describeDraft(base)).toEqual([])
  })

  it("summarises the choices", () => {
    expect(
      describeDraft({
        ...base,
        allowedDays: [0, 2],
        priority: "high",
        bufferMinutes: 15,
        window: { start: "06:00", end: "12:00" },
      }),
    ).toEqual(["Mon Wed", "high", "+15m travel", "06:00–12:00"])
  })

  it("shows a fixed time instead of a window", () => {
    expect(describeDraft({ ...base, window: { start: "06:00", end: "12:00" }, fixedAt: { start: "07:00" } })).toEqual([
      "always 07:00",
    ])
  })
})

describe("STEPS", () => {
  it("asks four questions, with the two exclusive ones merged", () => {
    expect([...STEPS]).toEqual(["Days", "Priority", "Travel buffer", "When"])
  })
})
