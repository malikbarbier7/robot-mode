import { describe, expect, it } from "vitest"
import type { Settings } from "@/lib/types"
import { generate } from "./generate"
import { parseTime } from "./time"

const base: Settings = {
  wakeTime: "07:30",
  sleepTime: "23:30",
  seed: 1,
  activities: [],
}

describe("preferred windows", () => {
  it("honours a window that opens before wake time", () => {
    // The "Morning" preset is 06:00-12:00, earlier than a 07:30 wake. It must be
    // clipped to the waking day, not pushed to the following morning.
    const s = generate({
      ...base,
      activities: [
        { id: "gym", name: "Gym", durationMinutes: 75, sessionsPerWeek: 3, window: { start: "06:00", end: "12:00" } },
      ],
    })
    expect(s.unplaced).toEqual([])
    for (const b of s.blocks) {
      expect(b.startMinute).toBeGreaterThanOrEqual(parseTime("07:30"))
      expect(b.endMinute).toBeLessThanOrEqual(parseTime("12:00"))
      expect(b.reason).not.toContain("No room")
    }
  })

  it("keeps a late window on the same evening", () => {
    const s = generate({
      ...base,
      sleepTime: "02:00",
      activities: [
        { id: "read", name: "Reading", durationMinutes: 60, sessionsPerWeek: 3, window: { start: "22:00", end: "01:00" } },
      ],
    })
    expect(s.unplaced).toEqual([])
    for (const b of s.blocks) {
      expect(b.startMinute).toBeGreaterThanOrEqual(parseTime("22:00"))
      expect(b.endMinute).toBeLessThanOrEqual(24 * 60 + 60)
      expect(b.reason).not.toContain("No room")
    }
  })

  it("reads a post-midnight window as tonight for a night owl", () => {
    const s = generate({
      ...base,
      wakeTime: "10:00",
      sleepTime: "02:00",
      activities: [
        { id: "late", name: "Late shift", durationMinutes: 60, sessionsPerWeek: 3, window: { start: "00:30", end: "02:00" } },
      ],
    })
    expect(s.unplaced).toEqual([])
    for (const b of s.blocks) {
      expect(b.startMinute).toBeGreaterThanOrEqual(24 * 60 + 30)
      expect(b.reason).not.toContain("No room")
    }
  })

  it("still reports a genuinely impossible window honestly", () => {
    const s = generate({
      ...base,
      activities: [
        { id: "x", name: "Long thing", durationMinutes: 240, sessionsPerWeek: 1, window: { start: "08:00", end: "09:00" } },
      ],
    })
    expect(s.blocks[0].reason).toContain("No room")
  })
})
