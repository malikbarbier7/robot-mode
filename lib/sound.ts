/**
 * The machine's sounds, synthesised with Web Audio so there is nothing to
 * download: key clicks, the dot-matrix head, beeps, a refusal buzz and a
 * faint mains hum. Browsers only allow audio after a gesture, so nothing
 * plays until `unlock()` has run from a click or key press; until then
 * every call is silent rather than queued.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null
let hum: { stop: () => void } | null = null
let enabled = true

function audio(): AudioContext | null {
  if (!enabled || typeof window === "undefined") return null
  if (!ctx) {
    try {
      ctx = new AudioContext()
      master = ctx.createGain()
      master.gain.value = 0.5
      master.connect(ctx.destination)
    } catch {
      return null
    }
  }
  return ctx.state === "running" ? ctx : null
}

/** Call from a user gesture: wakes the audio, and the hum with it. */
export function unlock() {
  if (!enabled || typeof window === "undefined") return
  audio()
  if (ctx && ctx.state !== "running") void ctx.resume().then(startHum)
  else startHum()
}

export function setSoundEnabled(on: boolean) {
  enabled = on
  if (!on) stopHum()
}

function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise
  noise = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return noise
}

/** A short shaped burst of filtered noise: the body of every mechanical sound. */
function burst(c: AudioContext, at: number, length: number, freq: number, gain: number, q = 1.2) {
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c)
  const filter = c.createBiquadFilter()
  filter.type = "bandpass"
  filter.frequency.value = freq
  filter.Q.value = q
  const env = c.createGain()
  env.gain.setValueAtTime(gain, at)
  env.gain.exponentialRampToValueAtTime(0.0001, at + length)
  src.connect(filter).connect(env).connect(master!)
  src.start(at, Math.random() * 0.4)
  src.stop(at + length + 0.01)
}

function tone(c: AudioContext, at: number, freq: number, length: number, gain: number, type: OscillatorType = "square") {
  const osc = c.createOscillator()
  osc.type = type
  osc.frequency.value = freq
  const env = c.createGain()
  env.gain.setValueAtTime(0, at)
  env.gain.linearRampToValueAtTime(gain, at + 0.005)
  env.gain.setValueAtTime(gain, at + length - 0.02)
  env.gain.linearRampToValueAtTime(0, at + length)
  osc.connect(env).connect(master!)
  osc.start(at)
  osc.stop(at + length + 0.01)
}

/** A key going down. `heavy` for the panel's big keys. */
export function click(heavy = false) {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  burst(c, t, heavy ? 0.045 : 0.025, heavy ? 1800 : 3200, heavy ? 0.5 : 0.28)
  if (heavy) burst(c, t + 0.035, 0.03, 900, 0.25)
}

let lastLine = 0
/** One line of the dot-matrix head: a quick rasp of needle strikes. Throttled, so a fast feed doesn't smear. */
export function printLine() {
  const c = audio()
  if (!c || c.currentTime - lastLine < 0.07) return
  lastLine = c.currentTime
  const t = c.currentTime
  const strikes = 5 + Math.floor(Math.random() * 4)
  for (let i = 0; i < strikes; i++) burst(c, t + i * 0.008, 0.012, 2400 + Math.random() * 1200, 0.22, 4)
}

/** The terminal's beep. */
export function beep(freq = 880, length = 0.11) {
  const c = audio()
  if (!c) return
  tone(c, c.currentTime, freq, length, 0.09)
}

/** Done: two rising beeps. */
export function chime() {
  const c = audio()
  if (!c) return
  tone(c, c.currentTime, 660, 0.09, 0.08)
  tone(c, c.currentTime + 0.11, 990, 0.14, 0.08)
}

/** Refused: a low buzz. */
export function buzz() {
  const c = audio()
  if (!c) return
  tone(c, c.currentTime, 110, 0.16, 0.12, "sawtooth")
}

/** The faint mains hum of a machine that is switched on. */
function startHum() {
  const c = audio()
  if (!c || hum) return
  const env = c.createGain()
  env.gain.setValueAtTime(0, c.currentTime)
  env.gain.linearRampToValueAtTime(0.012, c.currentTime + 1.5)
  env.connect(master!)
  const oscs = [50, 100].map((f, i) => {
    const o = c.createOscillator()
    o.type = "sine"
    o.frequency.value = f
    const g = c.createGain()
    g.gain.value = i === 0 ? 1 : 0.35
    o.connect(g).connect(env)
    o.start()
    return o
  })
  hum = {
    stop: () => {
      const now = c.currentTime
      env.gain.cancelScheduledValues(now)
      env.gain.setValueAtTime(env.gain.value, now)
      env.gain.linearRampToValueAtTime(0, now + 0.3)
      oscs.forEach((o) => o.stop(now + 0.35))
    },
  }
}

function stopHum() {
  hum?.stop()
  hum = null
}
