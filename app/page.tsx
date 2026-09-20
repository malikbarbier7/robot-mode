"use client"

import { useRef, useState } from "react"
import { BlockBar } from "@/components/BlockBar"
import { BudgetBar } from "@/components/BudgetBar"
import { BuildScreen } from "@/components/BuildScreen"
import { DefinePanel } from "@/components/DefinePanel"
import { Generating } from "@/components/Generating"
import { NowCard } from "@/components/NowCard"
import { Templates } from "@/components/Templates"
import { WeekGrid } from "@/components/WeekGrid"
import { Button } from "@/components/ui"
import { downloadIcs, downloadText } from "@/lib/ics"
import { fromJson, toJson } from "@/lib/storage"
import { useRobotMode } from "@/lib/useRobotMode"

type View = "list" | "week" | "now" | "templates" | "generating"

export default function Page() {
  const rm = useRobotMode()
  // Null until the user navigates, so the landing screen can follow the saved
  // state once it hydrates: the list before a week exists, the week after.
  const [chosenView, setView] = useState<View | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const empty = rm.state.settings.activities.length === 0
  const generated = rm.state.generated === true
  const view: View = chosenView ?? (generated ? "week" : "list")
  // Before the first Generate there is no week, so the week chrome stays hidden.
  const showWeekChrome = generated && view !== "generating"

  const selected = rm.schedule.blocks.find((b) => b.id === selectedId) ?? null
  const weekEdits = rm.state.locked.length + rm.state.skipped.length + (rm.notBefore ? 1 : 0)

  const generate = () => {
    setSelectedId(null)
    setView("generating")
  }

  const pickTemplate = (template: Parameters<typeof rm.applyTemplate>[0]) => {
    if (!empty && !window.confirm(`Replace your list with "${template.name}"?`)) return
    rm.applyTemplate(template)
    setSelectedId(null)
    // A template with activities goes straight to the reveal; a blank one has
    // nothing to schedule, so it drops you into the list to start writing.
    setView(template.settings.activities.length > 0 ? "generating" : "list")
  }

  const importJson = async (file: File) => {
    const parsed = fromJson(await file.text())
    if (!parsed) {
      window.alert("That file isn't a Robot Mode export.")
      return
    }
    rm.replaceState(parsed)
    setView(parsed.generated ? "week" : "list")
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-end justify-between gap-6 border-b-2 border-ink px-6 pb-3 pt-5">
        <button type="button" onClick={() => setView(generated ? "week" : "list")} className="text-left">
          <h1 className="font-display text-4xl leading-none">Robot Mode</h1>
          <p className="label mt-1.5 text-ink/45">Wake · Execute · Sleep · Repeat</p>
        </button>

        <div className="flex items-center gap-2 pb-0.5">
          {showWeekChrome && (
            <>
              <button
                type="button"
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
                title="Your activity list"
                className="label mr-1 border border-ink bg-ink px-3 py-1 text-paper hover:bg-paper hover:text-ink"
              >
                Home page
              </button>

              <div className="flex">
                {(
                  [
                    ["week", "Week"],
                    ["now", "Now"],
                  ] as const
                ).map(([v, label], i) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    className={`label border border-ink px-3 py-1 ${i > 0 ? "border-l-0" : ""} ${
                      view === v ? "bg-ink text-paper" : "hover:bg-ink/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
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
            </>
          )}

          <Button
            onClick={() => downloadText(toJson(rm.state), "robot-mode.json")}
            disabled={empty}
            title="Back up your setup"
          >
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

      {showWeekChrome && view !== "list" && (
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
        {showWeekChrome && view !== "list" && (
          <aside className="w-[340px] shrink-0 border-r border-ink/20">
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
          </aside>
        )}

        <main className="min-w-0 flex-1 overflow-auto">
          {!rm.hydrated ? null : view === "generating" ? (
            <Generating
              settings={rm.state.settings}
              schedule={rm.schedule}
              onDone={() => {
                rm.markGenerated()
                setView("week")
              }}
            />
          ) : view === "templates" ? (
            <Templates onPick={pickTemplate} onCancel={() => setView(generated ? "week" : "list")} />
          ) : view === "week" && generated ? (
            <WeekGrid
              settings={rm.state.settings}
              schedule={rm.schedule}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : view === "now" && generated ? (
            <NowCard schedule={rm.schedule} onMissed={rm.markMissed} />
          ) : (
            <BuildScreen
              settings={rm.state.settings}
              budget={rm.budget}
              schedule={rm.schedule}
              onPatchSettings={rm.patchSettings}
              onAddActivity={rm.addActivity}
              onUpdateActivity={rm.updateActivity}
              onRemoveActivity={rm.removeActivity}
              onGenerate={generate}
              onOpenTemplates={() => setView("templates")}
            />
          )}
        </main>
      </div>

      {showWeekChrome && view === "week" && selected && (
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
