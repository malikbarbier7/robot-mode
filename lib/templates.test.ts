import { describe, expect, it } from "vitest"
import { templates } from "./templates"
import { computeBudget } from "./scheduler/budget"
import { generate } from "./scheduler/generate"

describe("templates", () => {
  it("has unique ids", () => {
    const ids = templates.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  for (const template of templates) {
    describe(template.name, () => {
      it("fits inside the week's budget", () => {
        expect(computeBudget(template.settings).feasible, template.name).toBe(true)
      })

      it("schedules every session without overlaps", () => {
        const schedule = generate(template.settings)
        expect(schedule.unplaced, template.name).toEqual([])

        for (let day = 0; day < 7; day++) {
          const blocks = schedule.blocks
            .filter((b) => b.day === day)
            .sort((a, b) => a.startMinute - b.startMinute)
          for (let i = 1; i < blocks.length; i++) {
            expect(blocks[i].startMinute, `${template.name} day ${day}`).toBeGreaterThanOrEqual(
              blocks[i - 1].endMinute,
            )
          }
        }
      })

      it("uses unique activity ids", () => {
        const ids = template.settings.activities.map((a) => a.id)
        expect(new Set(ids).size, template.name).toBe(ids.length)
      })
    })
  }
})
