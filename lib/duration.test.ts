import { describe, expect, it } from "vitest"
import { parseDuration } from "./duration"

describe("parseDuration", () => {
  it("reads hours and minutes in the usual spellings", () => {
    expect(parseDuration("1h15")).toBe(75)
    expect(parseDuration("1h")).toBe(60)
    expect(parseDuration("1:30")).toBe(90)
    expect(parseDuration("45m")).toBe(45)
    expect(parseDuration("90")).toBe(90)
  })

  it("reads a bare small number as hours, not a few minutes", () => {
    expect(parseDuration("2")).toBe(120)
    expect(parseDuration("9")).toBe(540)
    expect(parseDuration("10")).toBe(10)
  })

  it("still allows a few minutes when they are spelled out", () => {
    expect(parseDuration("5m")).toBe(5)
  })

  it("rejects what it cannot read", () => {
    expect(parseDuration("")).toBeNull()
    expect(parseDuration("soon")).toBeNull()
  })
})
