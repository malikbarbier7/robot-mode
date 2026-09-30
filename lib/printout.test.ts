import { describe, expect, it } from "vitest"
import { dayTimeline, isoWeek } from "./printout"
import type { PlacedBlock } from "./types"

const block = (id: string, start: number, end: number): PlacedBlock => ({
  id,
  activityId: id,
  name: id,
  priority: "medium",
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
