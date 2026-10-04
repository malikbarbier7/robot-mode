import type { Clock } from "./locale"
import { formatClock, formatSpan } from "./locale"
import type { TicketContent } from "./ticket"
import type { Words } from "./words"
import { triggerDownload } from "./ics"

const INK = "#1b1914"
const THERMAL = "#fbfaf5"
const PAPER = "#d8d2c2"

const LINE = 19.5 // 12px at leading-relaxed
const ZIGZAG = 8

/** How a ticket is laid out, in CSS pixels; the picture draws it at a higher resolution. */
type Layout = {
  width: number
  padX: number
  padTop: number
  padBottom: number
  row: number
  /** The dashed line: its thickness and dash, and the room either side of it. */
  cut: { weight: number; dash: [number, number]; room: number }
  /**
   * Thermal: for a receipt printer, which prints black or nothing. White, no
   * shadow or torn edge, every line in solid ink (the quieter ones lighter in
   * weight instead of grey), and next to no margin, so the printer's app,
   * stretching it to the roll, prints the text as large as it can.
   */
  thermal: boolean
}

/** The ticket as the screen lays it out, for the wallpaper. */
const SCREEN: Layout = { width: 360, padX: 28, padTop: 24, padBottom: 32, row: LINE + 4, cut: { weight: 1, dash: [3, 3], room: 12 }, thermal: false }
const THERMAL_ROLL: Layout = { width: 300, padX: 8, padTop: 10, padBottom: 14, row: LINE + 7, cut: { weight: 2, dash: [6, 4], room: 12 }, thermal: true }

type Fonts = { mono: string; display: string }

/** The page's own fonts (next/font names them), loaded before anything is drawn with them. */
async function pageFonts(): Promise<Fonts> {
  const css = getComputedStyle(document.documentElement)
  const mono = css.getPropertyValue("--font-mono-ui").trim() || "monospace"
  const display = css.getPropertyValue("--font-display-ui").trim() || mono
  await Promise.all([
    document.fonts.load(`400 12px ${mono}`),
    document.fonts.load(`500 12px ${mono}`),
    document.fonts.load(`600 16px ${display}`),
  ]).catch(() => undefined)
  return { mono, display }
}

function ticketHeight(content: TicketContent, l: Layout): number {
  const header = 16 * 1.625 + LINE + 4 + LINE
  const cut = l.cut.room * 2 + l.cut.weight
  return l.padTop + header + cut + content.rows.length * l.row + cut + 2 * LINE + cut + 11 * 1.625 + l.padBottom
}

/** Text with letter-spacing, drawn a character at a time (canvas letterSpacing isn't everywhere yet). */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: "left" | "center" | "right" = "left") {
  const chars = [...text]
  const width = chars.reduce((w, c) => w + ctx.measureText(c).width + spacing, 0) - spacing
  let at = align === "center" ? x - width / 2 : align === "right" ? x - width : x
  for (const c of chars) {
    ctx.fillText(c, at, y)
    at += ctx.measureText(c).width + spacing
  }
}

/** Cut to fit, with an ellipsis, the way the screen truncates a long name. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

/** The ticket, its top-left corner at (x, y), in units of `s` device pixels per CSS pixel. */
function drawTicket(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, content: TicketContent, words: Words, clock: Clock, fonts: Fonts, l: Layout) {
  const height = ticketHeight(content, l)
  const { width, padX } = l
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)

  if (l.thermal) {
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, width, height)
  } else {
    // The thermal paper, lifted a little off the background, torn off in a zigzag.
    ctx.save()
    ctx.shadowColor = "rgb(27 25 20 / 0.22)"
    ctx.shadowBlur = 18
    ctx.shadowOffsetY = 6
    ctx.fillStyle = THERMAL
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(width, 0)
    ctx.lineTo(width, height)
    for (let tx = width; tx > 0; tx -= 12) {
      ctx.lineTo(tx - 6, height + ZIGZAG)
      ctx.lineTo(Math.max(tx - 12, 0), height)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // On a thermal roll, grey would print speckled: everything is solid, the quiet lines thinner than the rest.
  const ink = (alpha = 1) => (ctx.fillStyle = l.thermal ? "#000" : alpha === 1 ? INK : `rgb(27 25 20 / ${alpha})`)
  const mono = (size: number, quiet = false) => (ctx.font = `${l.thermal && !quiet ? 500 : 400} ${size}px ${fonts.mono}`)
  ctx.textBaseline = "middle"
  const center = width / 2
  let cy = l.padTop

  // Header: the name, what it is, the date.
  ink()
  ctx.font = `600 16px ${fonts.display}`
  spaced(ctx, words.name.toUpperCase(), center, cy + 13, 16 * 0.3, "center")
  cy += 16 * 1.625
  ink(0.6)
  mono(12, true)
  spaced(ctx, words.sheet.ticket.toUpperCase(), center, cy + LINE / 2, 12 * 0.18, "center")
  cy += LINE + 4
  ink()
  mono(12)
  spaced(ctx, content.date.toUpperCase(), center, cy + LINE / 2, 12 * 0.12, "center")
  cy += LINE

  const cut = () => {
    const mid = cy + l.cut.room + l.cut.weight / 2
    ctx.save()
    ctx.strokeStyle = l.thermal ? "#000" : "rgb(27 25 20 / 0.5)"
    ctx.lineWidth = l.cut.weight
    ctx.setLineDash(l.cut.dash)
    ctx.beginPath()
    ctx.moveTo(padX, mid)
    ctx.lineTo(width - padX, mid)
    ctx.stroke()
    ctx.restore()
    cy += l.cut.room * 2 + l.cut.weight
  }
  cut()

  // The day, wake to sleep.
  const timeWidth = clock === "12h" ? 72 : 48
  const right = width - padX
  for (const row of content.rows) {
    const mid = cy + l.row / 2
    const time = formatClock(row.minute, clock)
    if (row.kind !== "block") {
      ink(0.6)
      mono(12, true)
      ctx.fillText(time, padX, mid)
      ctx.fillText(row.kind.toUpperCase(), padX + timeWidth + 8, mid)
    } else {
      ink()
      mono(12)
      ctx.fillText(time, padX, mid)
      const span = formatSpan(row.block.endMinute - row.block.startMinute)
      ctx.textAlign = "right"
      ctx.fillText(span, right, mid)
      ctx.textAlign = "left"
      const nameX = padX + timeWidth + 8
      const room = right - ctx.measureText(span).width - 8 - nameX
      ctx.fillText(fit(ctx, `${row.block.name.toUpperCase()}${row.block.locked ? " ■" : ""}`, room), nameX, mid)
    }
    cy += l.row
  }
  cut()

  // The totals.
  ink()
  for (const [label, value] of [["TASKS", String(content.tasks)], ["PLANNED", formatSpan(content.planned)]]) {
    ctx.fillText(label, padX, cy + LINE / 2)
    ctx.textAlign = "right"
    ctx.fillText(value, right, cy + LINE / 2)
    ctx.textAlign = "left"
    cy += LINE
  }
  cut()

  ink(0.55)
  mono(11, true)
  spaced(ctx, words.sheet.motto.toUpperCase(), center, cy + (11 * 1.625) / 2, 11 * 0.16, "center")
  ctx.restore()
}

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas")
  c.width = Math.round(width)
  c.height = Math.round(height)
  return [c, c.getContext("2d")!]
}

/**
 * The ticket alone, edge to edge, for a thermal printer's app to print (or
 * to share): three times the layout's size, so it stays sharp on any roll.
 */
export async function ticketImage(content: TicketContent, words: Words, clock: Clock): Promise<Blob> {
  const fonts = await pageFonts()
  const s = 3
  const [c, ctx] = canvas(THERMAL_ROLL.width * s, ticketHeight(content, THERMAL_ROLL) * s)
  drawTicket(ctx, 0, 0, s, content, words, clock, fonts, THERMAL_ROLL)
  return toBlob(c)
}

/** Between two days on the week's strip: a line to cut along. */
const SCISSORS = 34

/**
 * The week's tickets on one strip, a day after another with a line to cut
 * along between them: printed once on a thermal roll, cut into seven, one
 * for each morning.
 */
export async function ticketStrip(days: TicketContent[], words: Words, clock: Clock): Promise<Blob> {
  const fonts = await pageFonts()
  const s = 3
  const l = THERMAL_ROLL
  const heights = days.map((d) => ticketHeight(d, l))
  const [c, ctx] = canvas(l.width * s, (heights.reduce((a, b) => a + b, 0) + SCISSORS * (days.length - 1)) * s)
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, c.width, c.height)
  let y = 0
  days.forEach((day, i) => {
    if (i > 0) {
      ctx.save()
      ctx.scale(s, s)
      const mid = y / s + SCISSORS / 2
      ctx.fillStyle = "#000"
      // The mono face has no scissors: the system's, large enough to see on the roll.
      ctx.font = "22px sans-serif"
      ctx.textBaseline = "middle"
      ctx.fillText("✂", 0, mid)
      ctx.strokeStyle = "#000"
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(30, mid)
      ctx.lineTo(l.width, mid)
      ctx.stroke()
      ctx.restore()
      y += SCISSORS * s
    }
    drawTicket(ctx, 0, y, s, day, words, clock, fonts, l)
    y += heights[i] * s
  })
  return toBlob(c)
}

/**
 * The ticket as a phone's lock screen: sized to this screen when it is a
 * phone held upright, to a tall phone's otherwise. The ticket sits below
 * where the lock screen puts its clock, and shrinks to stay clear of the
 * buttons at the bottom when the day is long.
 */
export async function ticketWallpaper(content: TicketContent, words: Words, clock: Clock): Promise<Blob> {
  const fonts = await pageFonts()
  const dpr = window.devicePixelRatio || 1
  const portrait = window.screen.height > window.screen.width && window.screen.width < 768
  const [width, height] = portrait ? [window.screen.width * dpr, window.screen.height * dpr] : [1170, 2532]
  const [c, ctx] = canvas(width, height)
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, c.width, c.height)

  const top = c.height * 0.34
  const bottom = c.height * 0.9
  const full = ticketHeight(content, SCREEN) + ZIGZAG
  const s = Math.min((c.width * 0.8) / SCREEN.width, (bottom - top) / full)
  drawTicket(ctx, (c.width - SCREEN.width * s) / 2, top, s, content, words, clock, fonts, SCREEN)
  return toBlob(c)
}

function toBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("No image"))), "image/png"))
}

/**
 * A picture, kept: on a phone, through the share sheet (where Save Image puts
 * it in Photos, ready to be a wallpaper); elsewhere, downloaded.
 */
export async function saveImage(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: "image/png" })
  const touch = window.matchMedia("(pointer: coarse)").matches
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (e) {
      // Closing the share sheet is a choice, not a failure.
      if (e instanceof DOMException && e.name === "AbortError") return
    }
  }
  triggerDownload(blob, filename)
}
