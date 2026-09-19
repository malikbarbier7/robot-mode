/** Prints a generated week as text. Sanity check for the engine: `npx tsx scripts/preview.mts` */
import { generate } from "../lib/scheduler/generate"
import { DAY_NAMES, formatTime } from "../lib/scheduler/time"
import { comfortableWeek, impossibleWeek } from "../lib/fixtures/weeks"
import type { Settings } from "../lib/types"

function show(label: string, settings: Settings) {
  const t0 = performance.now()
  const schedule = generate(settings)
  const ms = performance.now() - t0

  const b = schedule.budget
  console.log(`\n=== ${label} ===`)
  console.log(
    `${Math.round(b.requestedMinutes / 60)}h requested of ${Math.round(b.allocatableMinutesPerWeek / 60)}h allocatable` +
      (b.feasible ? "" : `  OVER BY ${Math.round(b.overByMinutes / 60)}h -> cut "${b.suggestion?.name}"`),
  )
  console.log(`solved in ${ms.toFixed(0)}ms, score ${schedule.score.toFixed(0)}\n`)

  for (let day = 0; day < 7; day++) {
    const blocks = schedule.blocks.filter((x) => x.day === day).sort((x, y) => x.startMinute - y.startMinute)
    console.log(`${DAY_NAMES[day]}`)
    if (blocks.length === 0) console.log("      (free)")
    for (const x of blocks) {
      console.log(`  ${formatTime(x.startMinute)}-${formatTime(x.endMinute)}  ${x.name.padEnd(14)} ${x.reason}`)
    }
    console.log()
  }

  for (const u of schedule.unplaced) {
    console.log(`  ! ${u.name}: ${u.sessionsPlaced}/${u.sessionsRequested} placed - ${u.why}`)
  }
}

show("Comfortable week", comfortableWeek)
show("Impossible week", impossibleWeek)
