import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { interpret } from "./command"
import { generate } from "./scheduler"
import { guides } from "./guides"
import { templates } from "./templates"

const dir = join(__dirname, "../app/guides")

describe("guides", () => {
  it("each have a page, and each page is a guide", () => {
    const pages = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    expect(pages.sort()).toEqual(guides.map((g) => g.slug).sort())
  })

  it("only show lines the machine understands", () => {
    // Read against a week that has the activities the guides talk about.
    const student = templates.find((t) => t.id === "student")!.settings
    const ctx = { ...student, sessions: generate(student).blocks.map((b) => ({ id: b.id, activityId: b.activityId, day: b.day, start: b.startMinute, end: b.endMinute })) }
    for (const g of guides) {
      const source = readFileSync(join(dir, g.slug, "page.tsx"), "utf8")
      const lines = [...source.matchAll(/<Typed>([^<]+)<\/Typed>/g)].map((m) => m[1])
      expect(lines.length, g.slug).toBeGreaterThan(0)
      for (const line of lines) {
        const action = interpret(line, ctx)
        expect(action?.kind, `${g.slug}: "${line}" → ${action?.reply}`).not.toBe("error")
        expect(action, `${g.slug}: "${line}"`).not.toBeNull()
      }
    }
  })
})
