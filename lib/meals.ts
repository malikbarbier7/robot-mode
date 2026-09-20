import type { Activity, Meal, Settings } from "./types"

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
 * Every known slot, in order, taking whatever has been saved. Settings written
 * before a slot existed still get it, so a template that names three meals does
 * not make the fourth disappear from the row.
 */
export function mealsOf(settings: Pick<Settings, "meals">): Meal[] {
  const saved = new Map((settings.meals ?? []).map((meal) => [meal.id, meal]))
  return defaultMeals.map((slot) => ({ ...slot, ...saved.get(slot.id) }))
}

/**
 * Enabled meals become critical, fixed-time activities on every day, so the
 * scheduler treats them as locked and works around them.
 */
export function mealActivities(meals: Meal[] | undefined): Activity[] {
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

/**
 * Everything the scheduler has to fit. Meals come first so they are placed
 * before anything flexible competes for the same hours.
 */
export function allActivities(settings: Settings): Activity[] {
  return [...mealActivities(mealsOf(settings)), ...settings.activities]
}
