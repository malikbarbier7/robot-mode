"use client"

import { useEffect, useRef, useState } from "react"
import { templates, type Template } from "@/lib/templates"
import { describe } from "@/lib/command"
import { mealsOf } from "@/lib/meals"
import { formatHours } from "@/lib/duration"
import { formatClock, localizeTimes } from "@/lib/locale"
import { parseTime } from "@/lib/scheduler/time"
import { useDisplay } from "./Display"
import { Command } from "./Machine"

/**
 * The template library, on the setup terminal itself: ready-made weeks down
 * the left, the highlighted one's contents on the right, written the way the
 * prompt reads them. ↑ ↓ to browse, Enter to load it, Esc to go back to the
 * questions. Loading over activities already entered asks first, on screen.
 */
export function TemplateLibrary({
  replacing,
  asking,
  onAsk,
  onLoad,
  onCancel,
}: {
  /** How many activities are already entered, which loading a template would replace. */
  replacing: number
  /** The template waiting for a yes before it replaces them, if any. */
  asking: Template | null
  onAsk: (template: Template | null) => void
  onLoad: (template: Template) => void
  onCancel: () => void
}) {
  const { clock } = useDisplay()
  const [shownId, setShownId] = useState(templates[0].id)
  const shown = templates.find((t) => t.id === shownId) ?? templates[0]
  const root = useRef<HTMLDivElement>(null)
  const setAsking = onAsk

  const choose = (template: Template) => {
    if (replacing > 0) setAsking(template)
    else onLoad(template)
  }

  // The question takes the cursor; answering it hands it back to the week it was about.
  useEffect(() => {
    const el = root.current
    ;(el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>("[data-nav]"))?.focus()
  }, [asking])

  // While asking, Y and N answer; Esc is "no".
  useEffect(() => {
    if (!asking) return
    const key = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === "y") {
        e.preventDefault()
        onLoad(asking)
      } else if (k === "n" || e.key === "Escape") {
        // Handled here, so the terminal's own Esc does not also leave the library.
        e.preventDefault()
        setAsking(null)
      }
    }
    window.addEventListener("keydown", key, true)
    return () => window.removeEventListener("keydown", key, true)
  }, [asking, onLoad, setAsking])

  if (asking) {
    return (
      <div ref={root} className="font-crt uppercase">
        <div className="text-[28px] tracking-[0.2em] text-ink/60">Template library · confirm</div>
        <h2 className="mt-1 text-[44px] leading-none tracking-[0.04em] sm:text-[60px]">
          Replace your {replacing === 1 ? "activity" : `${replacing} activities`}?
        </h2>
        <p className="mt-4 text-[26px] tracking-[0.08em] text-ink/60">
          Loading {asking.name} replaces what you have entered, with its own hours and meals.
        </p>
        <div className="mt-10 flex flex-col items-start gap-3">
          <Command keyName="Y" onClick={() => onLoad(asking)} primary>
            Yes, load {asking.name}
          </Command>
          <Command keyName="N" onClick={() => setAsking(null)} secondary>
            No, keep mine
          </Command>
        </div>
      </div>
    )
  }

  const activities = shown.settings.activities
  const meals = mealsOf(shown.settings).filter((m) => m.enabled)

  return (
    <div ref={root} className="flex flex-1 flex-col font-crt uppercase">
      <div className="flex flex-wrap items-baseline gap-x-6">
        <h2 className="text-[40px] leading-none tracking-[0.04em]">Start from a week</h2>
        <span className="text-[22px] tracking-[0.1em] text-ink/60">Everything in it can be changed after.</span>
      </div>

      <div className="mb-1 mt-2 grid gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        {/* The drawer of weeks. */}
        <ol className="border-t border-ink/30">
          {templates.map((t) => {
            const hours = t.settings.activities.reduce((sum, a) => sum + a.durationMinutes * a.sessionsPerWeek, 0)
            return (
              <li key={t.id}>
                <button
                  type="button"
                  data-nav
                  data-autofocus={t.id === shownId ? "" : undefined}
                  onFocus={() => setShownId(t.id)}
                  // Pointing is selecting, so the preview and the Load key always agree with the cursor.
                  onMouseEnter={(e) => e.currentTarget.focus()}
                  onClick={() => choose(t)}
                  className={`flex w-full items-baseline gap-4 border-b border-ink/20 py-0.5 text-left text-[24px] leading-tight uppercase hover:bg-ink/[0.07] ${
                    t.id === shown.id ? "text-ink" : "text-ink/70"
                  }`}
                >
                  <span className="w-6 text-ink/60">{t.id === shown.id ? ">" : ""}</span>
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  <span className="shrink-0 text-[20px] tabular-nums text-ink/55">
                    {t.settings.activities.length ? `${t.settings.activities.length} · ${formatHours(hours)}` : "Blank"}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        {/* What is inside the highlighted one, written as the prompt would read it. */}
        <div className="border-2 border-ink/40 px-4 py-2">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[30px] leading-none">{shown.name}</span>
            <span className="text-[22px] tabular-nums text-ink/55">
              {formatClock(parseTime(shown.settings.wakeTime), clock)} → {formatClock(parseTime(shown.settings.sleepTime), clock)}
            </span>
          </div>
          <p className="mt-1 truncate text-[20px] normal-case leading-tight tracking-[0.04em] text-ink/65" title={shown.blurb}>{shown.blurb}</p>
          <div className="mt-1.5 border-t border-dashed border-ink/30 pt-1.5">
            {activities.length === 0 ? (
              <p className="text-[24px] text-ink/55">No activities: you write the week yourself.</p>
            ) : (
              <ul className="text-[20px] leading-tight">
                {activities.map((a) => (
                  <li key={a.id} className="truncate">
                    <span className="text-ink/45">&gt; </span>
                    {localizeTimes(describe(a), clock)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {meals.length > 0 && (
            <div className="mt-2 truncate border-t border-dashed border-ink/30 pt-2 text-[20px] leading-tight text-ink/60">
              Meals · {meals.map((m) => `${m.name} ${formatClock(parseTime(m.start), clock)}`).join(" · ")}
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-ink/30 pt-2">
        <Command keyName="Esc" onClick={onCancel} secondary>
          ◀ Back to my list
        </Command>
        {/* Lit like the way forward, at the size of a line, so the library fits the screen. */}
        <Command keyName="Enter" onClick={() => choose(shown)}>
          <span className="bg-ink px-2 text-paper [text-shadow:none]">Load {shown.name} ▶</span>
        </Command>
      </div>
    </div>
  )
}
