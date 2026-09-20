"use client"

import { useState } from "react"
import type { Activity, BudgetReport, Schedule, Settings } from "@/lib/types"
import { ActivityRow } from "./ActivityRow"
import { formatHours, parseDuration } from "@/lib/duration"
import { Button } from "./ui"

const FIELD =
  "border-0 border-b border-ink/25 bg-transparent px-0 py-2 text-[18px] placeholder:text-ink/30"

/** One-click starters, so an empty list is never a blank page. */
const SUGGESTIONS = [
  { name: "Gym", duration: "1h15", sessions: 4 },
  { name: "Reading", duration: "1h", sessions: 7 },
  { name: "Deep work", duration: "2h", sessions: 5 },
  { name: "Language", duration: "45m", sessions: 5 },
  { name: "Cooking", duration: "45m", sessions: 7 },
  { name: "Walk", duration: "30m", sessions: 7 },
]

export function BuildScreen({
  settings,
  budget,
  schedule,
  onPatchSettings,
  onAddActivity,
  onUpdateActivity,
  onRemoveActivity,
  onGenerate,
  onOpenTemplates,
}: {
  settings: Settings
  budget: BudgetReport
  schedule: Schedule
  onPatchSettings: (patch: Partial<Settings>) => void
  onAddActivity: (activity: Activity) => void
  onUpdateActivity: (id: string, patch: Partial<Activity>) => void
  onRemoveActivity: (id: string) => void
  onGenerate: () => void
  onOpenTemplates: () => void
}) {
  const [name, setName] = useState("")
  const [duration, setDuration] = useState("")
  const [sessions, setSessions] = useState("")

  const minutes = parseDuration(duration)
  const count = Number(sessions || "1")
  const valid = name.trim().length > 0 && minutes !== null && minutes > 0 && count > 0
  const activities = settings.activities

  const add = (activityName: string, durationText: string, perWeek: number) => {
    const parsed = parseDuration(durationText)
    if (!parsed) return
    onAddActivity({
      id: `${slug(activityName)}-${Math.random().toString(36).slice(2, 6)}`,
      name: activityName.trim(),
      durationMinutes: parsed,
      sessionsPerWeek: perWeek,
      priority: "medium",
    })
  }

  const submit = () => {
    if (!valid) return
    add(name, duration, count)
    setName("")
    setDuration("")
    setSessions("")
  }

  const used = activities.map((a) => a.name.toLowerCase())
  const unusedSuggestions = SUGGESTIONS.filter((s) => !used.includes(s.name.toLowerCase()))

  return (
    <div className="mx-auto w-full max-w-[760px] px-6 py-12">
      <h2 className="font-display text-6xl leading-[0.95]">What do you want to do?</h2>
      <p className="mt-4 max-w-lg text-[14px] leading-relaxed text-ink/65">
        List everything, with how long each one takes and how often you want it. Robot Mode works
        out when it all fits.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="mt-10 flex gap-2 border-y-2 border-ink py-4"
      >
        <input
          className={`${FIELD} min-w-0 flex-1 font-sans`}
          placeholder="Gym"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <input
          className={`${FIELD} w-24 shrink-0 font-mono tabular-nums`}
          placeholder="1h15"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
        <input
          className={`${FIELD} w-16 shrink-0 font-mono tabular-nums`}
          placeholder="4×"
          value={sessions}
          onChange={(e) => setSessions(e.target.value)}
        />
        <Button type="submit" variant="solid" disabled={!valid}>
          Add
        </Button>
      </form>

      {activities.length === 0 ? (
        <div className="py-10">
          <div className="label mb-3 text-ink/45">Or start with one of these</div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => add(s.name, s.duration, s.sessions)}
                className="border border-ink/35 px-3 py-1.5 text-[13px] hover:bg-ink hover:text-paper"
              >
                {s.name}{" "}
                <span className="font-mono text-[11px] opacity-60">
                  {s.duration} · {s.sessions}×
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
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
            <p className="label mt-3 text-ink/35">
              Click an activity to set priority, days, preferred time or travel buffer
            </p>
          </div>

          {unusedSuggestions.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="label text-ink/40">Add</span>
              {unusedSuggestions.slice(0, 4).map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => add(s.name, s.duration, s.sessions)}
                  className="label border border-ink/25 px-2 py-1 text-ink/60 hover:bg-ink hover:text-paper"
                >
                  + {s.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt-12 border-t border-ink/25 pt-6">
        <div className="label mb-3 text-ink/45">Your day</div>
        <div className="flex flex-wrap items-center gap-6">
          <DayField
            label="Wake"
            value={settings.wakeTime}
            onChange={(v) => onPatchSettings({ wakeTime: v })}
          />
          <DayField
            label="Sleep"
            value={settings.sleepTime}
            onChange={(v) => onPatchSettings({ sleepTime: v })}
          />
          <label className="flex items-baseline gap-2">
            <span className="label text-ink/45">Free time a day</span>
            <input
              type="number"
              min={0}
              step={30}
              value={settings.minFreeMinutesPerDay}
              onChange={(e) =>
                onPatchSettings({ minFreeMinutesPerDay: Math.max(0, Number(e.target.value)) })
              }
              className="w-16 border-b border-ink/30 bg-transparent py-1 font-mono text-[15px] tabular-nums"
            />
            <span className="label text-ink/45">min</span>
          </label>
        </div>

        {activities.length > 0 && (
          <div className="mt-6">
            <div className="relative h-3 border border-ink/40">
              <div
                className={`absolute inset-y-0 left-0 ${budget.feasible ? "bg-ink" : "hatch"}`}
                style={{
                  width: `${Math.min(
                    budget.allocatableMinutesPerWeek > 0
                      ? (budget.requestedMinutes / budget.allocatableMinutesPerWeek) * 100
                      : 0,
                    100,
                  )}%`,
                }}
              />
            </div>
            <div className="mt-2 font-mono text-[12px] tabular-nums text-ink/60">
              {formatHours(budget.requestedMinutes)} of {formatHours(budget.allocatableMinutesPerWeek)}{" "}
              available
              {!budget.feasible && (
                <span className="text-ink">
                  {" "}
                  — over by {formatHours(budget.overByMinutes)}
                  {budget.suggestion && `, try cutting ${budget.suggestion.name}`}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-12">
        <button
          type="button"
          onClick={onGenerate}
          disabled={activities.length === 0}
          className="w-full border-2 border-ink bg-ink px-6 py-5 font-display text-3xl text-paper transition-colors hover:bg-paper hover:text-ink disabled:border-ink/25 disabled:bg-transparent disabled:text-ink/25"
        >
          Generate my week
        </button>
        <p className="label mt-3 text-center text-ink/40">
          {activities.length === 0
            ? "Add at least one activity"
            : `${activities.length} activities · ${totalSessions(activities)} sessions`}
        </p>
      </div>

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
    </div>
  )
}

function DayField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex items-baseline gap-2">
      <span className="label text-ink/45">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="border-b border-ink/30 bg-transparent py-1 font-mono text-[15px] tabular-nums"
      />
    </label>
  )
}

function totalSessions(activities: Activity[]): number {
  return activities.reduce((n, a) => n + a.sessionsPerWeek, 0)
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "activity"
}
