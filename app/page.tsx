"use client"

import { useRef, useState } from "react"
import { BlockBar } from "@/components/BlockBar"
import { BudgetBar } from "@/components/BudgetBar"
import { DefinePanel } from "@/components/DefinePanel"
import { NowCard } from "@/components/NowCard"
import { Templates } from "@/components/Templates"
import { WeekGrid } from "@/components/WeekGrid"
import { Button } from "@/components/ui"
import { downloadIcs, downloadText } from "@/lib/ics"
import { fromJson, toJson } from "@/lib/storage"
import { useRobotMode } from "@/lib/useRobotMode"

export default function Page() {
  const rm = useRobotMode()
  const [view, setView] = useState<"week" | "now" | "templates">("week")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const empty = rm.state.settings.activities.length === 0
  const selected = rm.schedule.blocks.find((b) => b.id === selectedId) ?? null

  // "Reset week" only undoes per-week edits, so it is dead unless there are some.
  const weekEdits = rm.state.locked.length + rm.state.skipped.length + (rm.notBefore ? 1 : 0)

  const pickTemplate = (template: Parameters<typeof rm.applyTemplate>[0]) => {
    if (!empty && !window.confirm(`Replace your current week with "${template.name}"?`)) return
    rm.applyTemplate(template)
    setSelectedId(null)
    setView("week")
  }

  const importJson = async (file: File) => {
    const parsed = fromJson(await file.text())
    if (parsed) rm.replaceState(parsed)
    else window.alert("That file isn't a Robot Mode export.")
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-end justify-between gap-6 border-b-2 border-ink px-6 pb-3 pt-5">
        <div>
          <h1 className="font-display text-4xl leading-none">Robot Mode</h1>
          <p className="label mt-1.5 text-ink/45">Wake · Execute · Sleep · Repeat</p>
        </div>

        <div className="flex items-center gap-2 pb-0.5">
          <div className="flex">
            {(["week", "now"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`label border border-ink px-3 py-1 ${
                  view === v ? "bg-ink text-paper" : "hover:bg-ink/10"
                } ${v === "now" ? "border-l-0" : ""}`}
                aria-pressed={view === v}
              >
                {v}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setView("templates")}
              disabled={view === "templates"}
              aria-pressed={view === "templates"}
              title="Back to the template picker"
              className={`label border border-l-0 border-ink px-3 py-1 disabled:opacity-30 ${
                view === "templates" ? "bg-ink text-paper" : "hover:bg-ink/10"
              }`}
            >
              Home
            </button>
          </div>
          <Button onClick={rm.shuffle} disabled={empty} title="Same constraints, different arrangement">
            Shuffle
          </Button>
          <Button
            onClick={rm.freshWeek}
            disabled={weekEdits === 0}
            title={
              weekEdits === 0
                ? "Nothing to clear: no locked blocks, removed blocks or missed sessions"
                : `Unlock ${rm.state.locked.length} block(s), restore ${rm.state.skipped.length} removed, and undo today's replan`
            }
          >
            Clear edits{weekEdits > 0 ? ` (${weekEdits})` : ""}
          </Button>
          <Button
            variant="solid"
            disabled={empty}
            onClick={() => downloadIcs(rm.schedule.blocks, { sequence: rm.bumpExport() })}
          >
            Export .ics
          </Button>
          <Button onClick={() => downloadText(toJson(rm.state), "robot-mode.json")} disabled={empty} title="Back up your setup">
            Save
          </Button>
          <Button onClick={() => fileInput.current?.click()}>Load</Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importJson(file)
              e.target.value = ""
            }}
          />
        </div>
      </header>

      {!empty && (
        <>
          <div className="border-b border-ink/20">
            <BudgetBar budget={rm.budget} />
          </div>
          {rm.schedule.unplaced.length > 0 && (
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-ink/20 bg-ink/[0.04] px-6 py-2">
              <span className="label text-ink/55">Did not fit</span>
              {rm.schedule.unplaced.map((u) => (
                <span key={u.activityId} className="font-mono text-[11px]">
                  {u.name} {u.sessionsPlaced}/{u.sessionsRequested}
                  <span className="text-ink/45"> — {u.why}</span>
                </span>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="w-[340px] shrink-0 border-r border-ink/20">
          {rm.hydrated && (
            <DefinePanel
              settings={rm.state.settings}
              schedule={rm.schedule}
              onPatchSettings={rm.patchSettings}
              onAddActivity={rm.addActivity}
              onUpdateActivity={rm.updateActivity}
              onRemoveActivity={rm.removeActivity}
              template={rm.activeTemplate}
              templateEdited={rm.templateEdited}
              onResetToTemplate={rm.resetToTemplate}
            />
          )}
        </aside>

        <main className="min-w-0 flex-1 overflow-auto">
          {!rm.hydrated ? null : empty || view === "templates" ? (
            <Templates onPick={pickTemplate} onCancel={empty ? undefined : () => setView("week")} />
          ) : view === "week" ? (
            <WeekGrid
              settings={rm.state.settings}
              schedule={rm.schedule}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <NowCard schedule={rm.schedule} onMissed={rm.markMissed} />
          )}
        </main>
      </div>

      {selected && (
        <BlockBar
          block={selected}
          onToggleLock={() => rm.toggleLock(selected.id)}
          onRemove={() => {
            rm.removeBlock(selected.id)
            setSelectedId(null)
          }}
          onMissed={() => {
            rm.markMissed(selected.id)
            setSelectedId(null)
          }}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}
