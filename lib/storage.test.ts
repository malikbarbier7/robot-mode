import { describe, expect, it } from "vitest"
import { fromJson, initialState, setupFromHash, setupLink, toJson } from "./storage"
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

describe("backup", () => {
  it("keeps the printers empty after a tear-off, through a save and load", () => {
    const torn = { ...initialState, emptied: ["grid" as const], ticketTornOn: "2026-10-02" }
    expect(fromJson(toJson(torn))).toMatchObject({ emptied: ["grid"], ticketTornOn: "2026-10-02" })
    // Saves from before these were kept print as usual.
    expect(fromJson(toJson(initialState))).toMatchObject({ emptied: [], ticketTornOn: undefined })
    // A save from when one tear-off emptied both printers still has both empty.
    expect(fromJson(JSON.stringify({ ...initialState, printerEmpty: true }))).toMatchObject({ emptied: ["list", "grid"] })
  })
})
