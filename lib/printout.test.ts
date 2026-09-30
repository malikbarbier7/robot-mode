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
  it("lists wake, blocks in order with the free time between, then sleep", () => {
    const rows = dayTimeline([block("gym", 600, 675), block("breakfast", 480, 510)], 450, 1410)
    expect(rows.map((r) => [r.kind, r.minute])).toEqual([
      ["wake", 450],
      ["free", 450],
      ["block", 480],
      ["free", 510],
      ["block", 600],
      ["free", 675],
      ["sleep", 1410],
    ])
  })

  it("leaves out gaps too short to be free time", () => {
    const rows = dayTimeline([block("a", 460, 600)], 450, 610)
    expect(rows.map((r) => r.kind)).toEqual(["wake", "block", "sleep"])
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
