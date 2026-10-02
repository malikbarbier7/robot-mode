import { describe, expect, it } from "vitest"
import { matchesTemplate, templateById, templates } from "./templates"
import { computeBudget } from "./scheduler/budget"
import { generate } from "./scheduler/generate"

describe("templates", () => {
  it("is listed in the order the picker should show", () => {
    expect(templates.map((t) => t.id)).toEqual([
      "student",
      "entrepreneur",
      "worker",
      "fitness",
      "exam",
      "deep-work",
      "blank",
    ])
  })

  it("keeps the blank one last, as the opt-out", () => {
    expect(templates.at(-1)?.id).toBe("blank")
    expect(templates.at(-1)?.settings.activities).toEqual([])
  })

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

describe("templateById", () => {
  it("finds a known template", () => {
    expect(templateById("entrepreneur")?.name).toBe("Entrepreneur")
  })

  it("returns undefined for an unknown or missing id", () => {
    expect(templateById("nope")).toBeUndefined()
    expect(templateById(undefined)).toBeUndefined()
  })
})

describe("matchesTemplate", () => {
  const student = templates.find((t) => t.id === "student")!

  it("matches the template's own settings", () => {
    expect(matchesTemplate(student.settings, student)).toBe(true)
  })

  it("ignores the seed, since shuffling is not an edit", () => {
    expect(matchesTemplate({ ...student.settings, seed: 99 }, student)).toBe(true)
  })

  it("notices an added activity", () => {
    const edited = {
      ...student.settings,
      activities: [
        ...student.settings.activities,
        { id: "piano", name: "Piano", durationMinutes: 45, sessionsPerWeek: 3, priority: "medium" as const },
      ],
    }
    expect(matchesTemplate(edited, student)).toBe(false)
  })

  it("notices a removed activity", () => {
    const edited = { ...student.settings, activities: student.settings.activities.slice(1) }
    expect(matchesTemplate(edited, student)).toBe(false)
  })

  it("notices a changed duration", () => {
    const activities = student.settings.activities.map((a, i) =>
      i === 0 ? { ...a, durationMinutes: a.durationMinutes + 15 } : a,
    )
    expect(matchesTemplate({ ...student.settings, activities }, student)).toBe(false)
  })

  it("notices changed wake, sleep or free time", () => {
    expect(matchesTemplate({ ...student.settings, wakeTime: "06:00" }, student)).toBe(false)
    expect(matchesTemplate({ ...student.settings, sleepTime: "22:00" }, student)).toBe(false)
    expect(matchesTemplate({ ...student.settings, wakeTime: "05:00" }, student)).toBe(false)
  })

  it("does not match a different template", () => {
    const worker = templates.find((t) => t.id === "worker")!
    expect(matchesTemplate(worker.settings, student)).toBe(false)
  })
})
