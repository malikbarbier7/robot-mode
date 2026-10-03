import { defaultMeals, mealsOf } from "./meals"
import type { Settings } from "./types"

export type Template = { id: string; name: string; blurb: string; settings: Settings }

const base = { seed: 1 }

export const templates: Template[] = [
  {
    id: "student",
    name: "Student",
    blurb: "Lectures, study blocks, a language, and the gym four times a week.",
    settings: {
      ...base,
      wakeTime: "08:00",
      sleepTime: "00:00",
      meals: [
        { id: "breakfast", name: "Breakfast", start: "08:30", durationMinutes: 30, enabled: true },
        { id: "lunch", name: "Lunch", start: "13:00", durationMinutes: 60, enabled: true },
        { id: "dinner", name: "Dinner", start: "19:30", durationMinutes: 60, enabled: true },
      ],
      activities: [
        { id: "lectures", name: "Lectures", durationMinutes: 180, sessionsPerWeek: 5, allowedDays: [0, 1, 2, 3, 4], window: { start: "09:00", end: "13:00" } },
        { id: "study", name: "Study", durationMinutes: 90, sessionsPerWeek: 5, window: { start: "14:00", end: "19:00" } },
        { id: "gym", name: "Gym", durationMinutes: 75, sessionsPerWeek: 4, allowedDays: [0, 1, 3, 4], window: { start: "17:00", end: "19:30" }, bufferMinutes: 15 },
        { id: "reading", name: "Reading", durationMinutes: 60, sessionsPerWeek: 7, window: { start: "21:00", end: "23:30" } },
      ],
    },
  },
  {
    id: "entrepreneur",
    name: "Entrepreneur",
    blurb: "Mornings defended for building, afternoons for calls and selling.",
    settings: {
      ...base,
      wakeTime: "07:00",
      sleepTime: "23:30",
      meals: [
        { id: "breakfast", name: "Breakfast", start: "08:00", durationMinutes: 30, enabled: false },
        { id: "lunch", name: "Lunch", start: "13:00", durationMinutes: 45, enabled: true },
        { id: "dinner", name: "Dinner", start: "19:30", durationMinutes: 60, enabled: true },
      ],
      activities: [
        { id: "build", name: "Building", durationMinutes: 180, sessionsPerWeek: 5, allowedDays: [0, 1, 2, 3, 4], window: { start: "08:00", end: "12:30" } },
        { id: "calls", name: "Calls & meetings", durationMinutes: 120, sessionsPerWeek: 4, allowedDays: [0, 1, 2, 3, 4], window: { start: "14:00", end: "18:00" } },
        { id: "sales", name: "Sales & outreach", durationMinutes: 60, sessionsPerWeek: 5, allowedDays: [0, 1, 2, 3, 4], window: { start: "14:00", end: "18:30" } },
        { id: "admin", name: "Admin & inbox", durationMinutes: 45, sessionsPerWeek: 5, window: { start: "17:30", end: "19:00" } },
        { id: "gym", name: "Gym", durationMinutes: 60, sessionsPerWeek: 3, window: { start: "17:00", end: "19:00" }, bufferMinutes: 15 },
        { id: "learning", name: "Reading & learning", durationMinutes: 45, sessionsPerWeek: 5, window: { start: "21:00", end: "23:00" } },
        { id: "weekend-build", name: "Catch-up work", durationMinutes: 120, sessionsPerWeek: 2, allowedDays: [5, 6], window: { start: "10:00", end: "14:00" } },
      ],
    },
  },
  {
    id: "worker",
    name: "Full-time worker",
    blurb: "Eight hours of work, meals, training, and a protected evening.",
    settings: {
      ...base,
      wakeTime: "07:00",
      sleepTime: "23:00",
      meals: [
        { id: "breakfast", name: "Breakfast", start: "07:30", durationMinutes: 30, enabled: true },
        { id: "lunch", name: "Lunch", start: "13:00", durationMinutes: 60, enabled: true },
        { id: "dinner", name: "Dinner", start: "20:00", durationMinutes: 60, enabled: true },
      ],
      activities: [
        { id: "work-am", name: "Work (morning)", durationMinutes: 240, sessionsPerWeek: 5, allowedDays: [0, 1, 2, 3, 4], window: { start: "09:00", end: "13:00" } },
        { id: "work-pm", name: "Work (afternoon)", durationMinutes: 240, sessionsPerWeek: 5, allowedDays: [0, 1, 2, 3, 4], window: { start: "14:00", end: "18:00" } },
        { id: "gym", name: "Gym", durationMinutes: 60, sessionsPerWeek: 3, window: { start: "18:00", end: "20:00" }, bufferMinutes: 15 },
        { id: "reading", name: "Reading", durationMinutes: 45, sessionsPerWeek: 5, window: { start: "21:30", end: "23:00" } },
      ],
    },
  },
  {
    id: "fitness",
    name: "Fitness-focused",
    blurb: "Training six days a week, with travel time and recovery built in.",
    settings: {
      ...base,
      wakeTime: "06:30",
      sleepTime: "22:30",
      meals: [
        { id: "breakfast", name: "Breakfast", start: "09:30", durationMinutes: 30, enabled: true },
        { id: "lunch", name: "Lunch", start: "13:30", durationMinutes: 45, enabled: true },
        { id: "dinner", name: "Dinner", start: "19:00", durationMinutes: 60, enabled: true },
      ],
      activities: [
        { id: "training", name: "Training", durationMinutes: 90, sessionsPerWeek: 6, window: { start: "07:00", end: "10:00" }, bufferMinutes: 30 },
        { id: "work", name: "Work", durationMinutes: 210, sessionsPerWeek: 10, allowedDays: [0, 1, 2, 3, 4] },
        { id: "mobility", name: "Mobility", durationMinutes: 30, sessionsPerWeek: 5, window: { start: "19:00", end: "21:30" } },
      ],
    },
  },
  {
    id: "exam",
    name: "Exam preparation",
    blurb: "Long revision blocks, spaced through the day, with real breaks.",
    settings: {
      ...base,
      wakeTime: "07:30",
      sleepTime: "23:30",
      meals: [
        { id: "breakfast", name: "Breakfast", start: "08:00", durationMinutes: 30, enabled: true },
        { id: "lunch", name: "Lunch", start: "13:00", durationMinutes: 60, enabled: true },
        { id: "dinner", name: "Dinner", start: "19:30", durationMinutes: 60, enabled: true },
      ],
      activities: [
        { id: "revision-am", name: "Revision (deep)", durationMinutes: 120, sessionsPerWeek: 7, window: { start: "08:30", end: "12:30" } },
        { id: "revision-pm", name: "Revision (practice)", durationMinutes: 120, sessionsPerWeek: 7, window: { start: "14:00", end: "18:00" } },
        { id: "walk", name: "Walk", durationMinutes: 45, sessionsPerWeek: 7, window: { start: "17:00", end: "19:00" } },
        { id: "review", name: "Flashcards", durationMinutes: 30, sessionsPerWeek: 7, window: { start: "21:00", end: "23:00" } },
      ],
    },
  },
  {
    id: "deep-work",
    name: "Deep work",
    blurb: "Two uninterrupted blocks a day, defended from everything else.",
    settings: {
      ...base,
      wakeTime: "07:00",
      sleepTime: "23:00",
      meals: [
        { id: "breakfast", name: "Breakfast", start: "08:00", durationMinutes: 30, enabled: false },
        // At 12:00, so the midday walk fits after it, inside its 12:00–14:00 window.
        { id: "lunch", name: "Lunch", start: "12:00", durationMinutes: 60, enabled: true },
        { id: "dinner", name: "Dinner", start: "19:00", durationMinutes: 60, enabled: true },
      ],
      activities: [
        { id: "deep-1", name: "Deep work", durationMinutes: 180, sessionsPerWeek: 5, allowedDays: [0, 1, 2, 3, 4], window: { start: "08:00", end: "12:00" } },
        { id: "deep-2", name: "Deep work", durationMinutes: 120, sessionsPerWeek: 5, allowedDays: [0, 1, 2, 3, 4], window: { start: "14:00", end: "17:00" } },
        { id: "admin", name: "Admin & email", durationMinutes: 45, sessionsPerWeek: 5, allowedDays: [0, 1, 2, 3, 4], window: { start: "17:00", end: "18:30" } },
        { id: "walk", name: "Walk", durationMinutes: 45, sessionsPerWeek: 7, window: { start: "12:00", end: "14:00" } },
        { id: "reading", name: "Reading", durationMinutes: 60, sessionsPerWeek: 7, window: { start: "20:30", end: "23:00" } },
      ],
    },
  },
  {
    id: "blank",
    name: "Blank week",
    blurb: "Nothing scheduled. Set your hours and add activities one at a time.",
    settings: {
      ...base,
      wakeTime: "07:30",
      sleepTime: "23:30",
      meals: defaultMeals,
      activities: [],
    },
  },
]

export function templateById(id: string | undefined): Template | undefined {
  return id ? templates.find((t) => t.id === id) : undefined
}

/**
 * True when the week still matches the template it came from. Only the parts a
 * template defines are compared — the seed changes on every shuffle and is not
 * an edit.
 */
export function matchesTemplate(settings: Settings, template: Template): boolean {
  const shape = (s: Settings) =>
    JSON.stringify({
      wakeTime: s.wakeTime,
      sleepTime: s.sleepTime,
      meals: mealsOf(s),
      activities: s.activities,
    })
  return shape(settings) === shape(template.settings)
}
