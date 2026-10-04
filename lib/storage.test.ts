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
  it("keeps what each printer holds through a save and load", () => {
    const sheet = { at: 1, wakeTime: "07:00", sleepTime: "23:00", blocks: [] }
    // The list printed, the grid torn off, never a ticket but Monday's, Friday's torn off.
    const sheets = { list: sheet, grid: null, tickets: { "2026-09-28": sheet, "2026-10-02": null } }
    const back = fromJson(toJson({ ...initialState, printed: sheet, sheets }))?.sheets
    expect(back).toEqual(sheets)
    // Nothing printed anywhere: every printer empty, none torn off.
    expect(fromJson(toJson(initialState))?.sheets).toEqual({})
  })

  it("fills every printer from a save made when one PRINT printed them all", () => {
    const block = (day: number) => ({ id: `b${day}`, activityId: "a", name: "Gym", day, startMinute: 600, endMinute: 660 })
    const printed = { at: 1, wakeTime: "07:00", sleepTime: "23:00", blocks: [block(0), block(4)] }
    const old = { ...initialState, generated: true, currentWeek: "2026-W40", printed, emptied: ["grid"], ticketsTorn: ["2026-10-02"] }
    const { sheets } = fromJson(JSON.stringify(old))!
    expect(sheets?.list).toEqual(printed)
    expect(sheets?.grid).toBeNull()
    // Each day's ticket holds that day's lines; the one torn off stays torn.
    expect(sheets?.tickets?.["2026-09-28"]?.blocks).toEqual([block(0)])
    expect(sheets?.tickets?.["2026-10-01"]?.blocks).toEqual([])
    expect(sheets?.tickets?.["2026-10-02"]).toBeNull()
    // Older still: one tear-off emptied both printers, or only today's ticket could be torn off.
    expect(fromJson(JSON.stringify({ ...old, emptied: undefined, printerEmpty: true }))?.sheets).toMatchObject({ list: null, grid: null })
    expect(fromJson(JSON.stringify({ ...old, ticketsTorn: undefined, ticketTornOn: "2026-09-28" }))?.sheets?.tickets?.["2026-09-28"]).toBeNull()
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
