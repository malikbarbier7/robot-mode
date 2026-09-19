import type { Day, PlacedBlock } from "./types"

const WEEK_MINUTES = 7 * 1440

/**
 * Blocks carry the day whose waking window they belong to, so a 00:30 block on
 * Saturday night has day=5 and startMinute=1470. Laying the week out on one
 * minute line keeps that case honest.
 */
function absStart(block: PlacedBlock): number {
  return block.day * 1440 + block.startMinute
}

function absEnd(block: PlacedBlock): number {
  return block.day * 1440 + block.endMinute
}

export type NowSelection = {
  current: PlacedBlock | null
  next: PlacedBlock | null
  /** False when the next block belongs to a later day than the one in progress. */
  nextIsToday: boolean
}

export function pickNow(blocks: PlacedBlock[], day: Day, minute: number): NowSelection {
  const now = day * 1440 + minute
  const sorted = [...blocks].sort((a, b) => absStart(a) - absStart(b))

  // A block that started before midnight can still be running now.
  const current = sorted.find((b) => absStart(b) <= now && now < absEnd(b)) ?? null

  let next = sorted.find((b) => absStart(b) > now) ?? null
  // Late on Sunday, the next thing is Monday morning.
  if (!next && sorted.length > 0) next = sorted[0]

  const referenceDay = current?.day ?? day
  const nextIsToday = next !== null && next.day === referenceDay

  return { current, next, nextIsToday }
}

/** Minutes from now until a block starts, wrapping around the end of the week. */
export function minutesUntil(block: PlacedBlock, day: Day, minute: number): number {
  const delta = absStart(block) - (day * 1440 + minute)
  return delta >= 0 ? delta : delta + WEEK_MINUTES
}
