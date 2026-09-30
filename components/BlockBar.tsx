"use client"

import type { PlacedBlock } from "@/lib/types"
import { DAY_NAMES } from "@/lib/scheduler/time"
import { formatClock, localizeTimes } from "@/lib/locale"
import { useDisplay } from "./Display"
import { Button } from "./ui"

export function BlockBar({
  block,
  onToggleLock,
  onRemove,
  onMissed,
  onClose,
}: {
  block: PlacedBlock
  onToggleLock: () => void
  onRemove: () => void
  onMissed: () => void
  onClose: () => void
}) {
  const { clock } = useDisplay()
  return (
    <div className="flex items-center gap-5 border-t-2 border-ink bg-paper px-6 py-3">
      <div className="font-mono text-[11px] tabular-nums text-ink/60">
        {DAY_NAMES[block.day]} {formatClock(block.startMinute, clock)}–{formatClock(block.endMinute, clock)}
      </div>
      <div className="text-[14px]">{block.name}</div>
      {/* Deterministic scheduling means every block can say why it is here. */}
      <div className="min-w-0 flex-1 truncate text-[12px] text-ink/50">{localizeTimes(block.reason, clock)}</div>
      <Button onClick={onToggleLock} variant={block.locked ? "solid" : "outline"}>
        {block.locked ? "Locked" : "Lock"}
      </Button>
      <Button onClick={onMissed}>I missed this</Button>
      <Button onClick={onRemove}>Remove</Button>
      <Button onClick={onClose} variant="bare">
        ✕
      </Button>
    </div>
  )
}
