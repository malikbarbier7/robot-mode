"use client"

import { useEffect, useState } from "react"

/**
 * The time, kept current every `interval` ms. Null on the server and the
 * hydrating render, so anything that depends on the clock renders the same
 * markup on both sides.
 */
export function useNow(interval = 30_000): Date | null {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()
    const id = setInterval(tick, interval)
    return () => clearInterval(id)
  }, [interval])
  return now
}
