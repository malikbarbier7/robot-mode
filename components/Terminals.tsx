"use client"

import type { Activity, Meal, Schedule, Settings } from "@/lib/types"
import { addMeal, isDefaultMeal, mealsOf } from "@/lib/meals"
import { ActivityRow } from "./ActivityRow"
import { AddActivityFlow } from "./AddActivityFlow"
import { ClockReadout, Readout } from "./Readout"

/*
 * What goes on each of the machine's three input screens. Everything that can
 * be selected carries `data-nav`, so ← → and Enter walk it; values are
 * readouts that take ↑ ↓ and typed digits, so nothing needs the mouse.
 */


export function Request({ n, title, note }: { n: number; title: string; note?: string }) {
  return (
    <div className="font-crt uppercase">
      <div className="text-[28px] tracking-[0.2em] text-ink/60">Input request {pad(n)}</div>
      <h2 className="mt-1 text-[44px] leading-none tracking-[0.04em] sm:text-[72px]">{title}</h2>
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
  onStepChange,
  openId,
}: {
  settings: Settings
  schedule: Schedule
  onAddActivity: (activity: Omit<Activity, "id">) => void
  onUpdateActivity: (id: string, patch: Partial<Activity>) => void
  onRemoveActivity: (id: string) => void
  /** Enter on the blank entry line: nothing more to add. */
  onEmptyEnter: () => void
  onStepChange?: (step: number | null) => void
  /** An activity to show with its constraints already unfolded. */
  openId?: string
}) {
  const activities = settings.activities
  return (
    <>
      <Request n={1} title="What do you want to do?" />
      <div className="mt-5">
        {activities.map((activity) => (
          <ActivityRow
            // Remounts when it becomes the one to unfold, so it opens even if it was already listed.
            key={`${activity.id}${activity.id === openId ? "-open" : ""}`}
            activity={activity}
            defaultOpen={activity.id === openId}
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
      <AddActivityFlow onAdd={onAddActivity} onEmptyEnter={onEmptyEnter} onStepChange={onStepChange} />
      <p className="label mt-3 text-ink/45 pointer-coarse:hidden">
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
      <div className="mt-6 flex flex-wrap gap-x-16 gap-y-5 sm:mt-10 sm:gap-y-8">
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
      <div className="mt-8 font-crt text-[30px] leading-none sm:text-[36px]">
        {meals.map((meal) => {
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
                // On a phone the name fills the line and the time and length wrap beneath it.
                <span className={`min-w-0 flex-1 uppercase max-sm:basis-[calc(100%-4rem)] ${meal.enabled ? "" : "text-ink/35"}`}>{meal.name}</span>
              ) : (
                <input
                  data-nav
                  value={meal.name}
                  onChange={(e) => patchMeal(meal.id, { name: e.target.value })}
                  aria-label="Meal name"
                  className="min-w-0 flex-1 border-b border-ink/40 bg-transparent uppercase max-sm:basis-[calc(100%-4rem)]"
                />
              )}
              <span className={`flex items-baseline tabular-nums max-sm:pl-16 ${meal.enabled ? "" : "opacity-30"}`}>
                <ClockReadout
                  label={meal.name}
                  value={meal.start}
                  disabled={!meal.enabled}
                  onChange={(start) => patchMeal(meal.id, { start })}
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
      {/* The same bright hint as the day chips: the key that matters here. */}
      <p className="mt-4 font-crt text-[24px] uppercase tracking-[0.12em] pointer-coarse:hidden">Space to pick meal</p>
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

/** A clock set like an instrument: hours and minutes, each its own readout. */
function TimeDial({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col items-start gap-2 font-crt">
      <span className="text-[26px] uppercase tracking-[0.2em] text-ink/70 sm:text-[34px]">{label}</span>
      <span className="flex items-center border border-ink/50 px-4 text-[80px] leading-none tabular-nums sm:text-[128px]">
        <ClockReadout label={label} value={value} arrows onChange={onChange} periodClassName="text-[44px]" />
      </span>
    </div>
  )
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}
