import { describe, expect, it } from "vitest"
import type { PlacedBlock } from "./types"
import { minutesUntil, pickNow } from "./now"

const block = (id: string, day: number, start: number, end: number): PlacedBlock => ({
  id,
  activityId: id,
  name: id,
  priority: "medium",
  day: day as PlacedBlock["day"],
  startMinute: start,
  endMinute: end,
  locked: false,
  reason: "",
})

const monday = [block("work", 0, 9 * 60, 12 * 60), block("lunch", 0, 13 * 60, 14 * 60)]

describe("pickNow", () => {
  it("finds the block in progress", () => {
    const { current } = pickNow(monday, 0, 10 * 60)
    expect(current?.id).toBe("work")
  })

  it("reports free time between blocks", () => {
    const { current, next } = pickNow(monday, 0, 12 * 60 + 30)
    expect(current).toBeNull()
    expect(next?.id).toBe("lunch")
  })

  it("treats the end of a block as free", () => {
    expect(pickNow(monday, 0, 12 * 60).current).toBeNull()
  })

  it("keeps a past-midnight block current after midnight", () => {
    // Saturday 23:30–00:30 is day 5, minutes 1410–1470. At 00:10 it is still running.
    const late = [block("reading", 5, 1410, 1470)]
    const { current } = pickNow(late, 6, 10)
    expect(current?.id).toBe("reading")
  })

  it("falls through to the next day when today is done", () => {
    const week = [...monday, block("breakfast", 1, 8 * 60, 8 * 60 + 30)]
    const { current, next, nextIsToday } = pickNow(week, 0, 22 * 60)
    expect(current).toBeNull()
    expect(next?.id).toBe("breakfast")
    expect(nextIsToday).toBe(false)
  })

  it("wraps from Sunday night to Monday morning", () => {
    const { next } = pickNow(monday, 6, 23 * 60)
    expect(next?.id).toBe("work")
  })

  it("returns nothing for an empty week", () => {
    expect(pickNow([], 0, 600)).toEqual({ current: null, next: null, nextIsToday: false })
  })
})

describe("minutesUntil", () => {
  it("counts forward within the week", () => {
    expect(minutesUntil(monday[1], 0, 12 * 60)).toBe(60)
  })

  it("wraps around the end of the week", () => {
    expect(minutesUntil(monday[0], 6, 23 * 60)).toBe(600)
  })
})
