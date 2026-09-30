import { describe, expect, it } from "vitest"
import { detectClock, formatClock, formatSpan, from12, localizeTimes, to12, weekOrder } from "./locale"

describe("12-hour conversion", () => {
  it("puts midnight and noon at 12", () => {
    expect(to12(0)).toEqual({ hour: 12, period: "am" })
    expect(to12(12)).toEqual({ hour: 12, period: "pm" })
    expect(to12(7)).toEqual({ hour: 7, period: "am" })
    expect(to12(23)).toEqual({ hour: 11, period: "pm" })
  })

  it("round-trips every hour", () => {
    for (let h = 0; h < 24; h++) {
      const { hour, period } = to12(h)
      expect(from12(hour, period)).toBe(h)
    }
  })
})

describe("formatClock", () => {
  it("writes 24h with leading zeros and 12h without", () => {
    expect(formatClock(450, "24h")).toBe("07:30")
    expect(formatClock(450, "12h")).toBe("7:30 AM")
    expect(formatClock(0, "12h")).toBe("12:00 AM")
    expect(formatClock(12 * 60 + 5, "12h")).toBe("12:05 PM")
  })

  it("wraps past midnight", () => {
    expect(formatClock(1440 + 30, "24h")).toBe("00:30")
    expect(formatClock(1440 + 30, "12h")).toBe("12:30 AM")
  })

  it("drops :00 in compact 12h labels only", () => {
    expect(formatClock(480, "12h", { compact: true })).toBe("8 AM")
    expect(formatClock(510, "12h", { compact: true })).toBe("8:30 AM")
    expect(formatClock(480, "24h", { compact: true })).toBe("08:00")
  })
})

describe("localizeTimes", () => {
  it("rewrites times inside a sentence for 12h, and leaves 24h alone", () => {
    const text = "Blocked by Gym at 14:00 and Lunch at 09:30"
    expect(localizeTimes(text, "12h")).toBe("Blocked by Gym at 2:00 PM and Lunch at 9:30 AM")
    expect(localizeTimes(text, "24h")).toBe(text)
  })

  it("ignores things that only look a bit like times", () => {
    expect(localizeTimes("3/4 placed, 24:00 is not a time", "12h")).toBe("3/4 placed, 24:00 is not a time")
  })
})

describe("formatSpan", () => {
  it("writes lengths with units so they can't pass for clock times", () => {
    expect(formatSpan(75)).toBe("1H 15M")
    expect(formatSpan(45)).toBe("45M")
    expect(formatSpan(120)).toBe("2H")
  })
})

describe("weekOrder", () => {
  it("starts on Monday by default and can start on Sunday", () => {
    expect(weekOrder("monday")).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(weekOrder("sunday")).toEqual([6, 0, 1, 2, 3, 4, 5])
  })
})

describe("detectClock", () => {
  it("reads the locale's hour cycle", () => {
    expect(detectClock("en-US")).toBe("12h")
    expect(detectClock("fr-FR")).toBe("24h")
    expect(detectClock("en-GB")).toBe("24h")
  })
})
