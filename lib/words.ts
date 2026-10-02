"use client"

import { createContext, useContext } from "react"

/**
 * The machine's own words: its name, its units, what it prints on its paper
 * and says on its screens. Kept apart from the components so a theme (another
 * "model" of the machine) can rename everything at once without touching how
 * anything works. Command words (ADD, EDIT, TEAR…) are not here: those are
 * the language people type, and stay the same in every model.
 */
export type Words = {
  /** The name as the nameplate shows it, and as it is read aloud. */
  logo: string
  name: string
  /** The model number stamped on every unit. */
  model: string
  boot: { subtitle: string; ready: string; start: string; tap: string; display: string; screen: string }
  printers: {
    line: { name: string; spec: string }
    plotter: { name: string; spec: string }
    ticket: { name: string; spec: string }
  }
  sheet: { generated: string; filed: string; unit: string; ticket: string; motto: string }
  binder: {
    title: string
    subtitle: string
    unit: string
    spine: string
    empty: string
    shredder: string
    drop: string
    release: string
    shredding: string
    tearOff: string
  }
  help: { title: string }
}

/** RM-01: the 1970s laboratory instrument every week comes out of. */
export const DEFAULT_WORDS: Words = {
  // The Cyrillic Б is the nameplate's one flourish, read aloud as a plain B.
  logo: "ROБOT MODE",
  name: "Robot Mode",
  model: "RM-01",
  boot: {
    subtitle: "Personal scheduling computer",
    ready: "System ready",
    start: "Press Enter to start",
    tap: "Tap to start",
    display: "Display 01",
    screen: "Amber phosphor · 80 col",
  },
  printers: {
    line: { name: "RM-01 · Line printer", spec: "9-pin · 80 col" },
    plotter: { name: "RM-01 · Plotter", spec: "4-pen · 7 col" },
    ticket: { name: "RM-01 · Ticket", spec: "Thermal · 58 mm" },
  },
  sheet: {
    generated: "Automatically generated",
    filed: "Torn off and filed",
    unit: "Unit RM-01",
    ticket: "Daily ticket",
    motto: "Wake · Execute · Sleep · Repeat",
  },
  binder: {
    title: "Archive",
    subtitle: "Binder",
    unit: "RM-01 · Filing unit",
    spine: "Archive",
    empty: "Empty. Tear a week off (pull its sheet down, press Tear off, or type TEAR) and it is filed here.",
    shredder: "Shredder",
    drop: "Drop a sheet",
    release: "Release to shred",
    shredding: "Shredding…",
    tearOff: "Tear off",
  },
  help: { title: "RM-01 · Command reference" },
}

const WordsContext = createContext<Words>(DEFAULT_WORDS)

/** Provide another model's words (a theme); everything below speaks them. */
export const WordsProvider = WordsContext.Provider

export function useWords(): Words {
  return useContext(WordsContext)
}
