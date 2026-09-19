"use client"

import { useEffect, useState } from "react"
import type { Day, Schedule } from "@/lib/types"
import { DAY_NAMES, formatTime } from "@/lib/scheduler/time"
import { minutesUntil, pickNow } from "@/lib/now"
import { Button } from "./ui"

/**
 * The daily-use surface. Without it Robot Mode is a generator you open once;
 * this is the screen you leave open while the week happens.
 */
export function NowCard({ schedule, onMissed }: { schedule: Schedule; onMissed: (id: string) => void }) {
  const [now, setNow] = useState<{ day: Day; minute: number } | null>(null)

  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setNow({ day: ((d.getDay() + 6) % 7) as Day, minute: d.getHours() * 60 + d.getMinutes() })
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  // Rendered only after mount, so the server and client markup match.
  if (!now) return <div className="px-10 py-14" />

  const { current, next, nextIsToday } = pickNow(schedule.blocks, now.day, now.minute)

  return (
    <div className="px-10 py-14">
      <div className="label text-ink/45">
        {DAY_NAMES[now.day]} · {formatTime(now.minute)}
      </div>

      <section className="mt-8 border-t-2 border-ink pt-5">
        <div className="label text-ink/50">Now</div>
        {current ? (
          <>
            <h2 className="font-display text-7xl leading-[0.95]">{current.name}</h2>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-2">
              <span className="font-mono text-[13px] tabular-nums">
                until {formatTime(current.endMinute)}
              </span>
              <span className="font-mono text-[12px] text-ink/50">
                {duration(current.day * 1440 + current.endMinute - (now.day * 1440 + now.minute))} left
              </span>
              <Button onClick={() => onMissed(current.id)}>I missed this</Button>
            </div>
            <p className="mt-4 max-w-lg text-[12px] text-ink/55">{current.reason}</p>
          </>
        ) : (
          <>
            <h2 className="font-display text-7xl leading-[0.95] text-ink/35">Free</h2>
            <p className="mt-3 max-w-md text-[13px] text-ink/60">
              Nothing is scheduled. That is the plan, not a gap in it.
            </p>
          </>
        )}
      </section>

      <section className="mt-12 border-t border-ink/25 pt-5">
        <div className="label text-ink/50">{nextIsToday ? "Next" : "Next up"}</div>
        {next ? (
          <>
            <h3 className="font-display text-4xl leading-none">{next.name}</h3>
            <div className="mt-2 font-mono text-[13px] tabular-nums text-ink/70">
              {!nextIsToday && <span className="text-ink/50">{DAY_NAMES[next.day]} </span>}
              {formatTime(next.startMinute)}–{formatTime(next.endMinute)}
              <span className="text-ink/45"> · in {duration(minutesUntil(next, now.day, now.minute))}</span>
            </div>
          </>
        ) : (
          <h3 className="font-display text-4xl leading-none text-ink/35">Nothing scheduled</h3>
        )}
      </section>
    </div>
  )
}

function duration(minutes: number): string {
  if (minutes < 60) return `${Math.max(0, minutes)}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`
}
