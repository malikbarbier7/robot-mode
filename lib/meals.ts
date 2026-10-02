import type { Priority, Activity, Meal, Settings } from "./types"

/**
 * The meal slots, in the order they happen. All off to begin with: reserving
 * someone's evening for dinner they didn't ask for is a worse default than
 * making them click once.
 */
export const defaultMeals: Meal[] = [
  { id: "breakfast", name: "Breakfast", start: "08:00", durationMinutes: 30, enabled: false },
  { id: "lunch", name: "Lunch", start: "13:00", durationMinutes: 45, enabled: false },
  { id: "dinner", name: "Dinner", start: "19:30", durationMinutes: 60, enabled: false },
]

/**
 * Every known slot, in order, taking whatever has been saved, then any meals
 * the user added themselves. Settings written before a slot existed still get
 * it, so a template that names three meals does not make the fourth disappear
 * from the row.
 */
export function mealsOf(settings: Pick<Settings, "meals">): Meal[] {
  const saved = new Map((settings.meals ?? []).map((meal) => [meal.id, meal]))
  const slots = defaultMeals.map((slot) => ({ ...slot, ...saved.get(slot.id) }))
  const extras = (settings.meals ?? []).filter((meal) => isAddedMeal(meal.id))
  return [...slots, ...extras]
}

/**
 * Meals the user added carry a `meal-` id. Anything else that is not a known
 * slot is a slot that has since been retired (the old snack), and is dropped.
 */
function isAddedMeal(id: string): boolean {
  return id.startsWith("meal-")
}

export function isDefaultMeal(id: string): boolean {
  return defaultMeals.some((slot) => slot.id === id)
}

/** A new meal of the user's own, switched on, since adding it is asking for it. */
export function addMeal(meals: Meal[]): Meal[] {
  const used = new Set(meals.map((m) => m.id))
  let n = 1
  while (used.has(`meal-${n}`)) n++
  return [...meals, { id: `meal-${n}`, name: "Snack", start: "16:30", durationMinutes: 15, enabled: true }]
}

/**
 * Enabled meals become critical, fixed-time activities on every day, so the
 * scheduler treats them as locked and works around them.
 */
export function mealActivities(meals: Meal[] | undefined): ScheduledActivity[] {
  return (meals ?? [])
    .filter((meal) => meal.enabled && meal.durationMinutes > 0)
    .map((meal) => ({
      id: `meal-${meal.id}`,
      name: meal.name,
      durationMinutes: meal.durationMinutes,
      sessionsPerWeek: 7,
      priority: "critical" as const,
      fixedAt: { start: meal.start },
    }))
}

/** An activity as the scheduler sees it: always with a priority. */
export type ScheduledActivity = Activity & { priority: Priority }

/**
 * Everything the scheduler places: the meals, which are critical (placed
 * first, never given up), and the activities people added, which all share
 * one level. Priority is the engine's own business, never asked for. Meals
 * come first so they are placed before anything flexible competes for the
 * same hours.
 */
export function allActivities(settings: Settings): ScheduledActivity[] {
  return [
    ...mealActivities(mealsOf(settings)),
    ...settings.activities.map((a) => ({ ...a, priority: "medium" as const })),
  ]
}
