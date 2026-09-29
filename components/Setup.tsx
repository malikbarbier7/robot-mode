"use client"

import { useState } from "react"
import type { Activity, Meal, Schedule, Settings } from "@/lib/types"
import { addMeal, isDefaultMeal, mealsOf } from "@/lib/meals"
import { ActivityRow } from "./ActivityRow"
import { AddActivityFlow } from "./AddActivityFlow"

const STEPS = ["Activities", "Your day", "Meals", "Free time"] as const
const BIG_TIME = "border-b-2 border-ink/30 bg-transparent py-1 font-mono text-[40px] leading-none tabular-nums"
const ROW_TIME = "border-b border-ink/30 bg-transparent py-1 font-mono text-[18px] tabular-nums disabled:opacity-30"

/**
 * The first run, one question at a time: what to do, then the shape of a day,
 * then meals, then free time. Every answer lands in the same settings the home
 * screen edits, so finishing just shows that screen already filled in.
 */
export function Setup({
  settings,
  schedule,
  onPatchSettings,
  onAddActivity,
  onUpdateActivity,
  onRemoveActivity,
  onDone,
  onOpenTemplates,
}: {
  settings: Settings
  schedule: Schedule
  onPatchSettings: (patch: Partial<Settings>) => void
  onAddActivity: (activity: Omit<Activity, "id">) => void
  onUpdateActivity: (id: string, patch: Partial<Activity>) => void
  onRemoveActivity: (id: string) => void
  onDone: () => void
  onOpenTemplates: () => void
}) {
  const [step, setStep] = useState(0)
  const activities = settings.activities
  const meals = mealsOf(settings)
  const setMeals = (next: Meal[]) => onPatchSettings({ meals: next })
  const patchMeal = (id: string, patch: Partial<Meal>) =>
    setMeals(meals.map((m) => (m.id === id ? { ...m, ...patch } : m)))

  const last = step === STEPS.length - 1
  const canGoOn = step !== 0 || activities.length > 0

  return (
    <div className="mx-auto w-full max-w-[900px] px-6 py-12">
      <div className="mb-10 flex items-center gap-3">
        {STEPS.map((name, i) => (
          <span key={name} className={`label ${i === step ? "text-ink" : "text-ink/30"}`}>
            {String(i + 1).padStart(2, "0")} {name}
          </span>
        ))}
      </div>

      {step === 0 && (
        <>
          <Heading
            title="What do you want to do?"
            blurb="List everything you want to get done. Robot Mode will figure out when it fits."
          />
          <AddActivityFlow onAdd={onAddActivity} />
          {activities.length > 0 && (
            <div className="mt-2">
              {activities.map((activity, i) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  index={i}
                  variant="page"
                  placed={schedule.blocks.filter((b) => b.activityId === activity.id).length}
                  onChange={(patch) => onUpdateActivity(activity.id, patch)}
                  onRemove={() => onRemoveActivity(activity.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {step === 1 && (
        <>
          <Heading title="What does your day look like?" blurb="When you get up, and when you go to bed." />
          <div className="mt-10 flex flex-wrap gap-12">
            <label className="block">
              <span className="label mb-2 block text-ink/45">Wake</span>
              <input
                type="time"
                value={settings.wakeTime}
                onChange={(e) => e.target.value && onPatchSettings({ wakeTime: e.target.value })}
                className={BIG_TIME}
              />
            </label>
            <label className="block">
              <span className="label mb-2 block text-ink/45">Sleep</span>
              <input
                type="time"
                value={settings.sleepTime}
                onChange={(e) => e.target.value && onPatchSettings({ sleepTime: e.target.value })}
                className={BIG_TIME}
              />
            </label>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <Heading
            title="Meal time!"
            blurb="How many meals do you have, and how long do they take? Switch on the ones you have."
          />
          <div className="mt-8 border-t-2 border-ink">
            {meals.map((meal) => (
              <div key={meal.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-ink/15 py-3">
                {isDefaultMeal(meal.id) ? (
                  <span className={`min-w-0 flex-1 text-[17px] ${meal.enabled ? "" : "text-ink/35"}`}>
                    {meal.name}
                  </span>
                ) : (
                  <input
                    value={meal.name}
                    onChange={(e) => patchMeal(meal.id, { name: e.target.value })}
                    aria-label="Meal name"
                    className="min-w-0 flex-1 border-b border-ink/30 bg-transparent py-1 text-[17px]"
                  />
                )}
                <input
                  type="time"
                  value={meal.start}
                  disabled={!meal.enabled}
                  onChange={(e) => e.target.value && patchMeal(meal.id, { start: e.target.value })}
                  className={ROW_TIME}
                />
                <span className="flex items-baseline gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step={15}
                    value={meal.durationMinutes}
                    disabled={!meal.enabled}
                    onChange={(e) => patchMeal(meal.id, { durationMinutes: Math.max(0, Number(e.target.value)) })}
                    className={`${ROW_TIME} w-14`}
                  />
                  <span className="label text-ink/40">min</span>
                </span>
                {isDefaultMeal(meal.id) ? (
                  <button
                    type="button"
                    onClick={() => patchMeal(meal.id, { enabled: !meal.enabled })}
                    aria-pressed={meal.enabled}
                    className={`label w-14 border py-1 ${
                      meal.enabled ? "border-ink bg-ink text-paper" : "border-ink/30 text-ink/40"
                    }`}
                  >
                    {meal.enabled ? "On" : "Off"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMeals(meals.filter((m) => m.id !== meal.id))}
                    title={`Remove ${meal.name}`}
                    className="label w-14 border border-ink/30 py-1 text-ink/55 hover:border-ink hover:text-ink"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMeals(addMeal(meals))}
            className="label mt-4 text-ink/60 hover:text-ink"
          >
            + Add meal
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <Heading title="How much free time do you need?" blurb="For doomscrolling. We won't judge." />
          <label className="mt-10 block">
            <span className="label mb-2 block text-ink/45">Free time a day</span>
            <span className="flex items-baseline gap-3">
              <input
                type="number"
                min={0}
                step={30}
                value={settings.minFreeMinutesPerDay}
                onChange={(e) => onPatchSettings({ minFreeMinutesPerDay: Math.max(0, Number(e.target.value)) })}
                className={`${BIG_TIME} w-32`}
              />
              <span className="label text-ink/45">min</span>
            </span>
          </label>
        </>
      )}

      <div className="mt-12 flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="label border border-ink/40 px-5 py-4 text-ink/60 hover:bg-ink hover:text-paper"
          >
            ← Back
          </button>
        )}
        <button
          type="button"
          onClick={() => (last ? onDone() : setStep(step + 1))}
          disabled={!canGoOn}
          className="flex-1 border-2 border-ink bg-ink px-6 py-4 font-display text-3xl text-paper transition-colors hover:bg-paper hover:text-ink disabled:border-ink/25 disabled:bg-transparent disabled:text-ink/25"
        >
          {last ? "Make me a robot →" : "Next →"}
        </button>
      </div>
      {!canGoOn && <p className="label mt-3 text-center text-ink/40">Add at least one activity</p>}

      {step === 0 && (
        <div className="mt-14 flex items-baseline justify-center gap-2 border-t border-ink/15 pt-6">
          <span className="text-[13px] text-ink/50">Not sure where to start?</span>
          <button
            type="button"
            onClick={onOpenTemplates}
            className="text-[13px] underline decoration-ink/40 underline-offset-4 hover:decoration-ink"
          >
            Use a template →
          </button>
        </div>
      )}
    </div>
  )
}

function Heading({ title, blurb }: { title: string; blurb: string }) {
  return (
    <>
      <h2 className="font-display text-6xl leading-[0.95]">{title}</h2>
      <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-ink/65">{blurb}</p>
    </>
  )
}
