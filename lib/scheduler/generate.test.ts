import { describe, expect, it } from "vitest"
import type { PlacedBlock, Settings } from "@/lib/types"
import { generate } from "./generate"
import { computeBudget } from "./budget"
import { SLOT_MINUTES, dayWindows, parseTime, wakingSlotsPerDay } from "./time"
import {
  comfortableWeek,
  gymRestrictedWeek,
  impossibleWeek,
  nightOwlWeek,
  tightWeek,
} from "@/lib/fixtures/weeks"

function expectNoOverlaps(blocks: PlacedBlock[]) {
  const byDay = new Map<number, PlacedBlock[]>()
  for (const b of blocks) byDay.set(b.day, [...(byDay.get(b.day) ?? []), b])
  for (const [, dayBlocks] of byDay) {
    const sorted = [...dayBlocks].sort((a, b) => a.startMinute - b.startMinute)
    for (let i = 1; i < sorted.length; i++) {
      expect(
        sorted[i].startMinute,
        `${sorted[i].name} @ day ${sorted[i].day} overlaps ${sorted[i - 1].name}`,
      ).toBeGreaterThanOrEqual(sorted[i - 1].endMinute)
    }
  }
}

function expectInsideWakingHours(blocks: PlacedBlock[], settings: Settings) {
  const windows = dayWindows(settings.wakeTime, settings.sleepTime)
  for (const b of blocks) {
    const win = windows[b.day]
    const dayStart = b.day * 96
    const startAbs = dayStart + b.startMinute / SLOT_MINUTES
    const endAbs = dayStart + b.endMinute / SLOT_MINUTES
    expect(startAbs, `${b.name} starts before wake`).toBeGreaterThanOrEqual(win.startAbs)
    expect(endAbs, `${b.name} ends after sleep`).toBeLessThanOrEqual(win.endAbs)
  }
}

function placedCount(blocks: PlacedBlock[], activityId: string) {
  return blocks.filter((b) => b.activityId === activityId).length
}

describe("comfortable week", () => {
  const schedule = generate(comfortableWeek)

  it("places every requested session", () => {
    expect(schedule.unplaced).toEqual([])
    for (const a of comfortableWeek.activities) {
      expect(placedCount(schedule.blocks, a.id), a.name).toBe(a.sessionsPerWeek)
    }
  })

  it("produces no overlaps", () => expectNoOverlaps(schedule.blocks))

  it("stays inside waking hours", () => expectInsideWakingHours(schedule.blocks, comfortableWeek))

  it("honours fixed times", () => {
    for (const b of schedule.blocks.filter((x) => x.activityId === "breakfast")) {
      expect(b.startMinute).toBe(parseTime("08:00"))
    }
    for (const b of schedule.blocks.filter((x) => x.activityId === "lunch")) {
      expect(b.startMinute).toBe(parseTime("13:00"))
    }
  })

  it("respects allowed days", () => {
    for (const b of schedule.blocks.filter((x) => x.activityId === "gym")) {
      expect([0, 1, 3, 4]).toContain(b.day)
    }
  })

  it("keeps gym inside its preferred window", () => {
    for (const b of schedule.blocks.filter((x) => x.activityId === "gym")) {
      expect(b.startMinute).toBeGreaterThanOrEqual(parseTime("16:00"))
      expect(b.endMinute).toBeLessThanOrEqual(parseTime("19:00"))
    }
  })

  it("reserves the gym buffer on both sides", () => {
    const gym = schedule.blocks.filter((x) => x.activityId === "gym")
    for (const g of gym) {
      const sameDay = schedule.blocks.filter((b) => b.day === g.day && b.id !== g.id)
      for (const other of sameDay) {
        const clearsBefore = other.endMinute <= g.startMinute - 15
        const clearsAfter = other.startMinute >= g.endMinute + 15
        expect(clearsBefore || clearsAfter, `${other.name} sits inside the gym buffer`).toBe(true)
      }
    }
  })

  it("leaves the protected free time on every day", () => {
    const wakingPerDay = wakingSlotsPerDay(comfortableWeek.wakeTime, comfortableWeek.sleepTime) * SLOT_MINUTES
    for (let day = 0; day < 7; day++) {
      const used = schedule.blocks
        .filter((b) => b.day === day)
        .reduce((sum, b) => sum + (b.endMinute - b.startMinute), 0)
      expect(wakingPerDay - used, `day ${day}`).toBeGreaterThanOrEqual(comfortableWeek.minFreeMinutesPerDay)
    }
  })

  it("schedules language at a consistent time", () => {
    const starts = new Set(schedule.blocks.filter((b) => b.activityId === "language").map((b) => b.startMinute))
    expect(starts.size).toBe(1)
  })
})

describe("determinism", () => {
  it("returns an identical week for identical input", () => {
    const a = generate(comfortableWeek)
    const b = generate(comfortableWeek)
    expect(b.blocks).toEqual(a.blocks)
    expect(b.score).toBe(a.score)
  })

  it("returns a different arrangement for a different seed", () => {
    const a = generate(tightWeek)
    const b = generate({ ...tightWeek, seed: tightWeek.seed + 1 })
    expect(b.blocks).not.toEqual(a.blocks)
  })
})

describe("tight week", () => {
  const schedule = generate(tightWeek)

  it("still fits inside the budget", () => {
    expect(schedule.budget.feasible).toBe(true)
  })

  it("places every session without overlaps", () => {
    expect(schedule.unplaced).toEqual([])
    expectNoOverlaps(schedule.blocks)
  })
})

describe("impossible week", () => {
  const schedule = generate(impossibleWeek)

  it("reports the budget as infeasible", () => {
    expect(schedule.budget.feasible).toBe(false)
    expect(schedule.budget.overByMinutes).toBeGreaterThan(0)
  })

  it("names the lowest-priority activity as the thing to cut", () => {
    expect(schedule.budget.suggestion?.activityId).toBe("extra")
  })

  it("still schedules every critical session", () => {
    expect(placedCount(schedule.blocks, "work")).toBe(14)
  })

  it("sacrifices low priority before high priority", () => {
    const missed = new Map(schedule.unplaced.map((u) => [u.activityId, u.sessionsRequested - u.sessionsPlaced]))
    expect(missed.get("extra") ?? 0).toBeGreaterThan(0)
    expect(missed.get("language") ?? 0).toBeLessThan(missed.get("extra")!)
  })

  it("explains what could not be placed", () => {
    for (const u of schedule.unplaced) expect(u.why.length).toBeGreaterThan(0)
  })

  it("produces a valid schedule despite being over budget", () => {
    expectNoOverlaps(schedule.blocks)
    expectInsideWakingHours(schedule.blocks, impossibleWeek)
  })
})

describe("locked blocks", () => {
  const first = generate(comfortableWeek)
  const locked = first.blocks
    .filter((b) => b.activityId === "gym")
    .map((b) => ({ ...b, locked: true, day: 0 as const, startMinute: parseTime("17:00"), endMinute: parseTime("18:15") }))
    .slice(0, 1)

  it("never moves a locked block", () => {
    const schedule = generate(comfortableWeek, { locked })
    const gymOnMonday = schedule.blocks.find((b) => b.id === locked[0].id)
    expect(gymOnMonday?.day).toBe(0)
    expect(gymOnMonday?.startMinute).toBe(parseTime("17:00"))
    expect(gymOnMonday?.locked).toBe(true)
  })

  it("keeps an entirely locked week intact", () => {
    const allLocked = first.blocks.map((b) => ({ ...b, locked: true }))
    const schedule = generate(comfortableWeek, { locked: allLocked })
    expect(schedule.blocks.length).toBe(first.blocks.length)
    expect(schedule.blocks.every((b) => b.locked)).toBe(true)
    expectNoOverlaps(schedule.blocks)
  })

  it("reschedules around locked blocks without overlapping them", () => {
    const schedule = generate(comfortableWeek, { locked })
    expectNoOverlaps(schedule.blocks)
  })
})

describe("gym restricted to four days", () => {
  const schedule = generate(gymRestrictedWeek)

  it("places all four sessions on the four legal days", () => {
    const gym = schedule.blocks.filter((b) => b.activityId === "gym")
    expect(gym.length).toBe(4)
    expect(new Set(gym.map((b) => b.day))).toEqual(new Set([0, 1, 3, 4]))
  })

  it("puts them at the same time each day", () => {
    const starts = new Set(schedule.blocks.filter((b) => b.activityId === "gym").map((b) => b.startMinute))
    expect(starts.size).toBe(1)
  })
})

describe("night owl week", () => {
  const schedule = generate(nightOwlWeek)

  it("schedules past midnight without leaking into the next day", () => {
    expect(schedule.unplaced).toEqual([])
    expectNoOverlaps(schedule.blocks)
    expectInsideWakingHours(schedule.blocks, nightOwlWeek)
  })

  it("allows blocks that run past 24:00", () => {
    const late = schedule.blocks.filter((b) => b.endMinute > 1440)
    expect(late.length).toBeGreaterThan(0)
  })
})

describe("I missed this", () => {
  it("does not reschedule anything into the past", () => {
    const schedule = generate(comfortableWeek, { notBefore: { day: 2, minuteOfDay: parseTime("14:00") } })
    const stale = schedule.blocks.filter(
      (b) => b.day < 2 || (b.day === 2 && b.startMinute < parseTime("14:00")),
    )
    expect(stale).toEqual([])
  })
})

describe("budget", () => {
  it("is feasible for an empty week", () => {
    const empty: Settings = { ...comfortableWeek, activities: [] }
    const budget = computeBudget(empty)
    expect(budget.feasible).toBe(true)
    expect(budget.requestedMinutes).toBe(0)
  })

  it("counts buffers as consumed time", () => {
    const withBuffer = computeBudget({
      ...comfortableWeek,
      activities: [{ id: "x", name: "X", durationMinutes: 60, sessionsPerWeek: 1, priority: "medium", bufferMinutes: 15 }],
    })
    expect(withBuffer.requestedMinutes).toBe(90)
  })
})
