"use client"

import { useMemo, useRef, useState } from "react"
import { BlockBar } from "@/components/BlockBar"
import { BudgetBar } from "@/components/BudgetBar"
import { BuildScreen } from "@/components/BuildScreen"
import { DefinePanel } from "@/components/DefinePanel"
import { Generating } from "@/components/Generating"
import { NowCard } from "@/components/NowCard"
import { Setup } from "@/components/Setup"
import { Templates } from "@/components/Templates"
import { WeekGrid } from "@/components/WeekGrid"
import { Button } from "@/components/ui"
import { downloadIcs, downloadText } from "@/lib/ics"
import { fromJson, toJson } from "@/lib/storage"
import { useRobotMode } from "@/lib/useRobotMode"
import { suggestFixes } from "@/lib/suggest"

type View = "setup" | "list" | "week" | "now" | "templates" | "generating"

export default function Page() {
  const rm = useRobotMode()
  // Null until the user navigates, so the landing screen can follow the saved
  // state once it hydrates: the setup questions when there is nothing yet, the
  // list before a week exists, the week after.
  const [chosenView, setView] = useState<View | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [fixing, setFixing] = useState<string | null>(null)

  const empty = rm.state.settings.activities.length === 0
  const generated = rm.state.generated === true
  const home: View = generated ? "week" : empty ? "setup" : "list"
  // Once the questions are on screen they stay there: adding the first
  // activity makes the list non-empty, which would otherwise skip to the list.
  if (chosenView === null && rm.hydrated && home === "setup") setView("setup")
  const view: View = chosenView ?? home
  // Before the first Generate there is no week, so the week chrome stays hidden.
  const showWeekChrome = generated && view !== "generating"

  const selected = rm.schedule.blocks.find((b) => b.id === selectedId) ?? null
  const weekEdits = rm.state.locked.length + rm.state.skipped.length + (rm.notBefore ? 1 : 0)

  // Only worked out when asked: each suggestion costs a trial solve to verify.
  const suggestions = useMemo(() => {
    const conflict = rm.schedule.unplaced.find((u) => u.activityId === fixing)
    return conflict ? suggestFixes(rm.state.settings, conflict) : []
  }, [fixing, rm.schedule.unplaced, rm.state.settings])

  const generate = () => {
    setSelectedId(null)
    setView("generating")
  }

  const pickTemplate = (template: Parameters<typeof rm.applyTemplate>[0]) => {
    if (!empty && !window.confirm(`Replace your list with "${template.name}"?`)) return
    rm.applyTemplate(template)
    setSelectedId(null)
    // A template with activities goes straight to the reveal; a blank one has
    // nothing to schedule, so it drops you into the questions to start writing.
    setView(template.settings.activities.length > 0 ? "generating" : "setup")
  }

  const importJson = async (file: File) => {
    const parsed = fromJson(await file.text())
    if (!parsed) {
      window.alert("That file isn't a Robot Mode export.")
      return
    }
    rm.replaceState(parsed)
    setView(parsed.generated ? "week" : parsed.settings.activities.length > 0 ? "list" : "setup")
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-end justify-between gap-6 border-b-2 border-ink px-6 pb-3 pt-5">
        <button type="button" onClick={() => setView(home)} className="text-left">
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
            <div className="border-b-2 border-alert bg-alert/[0.07] px-6 py-3 text-alert">
              <div className="label mb-1.5">
                {rm.schedule.unplaced.length === 1
                  ? "1 conflict"
                  : `${rm.schedule.unplaced.length} conflicts`}
              </div>
              <ul className="space-y-1.5">
                {rm.schedule.unplaced.map((u) => (
                  <li key={u.activityId}>
                    <div className="flex items-baseline gap-2 font-mono text-[11px] leading-relaxed">
                      <span className="min-w-0 flex-1">
                        <span className="font-sans text-[12px] font-medium">{u.name}</span>{" "}
                        <span className="tabular-nums opacity-70">
                          {u.sessionsPlaced}/{u.sessionsRequested}
                        </span>{" "}
                        — {u.why}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFixing(fixing === u.activityId ? null : u.activityId)}
                        className="label shrink-0 border border-alert px-2 py-0.5 hover:bg-alert hover:text-paper"
                      >
                        {fixing === u.activityId ? "Close" : "Fix"}
                      </button>
                    </div>

                    {fixing === u.activityId && (
                      <div className="mt-1.5 space-y-1 border-l-2 border-alert/40 pl-3">
                        {suggestions.length === 0 ? (
                          <p className="font-mono text-[11px] opacity-70">
                            No single change fixes this one.
                          </p>
                        ) : (
                          suggestions.map((fix) => (
                            <button
                              key={fix.id}
                              type="button"
                              onClick={() => {
                                rm.patchSettings(fix.settings)
                                setFixing(null)
                              }}
                              className="block w-full border border-alert/40 px-2 py-1 text-left font-mono text-[11px] hover:bg-alert hover:text-paper"
                            >
                              {fix.label}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
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
          ) : view === "setup" ? (
            <Setup
              settings={rm.state.settings}
              schedule={rm.schedule}
              onPatchSettings={rm.patchSettings}
              onAddActivity={rm.addActivity}
              onUpdateActivity={rm.updateActivity}
              onRemoveActivity={rm.removeActivity}
              onDone={() => setView("list")}
              onOpenTemplates={() => setView("templates")}
            />
          ) : view === "templates" ? (
            <Templates onPick={pickTemplate} onCancel={() => setView(home)} />
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
