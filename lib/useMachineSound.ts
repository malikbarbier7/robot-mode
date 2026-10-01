"use client"

import { useEffect } from "react"
import { click, setSoundEnabled, unlock } from "./sound"

const MODIFIERS = new Set(["Shift", "Meta", "Control", "Alt", "CapsLock"])

/**
 * Makes the whole machine audible while `enabled`: every key typed clicks,
 * every panel key pressed clunks, and the first gesture wakes the audio
 * (browsers allow nothing before one) and starts the hum.
 */
export function useMachineSound(enabled: boolean) {
  useEffect(() => {
    setSoundEnabled(enabled)
    if (!enabled) return

    const onKey = (e: KeyboardEvent) => {
      unlock()
      if (!e.repeat && !MODIFIERS.has(e.key)) click()
    }
    const onPointer = (e: PointerEvent) => {
      unlock()
      if ((e.target as HTMLElement | null)?.closest("button, [role=switch]")) click(true)
    }
    // Capture, so a handler that stops the event doesn't silence the key.
    window.addEventListener("keydown", onKey, true)
    window.addEventListener("pointerdown", onPointer, true)
    return () => {
      window.removeEventListener("keydown", onKey, true)
      window.removeEventListener("pointerdown", onPointer, true)
    }
  }, [enabled])
}
