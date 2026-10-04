import { describe, expect, it } from "vitest"
import { dateInWeek, dayKey, dayTimeline, isoWeek, samePrint, ticketDay, weekKey } from "./printout"
import type { PlacedBlock } from "./types"

const block = (id: string, start: number, end: number): PlacedBlock => ({
  id,
  priority: "medium",
  activityId: id,
  name: id,
  day: 0,
  startMinute: start,
  endMinute: end,
  locked: false,
  reason: "",
})

describe("dayTimeline", () => {
  it("lists wake, the blocks in order, then sleep, with no free-time lines", () => {
    const rows = dayTimeline([block("gym", 600, 675), block("breakfast", 480, 510)], 450, 1410)
    expect(rows.map((r) => [r.kind, r.minute])).toEqual([
      ["wake", 450],
      ["block", 480],
      ["block", 600],
      ["sleep", 1410],
    ])
  })

  it("keeps a bedtime after midnight past 1440", () => {
    const rows = dayTimeline([], 450, 1500)
    expect(rows.at(-1)).toEqual({ kind: "sleep", minute: 1500 })
  })
})

describe("isoWeek", () => {
  it("numbers weeks the ISO way, including across a year boundary", () => {
    expect(isoWeek(new Date(2026, 8, 29))).toEqual({ week: 40, year: 2026 })
    expect(isoWeek(new Date(2027, 0, 1))).toEqual({ week: 53, year: 2026 })
  })
})

describe("samePrint", () => {
  const hours = { wakeTime: "07:00", sleepTime: "23:00" }
  const week = [block("gym", 600, 660), block("read", 1200, 1260)]
  const printed = { at: 0, ...hours, blocks: week }

  it("is true while the screen shows what is on paper", () => {
    expect(samePrint(printed, hours, [...week].reverse())).toBe(true)
  })

  it("is false once anything is moved, locked, added or the hours change", () => {
    expect(samePrint(printed, hours, [week[0], { ...week[1], startMinute: 1230, endMinute: 1290 }])).toBe(false)
    expect(samePrint(printed, hours, [week[0], { ...week[1], locked: true }])).toBe(false)
    expect(samePrint(printed, hours, [...week, block("walk", 800, 830)])).toBe(false)
    expect(samePrint(printed, { ...hours, sleepTime: "23:30" }, week)).toBe(false)
  })

  it("is false with nothing printed yet", () => {
    expect(samePrint(null, hours, week)).toBe(false)
    expect(samePrint(undefined, hours, [])).toBe(false)
  })
})

describe("dateInWeek", () => {
  it("finds each day of an ISO week, across year ends", () => {
    expect(dayKey(dateInWeek("2026-W40", 0))).toBe("2026-09-28")
    expect(dayKey(dateInWeek("2026-W40", 6))).toBe("2026-10-04")
    // Week 1 of 2026 starts on Monday 29 December 2025.
    expect(dayKey(dateInWeek("2026-W01", 0))).toBe("2025-12-29")
    expect(dayKey(dateInWeek("2020-W53", 4))).toBe("2021-01-01")
    // Round trip with weekKey.
    expect(weekKey(dateInWeek("2027-W17", 3))).toBe("2027-W17")
  })
})

describe("ticketDay", () => {
  it("reads the ticket's own day, or the tear-off on older tickets", () => {
    expect(dayKey(ticketDay({ day: "2026-10-05", filedAt: new Date(2026, 9, 4, 21).getTime() }))).toBe("2026-10-05")
    expect(dayKey(ticketDay({ filedAt: new Date(2026, 9, 4, 21).getTime() }))).toBe("2026-10-04")
  })
})
