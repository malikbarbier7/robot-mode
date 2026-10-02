import { describe, expect, it } from "vitest"
import { momentOf } from "./today"

describe("momentOf", () => {
  it("counts days from Monday", () => {
    expect(momentOf(new Date(2026, 8, 30, 9, 30))).toEqual({ day: 2, minute: 570 }) // a Wednesday
  })
})
