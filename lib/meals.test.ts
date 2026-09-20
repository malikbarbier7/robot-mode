import { describe, expect, it } from "vitest"
import { allActivities, defaultMeals, mealActivities, mealsOf } from "./meals"
import { generate } from "./scheduler/generate"
import { computeBudget } from "./scheduler/budget"
import type { Meal, Settings } from "./types"

/** Every slot switched on, for tests about what happens once they are. */
const allOn = defaultMeals.map((m) => ({ ...m, enabled: true }))
const on = (id: string) => allOn.find((m) => m.id === id)!

const base: Settings = {
  wakeTime: "07:30",
  sleepTime: "23:30",
  minFreeMinutesPerDay: 60,
  seed: 1,
  activities: [],
  meals: allOn,
}

describe("mealActivities", () => {
  it("makes each enabled meal a fixed, critical, daily activity", () => {
    const [breakfast] = mealActivities([on("breakfast")])
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
    expect(mealActivities(defaultMeals)).toEqual([])
  })

  it("starts every slot switched off", () => {
    expect(defaultMeals.every((m) => !m.enabled)).toBe(true)
    expect(allActivities({ ...base, meals: undefined })).toEqual([])
  })

  it("leaves out a meal with no duration", () => {
    const empty: Meal = { ...on("breakfast"), durationMinutes: 0 }
    expect(mealActivities([empty])).toEqual([])
  })

  it("copes with meals being absent entirely", () => {
    expect(mealActivities(undefined)).toEqual([])
  })
})

describe("meals in the schedule", () => {
  it("places every meal at its time, every day", () => {
    const schedule = generate(base)
    expect(schedule.unplaced).toEqual([])
    expect(schedule.blocks).toHaveLength(defaultMeals.length * 7)

    for (const meal of allOn) {
      const blocks = schedule.blocks.filter((b) => b.activityId === `meal-${meal.id}`)
      expect(blocks, meal.name).toHaveLength(7)
      const [h, m] = meal.start.split(":").map(Number)
      for (const b of blocks) expect(b.startMinute).toBe(h * 60 + m)
    }
  })

  it("counts towards the budget", () => {
    const withMeals = computeBudget(base)
    const without = computeBudget({ ...base, meals: defaultMeals })
    const perDay = allOn.reduce((n, m) => n + m.durationMinutes, 0)
    expect(withMeals.requestedMinutes - without.requestedMinutes).toBe(perDay * 7)
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
    expect(allActivities(base)).toHaveLength(defaultMeals.length)
  })

  it("moves everything when a meal time changes", () => {
    const early = generate({ ...base, meals: allOn.map((m) => ({ ...m, start: "12:00" })) })
    const noon = early.blocks.filter((b) => b.startMinute === 12 * 60)
    expect(noon.length).toBeGreaterThan(0)
  })
})

describe("mealsOf", () => {
  it("fills in a slot the saved settings never had", () => {
    const partial = mealsOf({ meals: [on("breakfast")] })
    expect(partial.map((m) => m.id)).toEqual(defaultMeals.map((m) => m.id))
    expect(partial.find((m) => m.id === "dinner")?.enabled).toBe(false)
  })

  it("keeps what was saved", () => {
    const saved = mealsOf({ meals: [{ ...on("dinner"), start: "21:00", durationMinutes: 90 }] })
    expect(saved.find((m) => m.id === "dinner")).toMatchObject({
      start: "21:00",
      durationMinutes: 90,
      enabled: true,
    })
  })

  it("drops a slot that no longer exists", () => {
    const withSnack = mealsOf({
      meals: [{ id: "snack", name: "Snack", start: "16:00", durationMinutes: 15, enabled: true }],
    })
    expect(withSnack.map((m) => m.id)).toEqual(defaultMeals.map((m) => m.id))
  })

  it("returns every slot when nothing is saved", () => {
    expect(mealsOf({ meals: undefined })).toEqual(defaultMeals)
  })
})
