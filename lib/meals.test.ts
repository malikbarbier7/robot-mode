import { describe, expect, it } from "vitest"
import { allActivities, defaultMeals, mealActivities, noMeals } from "./meals"
import { generate } from "./scheduler/generate"
import { computeBudget } from "./scheduler/budget"
import type { Meal, Settings } from "./types"

const base: Settings = {
  wakeTime: "07:30",
  sleepTime: "23:30",
  minFreeMinutesPerDay: 60,
  seed: 1,
  activities: [],
  meals: defaultMeals,
}

describe("mealActivities", () => {
  it("makes each enabled meal a fixed, critical, daily activity", () => {
    const [breakfast] = mealActivities([defaultMeals[0]])
    expect(breakfast).toEqual({
      id: "meal-breakfast",
      name: "Breakfast",
      durationMinutes: 30,
      sessionsPerWeek: 7,
      priority: "critical",
      fixedAt: { start: "08:00" },
    })
  })

  it("leaves out disabled meals", () => {
    expect(mealActivities(noMeals)).toEqual([])
  })

  it("leaves out a meal with no duration", () => {
    const empty: Meal = { ...defaultMeals[0], durationMinutes: 0 }
    expect(mealActivities([empty])).toEqual([])
  })

  it("copes with meals being absent entirely", () => {
    expect(mealActivities(undefined)).toEqual([])
    expect(allActivities({ ...base, meals: undefined })).toEqual([])
  })
})

describe("meals in the schedule", () => {
  it("places every meal at its time, every day", () => {
    const schedule = generate(base)
    expect(schedule.unplaced).toEqual([])
    expect(schedule.blocks).toHaveLength(21)

    for (const meal of defaultMeals) {
      const blocks = schedule.blocks.filter((b) => b.activityId === `meal-${meal.id}`)
      expect(blocks, meal.name).toHaveLength(7)
      const [h, m] = meal.start.split(":").map(Number)
      for (const b of blocks) expect(b.startMinute).toBe(h * 60 + m)
    }
  })

  it("counts towards the budget", () => {
    const withMeals = computeBudget(base)
    const without = computeBudget({ ...base, meals: noMeals })
    // 30 + 45 + 60 minutes a day, seven days.
    expect(withMeals.requestedMinutes - without.requestedMinutes).toBe((30 + 45 + 60) * 7)
  })

  it("keeps other activities from overlapping them", () => {
    const schedule = generate({
      ...base,
      activities: [
        { id: "work", name: "Work", durationMinutes: 240, sessionsPerWeek: 7, priority: "critical" },
      ],
    })
    const byDay = new Map<number, typeof schedule.blocks>()
    for (const b of schedule.blocks) byDay.set(b.day, [...(byDay.get(b.day) ?? []), b])
    for (const [day, blocks] of byDay) {
      const sorted = [...blocks].sort((a, b) => a.startMinute - b.startMinute)
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].startMinute, `day ${day}`).toBeGreaterThanOrEqual(sorted[i - 1].endMinute)
      }
    }
  })

  it("does not put meals in the user's activity list", () => {
    // They belong to the shape of the day, not to "what do you want to do".
    expect(base.activities).toEqual([])
    expect(allActivities(base)).toHaveLength(3)
  })

  it("moves everything when a meal time changes", () => {
    const early = generate({ ...base, meals: defaultMeals.map((m) => ({ ...m, start: "12:00" })) })
    const noon = early.blocks.filter((b) => b.startMinute === 12 * 60)
    expect(noon.length).toBeGreaterThan(0)
  })
})
