import { describe, expect, it } from "vitest"
import { setupFromHash, setupLink } from "./storage"
import { templates } from "./templates"

describe("setup link", () => {
  const settings = templates.find((t) => t.id === "student")!.settings

  it("carries the setup there and back", () => {
    const link = setupLink(settings, "https://robot.mode/#old")
    expect(link.startsWith("https://robot.mode/#setup=")).toBe(true)
    expect(setupFromHash(new URL(link).hash)).toEqual(settings)
  })

  it("survives names outside ASCII", () => {
    const named = { ...settings, activities: [{ id: "cafe", name: "Café ☕ 読書", durationMinutes: 30, sessionsPerWeek: 2 }] }
    expect(setupFromHash(new URL(setupLink(named, "https://x/")).hash)?.activities[0].name).toBe("Café ☕ 読書")
  })

  it("ignores hashes that are not a setup", () => {
    expect(setupFromHash("")).toBeNull()
    expect(setupFromHash("#top")).toBeNull()
    expect(setupFromHash("#setup=not-base64!!")).toBeNull()
    expect(setupFromHash(`#setup=${btoa(JSON.stringify({ hello: 1 }))}`)).toBeNull()
  })
})
