import type { Metadata } from "next"
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site"
import { Landing } from "@/components/Landing"
import { generate } from "@/lib/scheduler"
import type { Settings } from "@/lib/types"

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
}

/**
 * The week shown on the landing page. Not a drawing: the real engine solves it
 * from these lines when the page is built, so what a visitor sees is what the
 * machine prints.
 */
const SAMPLE: Settings = {
  seed: 1,
  wakeTime: "07:00",
  sleepTime: "23:00",
  meals: [
    { id: "breakfast", name: "Breakfast", start: "07:30", durationMinutes: 30, enabled: false },
    { id: "lunch", name: "Lunch", start: "12:30", durationMinutes: 45, enabled: true },
    { id: "dinner", name: "Dinner", start: "19:30", durationMinutes: 45, enabled: true },
  ],
  activities: [
    { id: "deep-work", name: "Deep work", durationMinutes: 180, sessionsPerWeek: 5, allowedDays: [0, 1, 2, 3, 4], window: { start: "09:00", end: "12:30" } },
    { id: "gym", name: "Gym", durationMinutes: 75, sessionsPerWeek: 4, window: { start: "17:00", end: "19:30" }, bufferMinutes: 15 },
    { id: "spanish", name: "Spanish", durationMinutes: 30, sessionsPerWeek: 5, window: { start: "13:15", end: "17:00" } },
    { id: "reading", name: "Reading", durationMinutes: 45, sessionsPerWeek: 7, window: { start: "21:00", end: "23:00" } },
    { id: "side-project", name: "Side project", durationMinutes: 120, sessionsPerWeek: 2, allowedDays: [5, 6], window: { start: "10:00", end: "13:00" } },
  ],
}

export default function Home() {
  return (
    // Someone who already has a week skips this page before it paints: see PASS_THROUGH in the root layout.
    <Landing settings={SAMPLE} schedule={generate(SAMPLE)} />
  )
}
