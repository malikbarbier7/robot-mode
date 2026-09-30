"use client"

import { useState } from "react"
import type { Activity, Meal, Schedule, Settings } from "@/lib/types"
import { addMeal, isDefaultMeal, mealsOf } from "@/lib/meals"
import { ActivityRow } from "./ActivityRow"
import { AddActivityFlow } from "./AddActivityFlow"

/*
 * What goes on each of the machine's four input screens. The first run shows
 * them one at a time; the input console shows them all at once, filled in.
 */

const FREE_TICKS = [0, 30, 60, 90, 120, 150, 180, 210, 240]
const CRT_TIME = "border-b border-ink/40 bg-transparent font-crt text-[32px] leading-none tabular-nums disabled:opacity-30"

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
}: {
  settings: Settings
  schedule: Schedule
  onAddActivity: (activity: Omit<Activity, "id">) => void
  onUpdateActivity: (id: string, patch: Partial<Activity>) => void
  onRemoveActivity: (id: string) => void
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
      <AddActivityFlow onAdd={onAddActivity} />
      <p className="label mt-3 text-ink/45">
        Name · duration · times per week, then Add — or Next for constraints. Select a line to edit it.
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
        {meals.map((meal) => (
          <div key={meal.id} className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-ink/20 py-3">
            <button
              type="button"
              onClick={() => patchMeal(meal.id, { enabled: !meal.enabled })}
              aria-pressed={meal.enabled}
              title={meal.enabled ? `Stop reserving ${meal.name}` : `Reserve time for ${meal.name}`}
              className="w-6 text-left"
            >
              {meal.enabled ? "■" : "□"}
            </button>
            {isDefaultMeal(meal.id) ? (
              <span className={`min-w-0 flex-1 uppercase ${meal.enabled ? "" : "text-ink/35"}`}>{meal.name}</span>
            ) : (
              <input
                value={meal.name}
                onChange={(e) => patchMeal(meal.id, { name: e.target.value })}
                aria-label="Meal name"
                className="min-w-0 flex-1 border-b border-ink/40 bg-transparent uppercase"
              />
            )}
            <input
              type="time"
              value={meal.start}
              disabled={!meal.enabled}
              onChange={(e) => e.target.value && patchMeal(meal.id, { start: e.target.value })}
              className={CRT_TIME}
            />
            <span className={`flex items-baseline gap-2 ${meal.enabled ? "" : "opacity-30"}`}>
              <input
                type="number"
                min={0}
                step={15}
                value={meal.durationMinutes}
                disabled={!meal.enabled}
                onChange={(e) => patchMeal(meal.id, { durationMinutes: Math.max(0, Number(e.target.value)) })}
                className={`${CRT_TIME} w-12 text-right`}
              />
              MIN
            </span>
            {!isDefaultMeal(meal.id) && (
              <button
                type="button"
                onClick={() => setMeals(meals.filter((m) => m.id !== meal.id))}
                title={`Delete ${meal.name}`}
                className="text-ink/40 hover:text-ink"
              >
                DEL
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setMeals(addMeal(meals))}
        className="mt-5 font-crt text-[26px] text-ink/60 hover:text-ink"
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
      <div className="mt-10 text-center font-crt text-[144px] leading-none tabular-nums">
        {String(free).padStart(3, "0")}
        <span className="ml-4 text-[40px] text-ink/60">MIN / DAY</span>
      </div>

      <div className="mt-10 flex items-start gap-3 font-crt text-[26px]">
        <button type="button" onClick={() => setFree(free - 15)} aria-label="Less free time" className="px-1 hover:text-ink/60">
          ◀
        </button>
        <div className="flex flex-1 justify-between border-t border-ink/50 pt-1">
          {FREE_TICKS.map((tick) => (
            <button
              key={tick}
              type="button"
              onClick={() => setFree(tick)}
              className={`flex flex-col items-center tabular-nums ${free === tick ? "" : "text-ink/40 hover:text-ink/70"}`}
            >
              <span className="h-2 w-px bg-current" />
              {String(tick).padStart(3, "0")}
              <span className={free === tick ? "" : "invisible"}>▲</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setFree(free + 15)} aria-label="More free time" className="px-1 hover:text-ink/60">
          ▶
        </button>
      </div>
    </>
  )
}

/**
 * A clock set like an instrument: two readouts that step with the arrows,
 * the keyboard, or by typing over them.
 */
function TimeDial({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [h, m] = value.split(":").map(Number)
  const set = (hours: number, minutes: number) => onChange(`${pad(wrap(hours, 24))}:${pad(wrap(minutes, 60))}`)

  return (
    <div className="flex items-center gap-8 font-crt">
      <span className="w-28 text-[34px] uppercase tracking-[0.2em] text-ink/70">{label}</span>
      <span className="flex items-center border border-ink/50 px-4 text-[128px] leading-none tabular-nums">
        <Digits label={`${label} hours`} value={h} max={23} step={1} onChange={(v) => set(v, m)} />
        <span className="px-1 text-ink/50">:</span>
        <Digits label={`${label} minutes`} value={m} max={59} step={5} onChange={(v) => set(h, v)} />
      </span>
    </div>
  )
}

function Digits({
  label,
  value,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  // Typing replaces the readout; it is only committed once it is a real value.
  const [draft, setDraft] = useState<string | null>(null)
  const commit = (text: string) => {
    if (text !== "" && Number(text) <= max) onChange(Number(text))
    setDraft(null)
  }
  const nudge = (by: number) => onChange(value + by)

  return (
    <span className="flex flex-col items-center">
      <button type="button" onClick={() => nudge(step)} aria-label={`${label} up`} className="px-3 text-[26px] text-ink/40 hover:text-ink">
        ▲
      </button>
      <input
        inputMode="numeric"
        aria-label={label}
        value={draft ?? pad(value)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const text = e.target.value.replace(/\D/g, "").slice(-2)
          if (text.length === 2) commit(text)
          else setDraft(text)
        }}
        onBlur={() => draft !== null && commit(draft)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault()
            nudge(e.key === "ArrowUp" ? step : -step)
          }
        }}
        className="w-[2ch] bg-transparent text-center focus:bg-ink/15"
      />
      <button type="button" onClick={() => nudge(-step)} aria-label={`${label} down`} className="px-3 text-[26px] text-ink/40 hover:text-ink">
        ▼
      </button>
    </span>
  )
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function wrap(n: number, size: number): number {
  return ((n % size) + size) % size
}
