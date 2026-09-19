import { templates, type Template } from "@/lib/templates"
import { Button } from "./ui"

export function Templates({
  onPick,
  onCancel,
}: {
  onPick: (template: Template) => void
  /** Only passed when there is already a week to go back to. */
  onCancel?: () => void
}) {
  return (
    <div className="px-10 py-14">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="font-display text-5xl leading-none">
            {onCancel ? "Start over from a week." : "Start from a week."}
          </h2>
          <p className="mt-3 max-w-md text-[13px] leading-relaxed text-ink/65">
            {onCancel
              ? "Picking one replaces everything you have now. Save your setup first if you want to keep it."
              : "Pick the closest one and edit it. Nothing here is fixed — every activity, time and priority can change, and the schedule rebuilds as you go."}
          </p>
        </div>
        {onCancel && <Button onClick={onCancel}>← Back to my week</Button>}
      </div>

      <div className="mt-10 grid border-l border-t border-ink/25 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onPick(template)}
            className="group border-b border-r border-ink/25 bg-paper p-5 text-left hover:bg-ink hover:text-paper"
          >
            <div className="font-display text-2xl leading-none">{template.name}</div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink/60 group-hover:text-paper/75">
              {template.blurb}
            </p>
            <div className="label mt-4 text-ink/45 group-hover:text-paper/70">
              {template.settings.activities.length} activities →
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
