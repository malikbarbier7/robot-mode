"use client"

import { createContext, useContext } from "react"
import type { Clock, WeekStart } from "@/lib/locale"

/** How times and weeks are shown, for any component that prints one. */
export type DisplayPrefs = { clock: Clock; weekStart: WeekStart }

const DisplayContext = createContext<DisplayPrefs>({ clock: "24h", weekStart: "monday" })

export const DisplayProvider = DisplayContext.Provider

export function useDisplay(): DisplayPrefs {
  return useContext(DisplayContext)
}
