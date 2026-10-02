import { describe, expect, it } from "vitest"
import type { Settings } from "./types"
import { suggestFixes } from "./suggest"
import { generate } from "./scheduler/generate"
import { defaultMeals } from "./meals"

const base: Settings = {
  wakeTime: "07:30",
  sleepTime: "23:30",
  seed: 1,
  activities: [],
  meals: defaultMeals,
}

/** The reported case: breakfast at 09:00, gym pinned to 08:00 with a buffer. */
const gymVsBreakfast: Settings = {
  ...base,
  meals: defaultMeals.map((m) => (m.id === "breakfast" ? { ...m, start: "09:00", enabled: true } : m)),
  activities: [
    {
      id: "gym",
      name: "Gym",
      durationMinutes: 75,
      sessionsPerWeek: 4,
      priority: "high",
      bufferMinutes: 15,
      fixedAt: { start: "08:00" },
    },
  ],
}

const conflictIn = (settings: Settings, activityId: string) => {
  const found = generate(settings).unplaced.find((u) => u.activityId === activityId)
  if (!found) throw new Error(`expected ${activityId} to be unplaceable`)
  return found
}

describe("suggestFixes", () => {
  const conflict = conflictIn(gymVsBreakfast, "gym")
  const fixes = suggestFixes(gymVsBreakfast, conflict)

  it("offers a handful, not a wall", () => {
    expect(fixes.length).toBeGreaterThan(0)
    expect(fixes.length).toBeLessThanOrEqual(3)
  })

  it("only suggests changes that actually work", () => {
    for (const fix of fixes) {
      const after = generate(fix.settings)
      const still = after.unplaced.find((u) => u.activityId === "gym")
      expect(still, fix.label).toBeUndefined()
    }
  })

  it("never suggests something that breaks more than it fixes", () => {
    const before = generate(gymVsBreakfast).unplaced.reduce(
      (n, u) => n + (u.sessionsRequested - u.sessionsPlaced),
      0,
    )
    for (const fix of fixes) {
      const after = generate(fix.settings).unplaced.reduce(
        (n, u) => n + (u.sessionsRequested - u.sessionsPlaced),
        0,
      )
      expect(after, fix.label).toBeLessThan(before)
    }
  })

  it("gives three different kinds of change, not the same one three times", () => {
    expect(new Set(fixes.map((f) => f.kind)).size).toBe(fixes.length)
  })

  it("puts the least disruptive first", () => {
    const costs = fixes.map((f) => f.cost)
    expect([...costs].sort((a, b) => a - b)).toEqual(costs)
  })

  it("prefers nudging a time over changing wake or sleep", () => {
    // Rearranging one block beats rewriting every day of the week.
    expect(["move", "move-blocker", "drop-buffer"]).toContain(fixes[0].kind)
  })

  it("leaves the original settings untouched", () => {
    const copy = JSON.parse(JSON.stringify(gymVsBreakfast))
    suggestFixes(gymVsBreakfast, conflict)
    expect(gymVsBreakfast).toEqual(copy)
  })

  it("writes a label a person can act on", () => {
    for (const fix of fixes) {
      expect(fix.label.length).toBeGreaterThan(8)
      expect(fix.label).not.toContain("undefined")
    }
  })

  it("is deterministic", () => {
    expect(suggestFixes(gymVsBreakfast, conflict).map((f) => f.label)).toEqual(fixes.map((f) => f.label))
  })
})

describe("a fixed time outside waking hours", () => {
  const settings: Settings = {
    ...base,
    activities: [
      { id: "run", name: "Dawn run", durationMinutes: 45, sessionsPerWeek: 3, priority: "high", fixedAt: { start: "05:00" } },
    ],
  }

  it("offers something that gets it back inside the day", () => {
    const fixes = suggestFixes(settings, conflictIn(settings, "run"))
    expect(fixes.length).toBeGreaterThan(0)
    for (const fix of fixes) expect(generate(fix.settings).unplaced).toEqual([])
  })
})

describe("a daily pin an hour before waking", () => {
  // The reported case: surf every day at 06:00, waking at 07:00.
  const surf = (durationMinutes: number): Settings => ({
    ...base,
    wakeTime: "07:00",
    meals: defaultMeals.map((m) => ({ ...m, enabled: true })),
    activities: [{ id: "surf", name: "Surf", durationMinutes, sessionsPerWeek: 7, priority: "medium", fixedAt: { start: "06:00" } }],
  })

  it("offers to wake up exactly early enough, not just 15 or 30 minutes", () => {
    const settings = surf(60)
    const labels = suggestFixes(settings, conflictIn(settings, "surf"), 5).map((f) => f.label)
    expect(labels).toContain("Wake up at 06:00 instead of 07:00")
    expect(labels).toContain("Do Surf in the morning instead of always at 06:00")
    expect(labels).toContain("Let Robot Mode choose when Surf happens")
  })

  it("finds the nearest start that works, even beyond an hour away", () => {
    const settings = surf(90)
    const move = suggestFixes(settings, conflictIn(settings, "surf"), 5).find((f) => f.kind === "move")
    expect(move?.label).toBe("Move Surf to 08:30")
    expect(generate(move!.settings).unplaced).toEqual([])
  })
})

describe("when nothing small can help", () => {
  it("returns an empty list rather than a bad suggestion", () => {
    // Far more hours requested than the week holds: no single tweak saves this.
    const impossible: Settings = {
      ...base,
      activities: [
        { id: "a", name: "A", durationMinutes: 480, sessionsPerWeek: 14, priority: "critical" },
        { id: "b", name: "B", durationMinutes: 480, sessionsPerWeek: 14, priority: "high" },
      ],
    }
    expect(suggestFixes(impossible, conflictIn(impossible, "b"))).toEqual([])
  })
})
