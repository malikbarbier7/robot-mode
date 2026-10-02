"use client"

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import type { Activity, Day, PlacedBlock, Settings } from "./types"
import { generate, readSkip } from "./scheduler/generate"
import { computeBudget } from "./scheduler/budget"
import { initialState, load, save, type ArchivedWeek, type Display, type SavedState, type Sheet } from "./storage"
import { detectClock, type Clock, type WeekStart } from "./locale"
import { matchesTemplate, templateById, type Template } from "./templates"
import { dayKey, isoWeek, weekKey } from "./printout"

/** How many filed weeks the binder keeps: two years. */
const BINDER_SIZE = 104
/** Tickets are daily: they get their own, shorter, shelf so they never push filed weeks out. */
const TICKET_SHELF = 60

/** A sheet put on top of the binder, the oldest of its kind dropping off when its shelf is full. */
function fileSheet(archive: ArchivedWeek[] | undefined, sheet: ArchivedWeek): ArchivedWeek[] {
  const all = [sheet, ...(archive ?? [])]
  const tickets = all.filter((w) => w.format === "ticket").slice(0, TICKET_SHELF)
  const weeks = all.filter((w) => w.format !== "ticket").slice(0, BINDER_SIZE)
  const kept = new Set([...tickets, ...weeks])
  return all.filter((w) => kept.has(w))
}

const subscribe = () => () => {}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "activity"
}

export function useRobotMode() {
  // `load()` returns the defaults on the server, so this initialiser is SSR-safe.
  const [stored, setStored] = useState<SavedState>(load)

  // False during SSR and the hydrating render, true afterwards.
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )

  /**
   * Every consumer must see the same thing on the server and on the hydrating
   * render. Exposing `stored` directly meant the saved week reached the header
   * one render early, so button labels and `disabled` flags differed from the
   * server markup and React threw a hydration error.
   */
  const state = hydrated ? stored : initialState

  useEffect(() => {
    if (hydrated) save(state)
  }, [state, hydrated])

  // Ask the browser to keep the setup through storage clean-ups: Safari otherwise
  // drops it after a week without a visit, which is exactly how often this is opened.
  useEffect(() => {
    if (hydrated) void navigator.storage?.persist?.().catch(() => {})
  }, [hydrated])

  const schedule = useMemo(
    () =>
      generate(state.settings, {
        locked: state.locked,
        skip: state.skipped,
      }),
    [state.settings, state.locked, state.skipped],
  )

  // Independent of the solver so the bar can update while typing.
  const budget = useMemo(() => computeBudget(state.settings), [state.settings])

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setStored((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  }, [])

  /**
   * The id is derived from the current list rather than randomised, so adding is
   * a pure state update and ids stay readable (gym, gym-2, ...).
   */
  const addActivity = useCallback((activity: Omit<Activity, "id">) => {
    setStored((s) => {
      const base = slugify(activity.name)
      const used = new Set(s.settings.activities.map((a) => a.id))
      let id = base
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`
      return {
        ...s,
        settings: { ...s.settings, activities: [...s.settings.activities, { ...activity, id }] },
      }
    })
  }, [])

  const updateActivity = useCallback((id: string, patch: Partial<Activity>) => {
    setStored((s) => ({
      ...s,
      settings: {
        ...s.settings,
        activities: s.settings.activities.map((a) =>
          a.id === id
            ? { ...a, ...patch }
            : // An extra session carries its activity's name.
              a.extraOf === id && patch.name !== undefined
              ? { ...a, name: patch.name }
              : a,
        ),
      },
      // Locks and skips refer to sessions of this activity, which may no longer exist.
      locked: s.locked.filter((b) => b.activityId !== id),
      skipped: s.skipped.filter((key) => !key.startsWith(`${id}#`)),
    }))
  }, [])

  const removeActivity = useCallback((id: string) => {
    setStored((s) => {
      // Its extra sessions go with it.
      const gone = new Set([id, ...s.settings.activities.filter((a) => a.extraOf === id).map((a) => a.id)])
      return {
        ...s,
        settings: { ...s.settings, activities: s.settings.activities.filter((a) => !gone.has(a.id)) },
        locked: s.locked.filter((b) => !gone.has(b.activityId)),
        skipped: s.skipped.filter((key) => !gone.has(key.split("#")[0])),
      }
    })
  }, [])

  const toggleLock = useCallback(
    (blockId: string) => {
      setStored((s) => {
        const already = s.locked.find((b) => b.id === blockId)
        if (already) return { ...s, locked: s.locked.filter((b) => b.id !== blockId) }
        const block = schedule.blocks.find((b) => b.id === blockId)
        return block ? { ...s, locked: [...s.locked, { ...block, locked: true }] } : s
      })
    },
    [schedule.blocks],
  )

  const removeBlock = useCallback(
    (blockId: string) => {
      // Kept with its day, so the week stays without it on that day rather than wherever the re-solve frees.
      const block = schedule.blocks.find((b) => b.id === blockId)
      const entry = block ? `${blockId}@${block.day}` : blockId
      setStored((s) => ({
        ...s,
        locked: s.locked.filter((b) => b.id !== blockId),
        skipped: s.skipped.some((k) => readSkip(k).key === blockId) ? s.skipped : [...s.skipped, entry],
      }))
    },
    [schedule.blocks],
  )

  /**
   * Put a block somewhere else and keep it there: it becomes a locked block at
   * the new time, and the rest of the week is solved around it. Refused (with
   * the reason) when it would land on another locked block.
   */
  const moveBlock = useCallback(
    (blockId: string, day: Day, startMinute: number): string | null => {
      const block = schedule.blocks.find((b) => b.id === blockId)
      if (!block) return "That block is no longer in the week"
      const endMinute = startMinute + (block.endMinute - block.startMinute)
      const clash = state.locked.find(
        (b) => b.id !== blockId && b.day === day && b.startMinute < endMinute && startMinute < b.endMinute,
      )
      if (clash) return `${clash.name} is locked there`
      const moved: PlacedBlock = { ...block, day, startMinute, endMinute, locked: true, reason: "Moved here by you" }
      setStored((s) => ({
        ...s,
        locked: [...s.locked.filter((b) => b.id !== blockId), moved],
        skipped: s.skipped.filter((k) => readSkip(k).key !== blockId),
      }))
      return null
    },
    [schedule.blocks, state.locked],
  )

  const shuffle = useCallback(() => {
    setStored((s) => ({ ...s, settings: { ...s.settings, seed: s.settings.seed + 1 } }))
  }, [])

  const applyTemplate = useCallback((template: Template) => {
    setStored({ ...initialState, settings: { ...template.settings }, templateId: template.id })
  }, [])

  /** A setup opened from a link: it replaces the list and hours, and the week is solved afresh. */
  const loadSetup = useCallback((settings: Settings) => {
    setStored((s) => ({ ...initialState, settings, exportSequence: s.exportSequence, display: s.display, archive: s.archive }))
  }, [])

  /** Flipped by the Generate button. The week view only exists after this. */
  const markGenerated = useCallback(() => {
    setStored((s) => ({ ...s, generated: true, currentWeek: weekKey(new Date()) }))
  }, [])

  /** Back to the list, without throwing the schedule away. */
  const unmarkGenerated = useCallback(() => {
    setStored((s) => ({ ...s, generated: false }))
  }, [])

  /** The template this week came from, if it is still a known one. */
  const activeTemplate = useMemo(() => templateById(state.templateId), [state.templateId])

  /** Whether the activity list has drifted from that template. */
  const templateEdited = useMemo(
    () => (activeTemplate ? !matchesTemplate(state.settings, activeTemplate) : false),
    [activeTemplate, state.settings],
  )

  /** Put the activities, times and meals back the way the template had them. */
  const resetToTemplate = useCallback(() => {
    if (!activeTemplate) return
    setStored((s) => ({
      ...initialState,
      // A shuffled seed is not an edit, so it survives the reset.
      settings: { ...activeTemplate.settings, seed: s.settings.seed },
      exportSequence: s.exportSequence,
      templateId: activeTemplate.id,
    }))
  }, [activeTemplate])

  /**
   * Tear a sheet off: the week as it stood goes into the binder and that
   * printer stands empty; the other keeps its sheet. Mid-week that is all: a
   * copy filed. Once the week is over (`newWeek`), its adjustments are cleared
   * too, and the activities and settings stay for the next one.
   */
  const tearWeek = useCallback((format: Sheet, newWeek: boolean) => {
    const now = new Date()
    setStored((s) => {
      const [year, w] = (s.currentWeek ?? weekKey(now)).split("-W").map(Number)
      const { week: thisWeek, year: thisYear } = isoWeek(now)
      const filed: ArchivedWeek = {
        id: `${year}-W${w}-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
        week: w || thisWeek,
        year: year || thisYear,
        filedAt: now.getTime(),
        wakeTime: s.settings.wakeTime,
        sleepTime: s.settings.sleepTime,
        blocks: schedule.blocks,
        format,
      }
      return {
        ...s,
        ...(newWeek ? { locked: [], skipped: [], currentWeek: weekKey(now) } : { currentWeek: s.currentWeek ?? weekKey(now) }),
        archive: fileSheet(s.archive, filed),
        emptied: [...new Set([...(s.emptied ?? []), format])],
      }
    })
  }, [schedule.blocks])

  /**
   * File today's ticket: that day's lines, as they stand. Unlike tearing the
   * week off, nothing about the week changes: no edits cleared, no new week begun.
   */
  const tearTicket = useCallback(
    (now: Date) => {
      const day = ((now.getDay() + 6) % 7) as Day
      const { week, year } = isoWeek(now)
      // Its own id, whatever the clock says: two tickets torn within the same minute are still two sheets.
      const id = `${dayKey(now)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setStored((s) => {
        const filed: ArchivedWeek = {
          id,
          week,
          year,
          filedAt: now.getTime(),
          wakeTime: s.settings.wakeTime,
          sleepTime: s.settings.sleepTime,
          blocks: schedule.blocks.filter((b) => b.day === day),
          format: "ticket",
        }
        // One ticket a day: a fresh one torn off later the same day replaces the earlier.
        const others = (s.archive ?? []).filter((w) => !(w.format === "ticket" && dayKey(new Date(w.filedAt)) === dayKey(now)))
        return { ...s, archive: fileSheet(others, filed), ticketTornOn: dayKey(now) }
      })
    },
    [schedule.blocks],
  )

  /** A fresh sheet asked for: one printer (the list's, the grid's or the ticket's), or every empty one, prints again. */
  const refillPrinters = useCallback((which: Sheet | "ticket" | "all") => {
    setStored((s) => ({
      ...s,
      emptied: which === "all" ? [] : (s.emptied ?? []).filter((x) => x !== which),
      ...(which === "ticket" || which === "all" ? { ticketTornOn: undefined } : {}),
    }))
  }, [])

  /** Shred a filed week: gone from the binder for good. */
  const shredFiled = useCallback((id: string) => {
    setStored((s) => ({ ...s, archive: (s.archive ?? []).filter((w) => w.id !== id) }))
  }, [])

  const freshWeek = useCallback(() => {
    setStored((s) => ({ ...s, locked: [], skipped: [] }))
  }, [])

  /**
   * Everything back to a blank machine: activities, meals, hours, the week and
   * its edits. Only the export counter survives, so calendars that imported an
   * earlier week still accept the next export as an update.
   */
  const wipe = useCallback(() => {
    // How times are shown is a preference, not part of the week: it survives.
    // The binder is history, not the week: it survives too.
    setStored((s) => ({ ...initialState, exportSequence: s.exportSequence, display: s.display, archive: s.archive }))
  }, [])

  /**
   * The clock follows the browser until chosen; the week starts on Monday
   * until chosen. Detection waits for hydration so the server markup matches.
   */
  const display = useMemo<{ clock: Clock; weekStart: WeekStart; sound: boolean }>(
    () => ({
      clock: state.display?.clock ?? (hydrated ? detectClock() : "24h"),
      weekStart: state.display?.weekStart ?? "monday",
      // On until switched off: the machine is meant to be heard.
      sound: state.display?.sound ?? true,
    }),
    [state.display, hydrated],
  )

  const setDisplay = useCallback((patch: Display) => {
    setStored((s) => ({ ...s, display: { ...s.display, ...patch } }))
  }, [])

  const replaceState = useCallback((next: SavedState) => {
    setStored(next)
  }, [])

  const bumpExport = useCallback(() => {
    const sequence = state.exportSequence + 1
    setStored((s) => ({ ...s, exportSequence: sequence }))
    return sequence
  }, [state.exportSequence])

  return {
    state,
    hydrated,
    schedule,
    budget,
    patchSettings,
    addActivity,
    updateActivity,
    removeActivity,
    toggleLock,
    removeBlock,
    moveBlock,
    shuffle,
    applyTemplate,
    loadSetup,
    markGenerated,
    unmarkGenerated,
    activeTemplate,
    templateEdited,
    resetToTemplate,
    freshWeek,
    tearWeek,
    tearTicket,
    refillPrinters,
    shredFiled,
    wipe,
    display,
    setDisplay,
    replaceState,
    bumpExport,
  }
}

export type RobotMode = ReturnType<typeof useRobotMode>
export type { PlacedBlock }
