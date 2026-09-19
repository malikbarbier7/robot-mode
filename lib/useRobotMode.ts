"use client"

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import type { Activity, Day, PlacedBlock, Settings } from "./types"
import { generate } from "./scheduler/generate"
import { computeBudget } from "./scheduler/budget"
import { initialState, load, save, type SavedState } from "./storage"
import { matchesTemplate, templateById, type Template } from "./templates"

export type NotBefore = { day: Day; minuteOfDay: number }

export function nowMarker(date = new Date()): NotBefore {
  return { day: ((date.getDay() + 6) % 7) as Day, minuteOfDay: date.getHours() * 60 + date.getMinutes() }
}

const subscribe = () => () => {}

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

  const addActivity = useCallback((activity: Activity) => {
    setStored((s) => ({ ...s, settings: { ...s.settings, activities: [...s.settings.activities, activity] } }))
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

  const shuffle = useCallback(() => {
    setStored((s) => ({ ...s, settings: { ...s.settings, seed: s.settings.seed + 1 } }))
  }, [])

  const applyTemplate = useCallback((template: Template) => {
    setStored({ ...initialState, settings: { ...template.settings }, templateId: template.id })
    setNotBefore(null)
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
    markMissed,
    shuffle,
    applyTemplate,
    activeTemplate,
    templateEdited,
    resetToTemplate,
    freshWeek,
    replaceState,
    bumpExport,
  }
}

export type RobotMode = ReturnType<typeof useRobotMode>
export type { PlacedBlock }
