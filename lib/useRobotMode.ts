"use client"

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import type { Activity, Day, PlacedBlock, Settings } from "./types"
import { generate } from "./scheduler/generate"
import { computeBudget } from "./scheduler/budget"
import { initialState, load, save, type Display, type SavedState } from "./storage"
import { detectClock, type Clock, type WeekStart } from "./locale"
import { matchesTemplate, templateById, type Template } from "./templates"
import { isoWeek } from "./printout"

/** "2026-W40": the week a DONE answer belongs to. */
export function weekKey(date = new Date()): string {
  const { week, year } = isoWeek(date)
  return `${year}-W${String(week).padStart(2, "0")}`
}

export type NotBefore = { day: Day; minuteOfDay: number }

export function nowMarker(date = new Date()): NotBefore {
  return { day: ((date.getDay() + 6) % 7) as Day, minuteOfDay: date.getHours() * 60 + date.getMinutes() }
}

const subscribe = () => () => {}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "activity"
}

export function useRobotMode() {
  // `load()` returns the defaults on the server, so this initialiser is SSR-safe.
  const [stored, setStored] = useState<SavedState>(load)
  const [notBefore, setNotBefore] = useState<NotBefore | null>(null)

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

  const schedule = useMemo(
    () =>
      generate(state.settings, {
        locked: state.locked,
        skip: state.skipped,
        ...(notBefore ? { notBefore } : {}),
      }),
    [state.settings, state.locked, state.skipped, notBefore],
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
        activities: s.settings.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      },
      // Locks and skips refer to sessions of this activity, which may no longer exist.
      locked: s.locked.filter((b) => b.activityId !== id),
      skipped: s.skipped.filter((key) => !key.startsWith(`${id}#`)),
    }))
  }, [])

  const removeActivity = useCallback((id: string) => {
    setStored((s) => ({
      ...s,
      settings: { ...s.settings, activities: s.settings.activities.filter((a) => a.id !== id) },
      locked: s.locked.filter((b) => b.activityId !== id),
      skipped: s.skipped.filter((key) => !key.startsWith(`${id}#`)),
    }))
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

  const removeBlock = useCallback((blockId: string) => {
    setStored((s) => ({
      ...s,
      locked: s.locked.filter((b) => b.id !== blockId),
      skipped: s.skipped.includes(blockId) ? s.skipped : [...s.skipped, blockId],
    }))
  }, [])

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
        skipped: s.skipped.filter((id) => id !== blockId),
      }))
      return null
    },
    [schedule.blocks, state.locked],
  )

  /**
   * "I missed this": everything already done stays put, the missed session is
   * dropped, and only the rest of the week is re-solved.
   */
  const markMissed = useCallback(
    (blockId: string) => {
      const marker = nowMarker()
      const past = schedule.blocks.filter(
        (b) => b.id !== blockId && (b.day < marker.day || (b.day === marker.day && b.startMinute < marker.minuteOfDay)),
      )
      setStored((s) => {
        const keep = new Map(s.locked.map((b) => [b.id, b]))
        for (const b of past) keep.set(b.id, { ...b, locked: true })
        return {
          ...s,
          locked: [...keep.values()].filter((b) => b.id !== blockId),
          skipped: s.skipped.includes(blockId) ? s.skipped : [...s.skipped, blockId],
        }
      })
      setNotBefore(marker)
    },
    [schedule.blocks],
  )

  /** "I did this": remembered for the rest of this week, so it isn't asked about again. */
  const markDone = useCallback((blockId: string) => {
    setStored((s) => {
      const week = weekKey()
      const ids = s.done?.week === week ? s.done.ids : []
      return ids.includes(blockId) ? s : { ...s, done: { week, ids: [...ids, blockId] } }
    })
  }, [])

  /** This week's DONE answers; an older week's are ignored. */
  const doneIds = useMemo(
    () => new Set(hydrated && state.done?.week === weekKey() ? state.done.ids : []),
    [hydrated, state.done],
  )

  const shuffle = useCallback(() => {
    setStored((s) => ({ ...s, settings: { ...s.settings, seed: s.settings.seed + 1 } }))
  }, [])

  const applyTemplate = useCallback((template: Template) => {
    setStored({ ...initialState, settings: { ...template.settings }, templateId: template.id })
    setNotBefore(null)
  }, [])

  /** Flipped by the Generate button. The week view only exists after this. */
  const markGenerated = useCallback(() => {
    setStored((s) => ({ ...s, generated: true, generatedAt: Date.now() }))
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

  /** Put the activities, times and free time back the way the template had them. */
  const resetToTemplate = useCallback(() => {
    if (!activeTemplate) return
    setStored((s) => ({
      ...initialState,
      // A shuffled seed is not an edit, so it survives the reset.
      settings: { ...activeTemplate.settings, seed: s.settings.seed },
      exportSequence: s.exportSequence,
      templateId: activeTemplate.id,
    }))
    setNotBefore(null)
  }, [activeTemplate])

  const freshWeek = useCallback(() => {
    setStored((s) => ({ ...s, locked: [], skipped: [] }))
    setNotBefore(null)
  }, [])

  /**
   * Everything back to a blank machine: activities, meals, hours, the week and
   * its edits. Only the export counter survives, so calendars that imported an
   * earlier week still accept the next export as an update.
   */
  const wipe = useCallback(() => {
    // How times are shown is a preference, not part of the week: it survives.
    setStored((s) => ({ ...initialState, exportSequence: s.exportSequence, display: s.display }))
    setNotBefore(null)
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
    setNotBefore(null)
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
    notBefore,
    patchSettings,
    addActivity,
    updateActivity,
    removeActivity,
    toggleLock,
    removeBlock,
    moveBlock,
    markMissed,
    markDone,
    doneIds,
    shuffle,
    applyTemplate,
    markGenerated,
    unmarkGenerated,
    activeTemplate,
    templateEdited,
    resetToTemplate,
    freshWeek,
    wipe,
    display,
    setDisplay,
    replaceState,
    bumpExport,
  }
}

export type RobotMode = ReturnType<typeof useRobotMode>
export type { PlacedBlock }
