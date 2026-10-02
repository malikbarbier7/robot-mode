import { describe, expect, it } from "vitest"
import type { Settings } from "@/lib/types"
import { generate } from "./generate"
import { defaultMeals } from "@/lib/meals"

const base: Settings = {
  wakeTime: "07:30",
  sleepTime: "23:30",
  seed: 1,
  activities: [],
  meals: defaultMeals,
}

/** The reported case: breakfast locked at 09:00, gym fixed at 08:00 with a buffer. */
const breakfastVsGym: Settings = {
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

describe("conflict reporting", () => {
  it("names the meal sitting in the way", () => {
    const [conflict] = generate(breakfastVsGym).unplaced
    expect(conflict.name).toBe("Gym")
    expect(conflict.sessionsPlaced).toBe(0)
    expect(conflict.why).toBe("08:00 clashes with Breakfast at 09:00")
    expect(conflict.blockedBy).toEqual([
      { activityId: "meal-breakfast", name: "Breakfast", startMinute: 9 * 60 },
    ])
  })

  it("says so when a fixed time falls outside waking hours", () => {
    const [conflict] = generate({
      ...base,
      activities: [
        { id: "run", name: "Run", durationMinutes: 60, sessionsPerWeek: 3, priority: "high", fixedAt: { start: "05:00" } },
      ],
    }).unplaced
    expect(conflict.why).toContain("waking up")
    expect(conflict.blockedBy).toBeUndefined()
  })

  it("reports the longest remaining gap when nothing long enough is left", () => {
    const [conflict] = generate({
      ...base,
      activities: [
        { id: "work", name: "Work", durationMinutes: 240, sessionsPerWeek: 21, priority: "critical" },
        { id: "epic", name: "Epic session", durationMinutes: 480, sessionsPerWeek: 1, priority: "low" },
      ],
    }).unplaced.filter((u) => u.activityId === "epic")
    expect(conflict.why).toContain("in a row")
    expect(conflict.why).toContain("longest gap")
  })

  it("lists every conflict, not just the first", () => {
    const schedule = generate({
      ...base,
      meals: defaultMeals.map((m) => (m.id === "breakfast" ? { ...m, start: "09:00", enabled: true } : m)),
      activities: [
        { id: "gym", name: "Gym", durationMinutes: 75, sessionsPerWeek: 4, priority: "high", bufferMinutes: 15, fixedAt: { start: "08:00" } },
        { id: "call", name: "Call", durationMinutes: 60, sessionsPerWeek: 2, priority: "high", fixedAt: { start: "09:15" } },
      ],
    })
    expect(schedule.unplaced.map((u) => u.name).sort()).toEqual(["Call", "Gym"])
    for (const u of schedule.unplaced) expect(u.why.length).toBeGreaterThan(0)
  })

  it("stays quiet when everything fits", () => {
    const schedule = generate({
      ...base,
      activities: [
        { id: "gym", name: "Gym", durationMinutes: 60, sessionsPerWeek: 3, priority: "high" },
      ],
    })
    expect(schedule.unplaced).toEqual([])
  })

  it("names at most three blockers", () => {
    const busy: Settings = {
      ...base,
      activities: [
        { id: "a", name: "A", durationMinutes: 60, sessionsPerWeek: 7, priority: "critical", fixedAt: { start: "09:00" } },
        { id: "b", name: "B", durationMinutes: 60, sessionsPerWeek: 7, priority: "critical", fixedAt: { start: "10:00" } },
        { id: "c", name: "C", durationMinutes: 60, sessionsPerWeek: 7, priority: "critical", fixedAt: { start: "11:00" } },
        { id: "d", name: "D", durationMinutes: 60, sessionsPerWeek: 7, priority: "critical", fixedAt: { start: "12:00" } },
        { id: "late", name: "Late", durationMinutes: 240, sessionsPerWeek: 7, priority: "low", fixedAt: { start: "09:00" } },
      ],
    }
    const conflict = generate(busy).unplaced.find((u) => u.activityId === "late")!
    expect(conflict.blockedBy!.length).toBeLessThanOrEqual(3)
    expect(conflict.blockedBy!.length).toBeGreaterThan(0)
  })
})
