"use client"

import { useState } from "react"
import type { Activity, Meal, Schedule, Settings } from "@/lib/types"
import { addMeal, isDefaultMeal, mealsOf } from "@/lib/meals"
import { ActivityRow } from "./ActivityRow"
import { AddActivityFlow } from "./AddActivityFlow"

/*
 * What goes on each of the machine's four input screens. Everything that can
 * be selected carries `data-nav`, so ← → and Enter walk it; values are
 * readouts that take ↑ ↓ and typed digits, so nothing needs the mouse.
 */

const FREE_TICKS = [0, 30, 60, 90, 120, 150, 180, 210, 240]

export function Request({ n, title, note }: { n: number; title: string; note?: string }) {
  return (
    <div className="font-crt uppercase">
      <div className="text-[28px] tracking-[0.2em] text-ink/60">Input request {pad(n)}</div>
      <h2 className="mt-1 text-[48px] leading-none tracking-[0.04em] sm:text-[88px]">{title}</h2>
      {note && <p className="mt-3 text-[24px] tracking-[0.1em] text-ink/60">{note}</p>}
    </div>
  )
}

export function ActivitiesTerminal({
  settings,
  schedule,
  onAddActivity,
  onUpdateActivity,
  onRemoveActivity,
  onEmptyEnter,
}: {
  settings: Settings
  schedule: Schedule
  onAddActivity: (activity: Omit<Activity, "id">) => void
  onUpdateActivity: (id: string, patch: Partial<Activity>) => void
  onRemoveActivity: (id: string) => void
  /** Enter on the blank entry line: nothing more to add. */
  onEmptyEnter: () => void
}) {
  const activities = settings.activities
  return (
    <>
      <Request n={1} title="What do you want to do?" />
      <div className="mt-5">
        {activities.map((activity) => (
          <ActivityRow
            key={activity.id}
            activity={activity}
            variant="terminal"
            placed={schedule.blocks.filter((b) => b.activityId === activity.id).length}
            onChange={(patch) => onUpdateActivity(activity.id, patch)}
            onRemove={() => onRemoveActivity(activity.id)}
          />
        ))}
        {activities.length === 0 && (
          <div className="font-crt text-[30px] text-ink/45">
            &gt; AWAITING INPUT<span className="blink">_</span>
          </div>
        )}
      </div>
      <AddActivityFlow onAdd={onAddActivity} onEmptyEnter={onEmptyEnter} />
      <p className="label mt-3 text-ink/45">
        Enter moves field to field, then through the parameters and adds. Enter on a blank line to continue.
      </p>
    </>
  )
}

export function HoursTerminal({
  settings,
  onPatchSettings,
}: {
  settings: Settings
  onPatchSettings: (patch: Partial<Settings>) => void
}) {
  return (
    <>
      <Request n={2} title="Define operating hours" />
      <div className="mt-10 flex flex-wrap gap-x-16 gap-y-8">
        <TimeDial label="Wake" value={settings.wakeTime} onChange={(v) => onPatchSettings({ wakeTime: v })} />
        <TimeDial label="Sleep" value={settings.sleepTime} onChange={(v) => onPatchSettings({ sleepTime: v })} />
      </div>
    </>
  )
}

export function MealsTerminal({
  settings,
  onPatchSettings,
}: {
  settings: Settings
  onPatchSettings: (patch: Partial<Settings>) => void
}) {
  const meals = mealsOf(settings)
  const setMeals = (next: Meal[]) => onPatchSettings({ meals: next })
  const patchMeal = (id: string, patch: Partial<Meal>) =>
    setMeals(meals.map((m) => (m.id === id ? { ...m, ...patch } : m)))

  return (
    <>
      <Request n={3} title="Meal parameters" note="Switch on the meals you have." />
      <div className="mt-8 font-crt text-[36px] leading-none">
        {meals.map((meal) => {
          const [h, m] = meal.start.split(":").map(Number)
          const setStart = (hours: number, minutes: number) => patchMeal(meal.id, { start: `${pad(hours)}:${pad(minutes)}` })
          return (
            <div key={meal.id} className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-ink/20 py-3">
              <button
                type="button"
                data-nav
                data-enter="next"
                onClick={() => patchMeal(meal.id, { enabled: !meal.enabled })}
                aria-pressed={meal.enabled}
                title={meal.enabled ? `Stop reserving ${meal.name}` : `Reserve time for ${meal.name}`}
                className="w-10 text-center"
              >
                {meal.enabled ? "■" : "□"}
              </button>
              {isDefaultMeal(meal.id) ? (
                <span className={`min-w-0 flex-1 uppercase ${meal.enabled ? "" : "text-ink/35"}`}>{meal.name}</span>
              ) : (
                <input
                  data-nav
                  value={meal.name}
                  onChange={(e) => patchMeal(meal.id, { name: e.target.value })}
                  aria-label="Meal name"
                  className="min-w-0 flex-1 border-b border-ink/40 bg-transparent uppercase"
                />
              )}
              <span className={`flex items-baseline tabular-nums ${meal.enabled ? "" : "opacity-30"}`}>
                <Readout label={`${meal.name} hour`} value={h} max={23} wrap disabled={!meal.enabled} onChange={(v) => setStart(v, m)} />
                :
                <Readout
                  label={`${meal.name} minutes`}
                  value={m}
                  max={59}
                  step={5}
                  wrap
                  disabled={!meal.enabled}
                  onChange={(v) => setStart(h, v)}
                />
              </span>
              <span className={`flex items-baseline gap-2 ${meal.enabled ? "" : "opacity-30"}`}>
                <Readout
                  label={`${meal.name} length in minutes`}
                  value={meal.durationMinutes}
                  max={240}
                  step={15}
                  width={3}
                  disabled={!meal.enabled}
                  onChange={(v) => patchMeal(meal.id, { durationMinutes: v })}
                />
                MIN
              </span>
              {!isDefaultMeal(meal.id) && (
                <button
                  type="button"
                  data-nav
                  onClick={() => setMeals(meals.filter((x) => x.id !== meal.id))}
                  title={`Delete ${meal.name}`}
                  className="px-1 text-ink/50 hover:text-ink"
                >
                  DEL
                </button>
              )}
            </div>
          )
        })}
      </div>
      <button
        type="button"
        data-nav
        onClick={() => setMeals(addMeal(meals))}
        className="mt-5 px-1 font-crt text-[26px] text-ink/60 hover:text-ink"
      >
        + ADD MEAL
      </button>
    </>
  )
}

export function FreeTimeTerminal({
  settings,
  onPatchSettings,
}: {
  settings: Settings
  onPatchSettings: (patch: Partial<Settings>) => void
}) {
  const free = settings.minFreeMinutesPerDay
  const setFree = (minutes: number) => onPatchSettings({ minFreeMinutesPerDay: Math.max(0, minutes) })

  return (
    <>
      <Request n={4} title="Free time allocation" note="Doomscrolling is a valid human activity." />
      <div className="mt-10 flex items-baseline justify-center font-crt text-[144px] leading-none tabular-nums">
        <Readout label="Free time a day, in minutes" value={free} max={720} step={15} width={3} onChange={setFree} />
        <span className="ml-4 text-[40px] text-ink/60">MIN / DAY</span>
      </div>

      <div className="mt-10 flex items-start gap-3 font-crt text-[26px]">
        <button type="button" tabIndex={-1} onClick={() => setFree(free - 15)} aria-label="Less free time" className="px-1 hover:text-ink/60">
          ◀
        </button>
        <div className="flex flex-1 justify-between border-t border-ink/50 pt-1">
          {FREE_TICKS.map((tick) => (
            <button
              key={tick}
              type="button"
              tabIndex={-1}
              onClick={() => setFree(tick)}
              className={`flex flex-col items-center tabular-nums ${free === tick ? "" : "text-ink/40 hover:text-ink/70"}`}
            >
              <span className="h-2 w-px bg-current" />
              {String(tick).padStart(3, "0")}
              <span className={free === tick ? "" : "invisible"}>▲</span>
            </button>
          ))}
        </div>
        <button type="button" tabIndex={-1} onClick={() => setFree(free + 15)} aria-label="More free time" className="px-1 hover:text-ink/60">
          ▶
        </button>
      </div>
    </>
  )
}

/** A clock set like an instrument: hours and minutes, each its own readout. */
function TimeDial({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [h, m] = value.split(":").map(Number)
  const set = (hours: number, minutes: number) => onChange(`${pad(hours)}:${pad(minutes)}`)

  return (
    <div className="flex items-center gap-8 font-crt">
      <span className="w-28 text-[34px] uppercase tracking-[0.2em] text-ink/70">{label}</span>
      <span className="flex items-center border border-ink/50 px-4 text-[128px] leading-none tabular-nums">
        <Readout label={`${label} hours`} value={h} max={23} wrap arrows onChange={(v) => set(v, m)} />
        <span className="px-1 text-ink/50">:</span>
        <Readout label={`${label} minutes`} value={m} max={59} step={5} wrap arrows onChange={(v) => set(h, v)} />
      </span>
    </div>
  )
}

/**
 * A number on the screen that is set, not typed into a box: ↑ ↓ step it,
 * digits overwrite it (a partial entry shows as "1_"), Enter or leaving it
 * commits. `arrows` adds ▲ ▼ above and below for the mouse.
 */
function Readout({
  label,
  value,
  onChange,
  max,
  min = 0,
  step = 1,
  width = 2,
  wrap = false,
  arrows = false,
  disabled = false,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  max: number
  min?: number
  step?: number
  width?: number
  wrap?: boolean
  arrows?: boolean
  disabled?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)

  const fit = (n: number) => {
    if (wrap) return ((((n - min) % (max - min + 1)) + (max - min + 1)) % (max - min + 1)) + min
    return Math.min(Math.max(n, min), max)
  }
  const nudge = (by: number) => {
    setDraft(null)
    onChange(fit(value + by))
  }
  const commit = (text: string | null) => {
    if (text) onChange(Math.min(Math.max(Number(text), min), max))
    setDraft(null)
  }
  const type = (digits: string) => {
    const next = ((draft ?? "") + digits).slice(0, width)
    if (next.length >= width) commit(next)
    else setDraft(next)
  }

  const input = (
    <input
      data-nav
      data-readout
      inputMode="numeric"
      aria-label={label}
      disabled={disabled}
      value={draft !== null ? draft.padEnd(width, "_") : String(value).padStart(width, "0")}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "+") {
          e.preventDefault()
          nudge(step)
        } else if (e.key === "ArrowDown" || e.key === "-") {
          e.preventDefault()
          nudge(-step)
        } else if (/^\d$/.test(e.key)) {
          e.preventDefault()
          type(e.key)
        } else if (e.key === "Backspace") {
          e.preventDefault()
          setDraft(draft ? draft.slice(0, -1) || null : null)
        } else if (e.key === "Enter") {
          // Commit, and let Enter carry on to the next field.
          commit(draft)
        }
      }}
      // Virtual keyboards and pastes arrive as inserted text, not keys; take their digits here.
      onChange={(e) => {
        const inserted = (e.nativeEvent as InputEvent).data ?? e.target.value.slice(-1)
        const digits = inserted.replace(/\D/g, "")
        if (digits) type(digits)
      }}
      onBlur={() => commit(draft)}
      style={{ width: `${width}ch` }}
      className="bg-transparent text-center caret-transparent disabled:opacity-100"
    />
  )

  if (!arrows) return input
  return (
    <span className="flex flex-col items-center">
      <button type="button" tabIndex={-1} onClick={() => nudge(step)} aria-label={`${label} up`} className="px-3 text-[26px] text-ink/40 hover:text-ink">
        ▲
      </button>
      {input}
      <button type="button" tabIndex={-1} onClick={() => nudge(-step)} aria-label={`${label} down`} className="px-3 text-[26px] text-ink/40 hover:text-ink">
        ▼
      </button>
    </span>
  )
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
