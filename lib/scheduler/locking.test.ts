import { describe, expect, it } from "vitest"
import { generate } from "./generate"
import { templates } from "@/lib/templates"

const student = templates.find((t) => t.id === "student")!.settings
const totalSessions = (s = student) => s.activities.reduce((n, a) => n + a.sessionsPerWeek, 0)

describe("locks and skips together", () => {
  it("places exactly one block per session that is neither locked nor skipped", () => {
    const first = generate(student)
    expect(first.blocks).toHaveLength(totalSessions())

    // Mimic "I missed this": lock everything before Saturday evening, skip one session.
    const skipMe = first.blocks.find((b) => b.activityId === "reading" && b.day === 5)!
    const locked = first.blocks
      .filter((b) => b.id !== skipMe.id && (b.day < 5 || (b.day === 5 && b.startMinute < 1370)))
      .map((b) => ({ ...b, locked: true }))

    const again = generate(student, { locked, skip: [skipMe.id] })

    const ids = again.blocks.map((b) => b.id)
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(duplicates, "a session was placed twice").toEqual([])
    expect(ids).not.toContain(skipMe.id)
    expect(again.blocks).toHaveLength(totalSessions() - 1)
  })

  it("never places a skipped session", () => {
    const first = generate(student)
    const skip = first.blocks.slice(0, 3).map((b) => b.id)
    const again = generate(student, { skip })
    for (const id of skip) expect(again.blocks.map((b) => b.id)).not.toContain(id)
    expect(again.blocks).toHaveLength(totalSessions() - 3)
  })

  it("keeps every locked block exactly where it was, exactly once", () => {
    const first = generate(student)
    const locked = first.blocks.filter((b) => b.day <= 2).map((b) => ({ ...b, locked: true }))
    const again = generate(student, { locked })

    for (const l of locked) {
      const matches = again.blocks.filter((b) => b.id === l.id)
      expect(matches, `${l.id} appears ${matches.length} times`).toHaveLength(1)
      expect(matches[0].day).toBe(l.day)
      expect(matches[0].startMinute).toBe(l.startMinute)
    }
    expect(again.blocks).toHaveLength(totalSessions())
  })
})
