import type { Activity, Meal, Settings } from "./types"

export const defaultMeals: Meal[] = [
  { id: "breakfast", name: "Breakfast", start: "08:00", durationMinutes: 30, enabled: true },
  { id: "lunch", name: "Lunch", start: "13:00", durationMinutes: 45, enabled: true },
  { id: "dinner", name: "Dinner", start: "19:30", durationMinutes: 60, enabled: true },
]

/** Used for saves made before meals existed, whose own activity list holds them. */
export const noMeals: Meal[] = defaultMeals.map((m) => ({ ...m, enabled: false }))

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
  return [...mealActivities(settings.meals), ...settings.activities]
}
