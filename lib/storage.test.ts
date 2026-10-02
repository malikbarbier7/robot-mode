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

  it("keeps the week on paper apart from the draft", () => {
    const printed = { at: 1, wakeTime: "07:00", sleepTime: "23:00", blocks: [] }
    expect(fromJson(toJson({ ...initialState, printed }))?.printed).toEqual(printed)
    // Drafted, never printed: stays null, so the old week isn't printed for you.
    expect(fromJson(toJson({ ...initialState, printed: null }))?.printed).toBeNull()
    // Nothing generated: nothing to print.
    expect(fromJson(toJson(initialState))?.printed).toBeUndefined()
    expect(fromJson(JSON.stringify({ ...initialState, printed: { blocks: "no" } }))?.printed).toBeUndefined()
  })

  it("prints the week of a save from before the paper was a copy", () => {
    const settings = templates.find((t) => t.id === "student")!.settings
    const old = fromJson(JSON.stringify({ ...initialState, settings, generated: true }))
    expect(old?.printed?.blocks.length).toBeGreaterThan(0)
    expect(old?.printed).toMatchObject({ wakeTime: settings.wakeTime, sleepTime: settings.sleepTime })
  })
})
