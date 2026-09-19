"use client"

import { useState } from "react"
import type { Activity, Schedule, Settings } from "@/lib/types"
import { parseDuration } from "@/lib/duration"
import { ActivityRow } from "./ActivityRow"
import { Button, Field, inputClass } from "./ui"

export function DefinePanel({
  settings,
  schedule,
  onPatchSettings,
  onAddActivity,
  onUpdateActivity,
  onRemoveActivity,
}: {
  settings: Settings
  schedule: Schedule
  onPatchSettings: (patch: Partial<Settings>) => void
  onAddActivity: (activity: Activity) => void
  onUpdateActivity: (id: string, patch: Partial<Activity>) => void
  onRemoveActivity: (id: string) => void
}) {
  const placedCount = (id: string) => schedule.blocks.filter((b) => b.activityId === id).length

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-3 gap-2 border-b border-ink/15 px-6 py-4">
        <Field label="Wake">
          <input
            className={inputClass}
            type="time"
            value={settings.wakeTime}
            onChange={(e) => e.target.value && onPatchSettings({ wakeTime: e.target.value })}
          />
        </Field>
        <Field label="Sleep">
          <input
            className={inputClass}
            type="time"
            value={settings.sleepTime}
            onChange={(e) => e.target.value && onPatchSettings({ sleepTime: e.target.value })}
          />
        </Field>
        <Field label="Free / day">
          <input
            className={inputClass}
            type="number"
            min={0}
            step={30}
            value={settings.minFreeMinutesPerDay}
            onChange={(e) => onPatchSettings({ minFreeMinutesPerDay: Math.max(0, Number(e.target.value)) })}
          />
        </Field>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {settings.activities.map((activity) => (
          <ActivityRow
            key={activity.id}
            activity={activity}
            placed={placedCount(activity.id)}
            onChange={(patch) => onUpdateActivity(activity.id, patch)}
            onRemove={() => onRemoveActivity(activity.id)}
          />
        ))}
      </div>

      <QuickAdd onAdd={onAddActivity} />
    </div>
  )
}

/** Two fields and a count. Everything else has a default and lives in the row. */
function QuickAdd({ onAdd }: { onAdd: (activity: Activity) => void }) {
  const [name, setName] = useState("")
  const [duration, setDuration] = useState("")
  const [sessions, setSessions] = useState("")

  const minutes = parseDuration(duration)
  const count = Number(sessions || "1")
  const valid = name.trim().length > 0 && minutes !== null && minutes > 0 && count > 0

  const submit = () => {
    if (!valid) return
    onAdd({
      id: `${slug(name)}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      durationMinutes: minutes,
      sessionsPerWeek: count,
      priority: "medium",
    })
    setName("")
    setDuration("")
    setSessions("")
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="border-t border-ink/20 px-6 py-4"
    >
      <div className="label mb-2 text-ink/50">Add activity</div>
      <input
        className={`${inputClass} mb-2 font-sans`}
        placeholder="Gym"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex gap-2">
        <input
          className={inputClass}
          placeholder="1h15"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder="4×"
          value={sessions}
          onChange={(e) => setSessions(e.target.value)}
        />
        <Button type="submit" variant="solid" disabled={!valid}>
          Add
        </Button>
      </div>
    </form>
  )
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "activity"
}
