import { describe, expect, it } from "vitest"
import { buildIcs, mondayOf } from "./ics"
import { generate } from "./scheduler/generate"
import { comfortableWeek } from "./fixtures/weeks"

const weekStart = new Date(2026, 8, 21) // Monday 21 September 2026
const now = new Date(Date.UTC(2026, 8, 19, 12, 0, 0))

describe("ics export", () => {
  const blocks = generate(comfortableWeek).blocks
  const ics = buildIcs(blocks, { sequence: 0, weekStart, now })

  it("is a single named calendar", () => {
    expect(ics).toContain("X-WR-CALNAME:Robot Mode")
    expect(ics.match(/BEGIN:VCALENDAR/g)).toHaveLength(1)
  })

  it("emits one event per block", () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(blocks.length)
  })

  it("uses CRLF line endings", () => {
    expect(ics.split("\r\n").length).toBeGreaterThan(10)
    expect(/[^\r]\n/.test(ics)).toBe(false)
  })

  it("gives every event a unique UID", () => {
    const uids = [...ics.matchAll(/^UID:(.+)$/gm)].map((m) => m[1])
    expect(new Set(uids).size).toBe(uids.length)
  })

  it("keeps UIDs stable across regenerations, so re-import replaces", () => {
    const again = buildIcs(generate(comfortableWeek).blocks, { sequence: 1, weekStart, now })
    const uidsOf = (s: string) => new Set([...s.matchAll(/^UID:(.+)$/gm)].map((m) => m[1]))
    expect(uidsOf(again)).toEqual(uidsOf(ics))
  })

  it("keeps UIDs stable even when a block moves day", () => {
    const moved = blocks.map((b) => ({ ...b, day: 6 as const }))
    const uidsOf = (s: string) => [...s.matchAll(/^UID:(.+)$/gm)].map((m) => m[1]).sort()
    expect(uidsOf(buildIcs(moved, { sequence: 2, weekStart, now }))).toEqual(uidsOf(ics))
  })

  it("bumps SEQUENCE so clients accept updates", () => {
    expect(buildIcs(blocks, { sequence: 3, weekStart, now })).toContain("SEQUENCE:3")
  })

  it("writes local floating times against the week's Monday", () => {
    // Breakfast is anchored at 08:00, so Monday's event starts 21 Sep at 08:00 local.
    const monday = blocks.find((b) => b.day === 0 && b.activityId === "breakfast")!
    expect(monday.startMinute).toBe(8 * 60)
    expect(ics).toContain("DTSTART:20260921T080000")
    expect(ics).toContain("DTEND:20260921T083000")
  })

  it("escapes reserved characters", () => {
    const tricky = [{ ...blocks[0], name: "Gym; lift, hard\\fast" }]
    const out = buildIcs(tricky, { sequence: 0, weekStart, now })
    expect(out).toContain("SUMMARY:Gym\; lift\\, hard\\\\fast")
  })

  it("folds long lines to 75 octets", () => {
    const long = [{ ...blocks[0], name: "A".repeat(200) }]
    const out = buildIcs(long, { sequence: 0, weekStart, now })
    for (const line of out.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75)
  })
})

describe("mondayOf", () => {
  it("returns the same Monday for every day of that week", () => {
    const days = [21, 22, 23, 24, 25, 26, 27].map((d) => mondayOf(new Date(2026, 8, d)))
    for (const d of days) expect(d.getTime()).toBe(new Date(2026, 8, 21).getTime())
  })
})
