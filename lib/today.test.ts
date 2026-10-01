import { describe, expect, it } from "vitest"
import { dayStatus, momentOf, pendingCheck } from "./today"
import type { Day, PlacedBlock } from "./types"

const block = (id: string, day: Day, start: number, end: number, activityId = id): PlacedBlock => ({
  id,
  activityId,
  name: id,
  priority: "medium",
  day,
  startMinute: start,
  endMinute: end,
  locked: false,
  reason: "",
})

const week = [
  block("breakfast#0", 2, 480, 510, "breakfast"),
  block("gym#1", 2, 555, 630, "gym"),
  block("lunch#2", 2, 780, 825, "lunch"),
  block("gym#0", 1, 555, 630, "gym"),
]
const wake = 450
const sleep = 1410

describe("momentOf", () => {
  it("counts days from Monday", () => {
    expect(momentOf(new Date(2026, 8, 30, 9, 30))).toEqual({ day: 2, minute: 570 }) // a Wednesday
  })
})

describe("dayStatus", () => {
  it("names the block in progress, the time left and what follows", () => {
    expect(dayStatus(week, wake, sleep, { day: 2, minute: 600 })).toMatchObject({
      kind: "block",
      block: { id: "gym#1" },
      left: 30,
      next: { id: "lunch#2" },
    })
  })

  it("between blocks, says how long the free time runs", () => {
    expect(dayStatus(week, wake, sleep, { day: 2, minute: 700 })).toMatchObject({
      kind: "free",
      until: 780,
      next: { id: "lunch#2" },
    })
  })

  it("after the last block, the free time runs to bedtime", () => {
    expect(dayStatus(week, wake, sleep, { day: 2, minute: 900 })).toEqual({ kind: "free", until: sleep })
  })

  it("knows when the day hasn't started, or is over", () => {
    expect(dayStatus(week, wake, sleep, { day: 2, minute: 400 })).toMatchObject({ kind: "asleep", next: { id: "breakfast#0" } })
    expect(dayStatus(week, wake, sleep, { day: 2, minute: 1420 })).toEqual({ kind: "done" })
  })

  it("only looks at today's blocks", () => {
    expect(dayStatus(week, wake, sleep, { day: 1, minute: 600 })).toMatchObject({ kind: "block", block: { id: "gym#0" } })
  })
})

describe("pendingCheck", () => {
  const activities = new Set(["gym"])

  it("asks about the activity that has ended, not meals", () => {
    expect(pendingCheck(week, { day: 2, minute: 900 }, activities, new Set())?.id).toBe("gym#1")
  })

  it("asks nothing about sessions that were already over when the week was generated", () => {
    expect(pendingCheck(week, { day: 2, minute: 900 }, activities, new Set(), 700)).toBeNull()
    expect(pendingCheck(week, { day: 2, minute: 900 }, activities, new Set(), 600)?.id).toBe("gym#1")
  })

  it("asks nothing while it is still running, or once answered", () => {
    expect(pendingCheck(week, { day: 2, minute: 600 }, activities, new Set())).toBeNull()
    expect(pendingCheck(week, { day: 2, minute: 900 }, activities, new Set(["gym#1"]))).toBeNull()
  })
})
