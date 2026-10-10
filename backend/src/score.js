// Personalisation, Calm Score, calmest-area search, summary and quick fixes.
import { where } from './factors.js'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Order matches the checkboxes on the frontend's "Choose what to check" screen.
export const TRIGGER_KEYS = ['light', 'glare', 'clutter', 'crowds', 'patterns', 'color']
const SENSITIVITY = { low: 0.8, medium: 1, high: 1.25 }

/** Accepts a JSON array, a comma list, or an array. Unknown values are ignored. */
export function parseTriggers(raw) {
  let list = raw
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw) } catch { list = raw.split(',') }
  }
  if (!Array.isArray(list)) return new Set()
  return new Set(list.map((t) => String(t).trim().toLowerCase()).filter((t) => TRIGGER_KEYS.includes(t)))
}

export const parseSensitivity = (raw) => (SENSITIVITY[String(raw || '').toLowerCase()] ? String(raw).toLowerCase() : 'medium')

/** Selected triggers count 3x; the rest 0.6x. With nothing selected, everything counts equally. */
export function weightsFor(triggers) {
  const none = triggers.size === 0
  const w = (...keys) => (none ? 1 : keys.some((k) => triggers.has(k)) ? 3 : 0.6)
  return { Lighting: w('light', 'glare'), Clutter: w('clutter'), Crowds: w('crowds'), Patterns: w('patterns'), Color: w('color') }
}

export function calmScore(factors, weights, sensitivity) {
  const sum = factors.reduce((a, f) => a + weights[f.name], 0)
  const avg = factors.reduce((a, f) => a + weights[f.name] * f.score, 0) / sum
  // One very bad trigger should sink the score even if the rest are fine.
  const peak = Math.max(...factors.map((f) => f.score * (weights[f.name] >= 2 || sum === factors.length ? 1 : 0.4)))
  const load = (0.5 * avg + 0.5 * peak) * SENSITIVITY[sensitivity]
  const score = Math.round(clamp(100 - load, 0, 100))
  return { score, label: score >= 67 ? 'Calm' : score >= 40 ? 'Okay' : 'Tough' }
}

/** Slide a window over the weighted per-cell load map and pick the quietest one. */
export function findCalmestArea(stats, results, weights) {
  const { cols, rows, cell, w, h, cells } = stats
  const wSum = results.reduce((a, r) => a + weights[r.factor.name], 0)
  const load = new Float32Array(cells.length)
  for (const r of results) for (let i = 0; i < load.length; i++) load[i] += (weights[r.factor.name] * r.load[i]) / wSum

  const wc = Math.max(2, Math.round(cols * 0.28))
  const hr = Math.max(2, Math.round(rows * 0.45))
  let best = { avg: Infinity, c: 0, r: 0 }
  for (let r = 0; r + hr <= rows; r++) {
    for (let c = 0; c + wc <= cols; c++) {
      let s = 0
      for (let rr = r; rr < r + hr; rr++) for (let cc = c; cc < c + wc; cc++) s += load[rr * cols + cc]
      const avg = s / (wc * hr)
      if (avg < best.avg) best = { avg, c, r }
    }
  }
  const globalAvg = load.reduce((a, v) => a + v, 0) / load.length
  const x0 = best.c * cell, y0 = best.r * cell
  const spot = {
    x: Math.round(((x0 / w) * 100) * 10) / 10,
    y: Math.round(((y0 / h) * 100) * 10) / 10,
    w: Math.round((Math.min(w - x0, wc * cell) / w) * 1000) / 10,
    h: Math.round((Math.min(h - y0, hr * cell) / h) * 1000) / 10,
  }
  const pos = where(spot)
  const meaningful = globalAvg > 0.05 && best.avg < globalAvg * 0.8
  const note = meaningful
    ? `${pos === 'center' ? 'Center' : pos[0].toUpperCase() + pos.slice(1)} of the photo looks calmest`
    : globalAvg <= 0.05
      ? 'The whole room looks calm, so any spot should be fine'
      : `No clearly calmer spot, but the ${pos} is slightly quieter`
  return { spot: { ...spot, note }, meaningful, pos }
}

const PHRASE = {
  Lighting: () => 'bright lights',
  Clutter: () => 'visual clutter',
  Crowds: (f) => (f.people ? `${f.people} people nearby` : 'people nearby'),
  Patterns: () => 'repeating patterns',
  Color: () => 'strong colors',
}

export function buildSummary(factors, weights, label, peopleCount) {
  const ranked = factors
    .map((f) => ({ f, impact: weights[f.name] * f.score }))
    .filter((x) => x.f.score >= 40)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 2)
  if (!ranked.length) return label === 'Calm' ? 'This room looks fairly calm for the things you chose to check.' : 'Nothing stands out strongly, but several small things add up.'
  const phrases = ranked.map(({ f }) => PHRASE[f.name]({ ...f, people: f.name === 'Crowds' ? peopleCount : 0 }))
  return `This room may feel busy because of ${phrases.join(' and ')}.`
}

export function buildFixes(factors, weights, area) {
  const fixes = []
  if (area.meaningful) fixes.push(`Choose the ${area.pos} of the room.`)
  const byImpact = [...factors].filter((f) => f.score >= 40).sort((a, b) => weights[b.name] * b.score - weights[a.name] * a.score)
  for (const f of byImpact) {
    const s = f.spots[0]
    if (f.name === 'Lighting') fixes.push('Sit away from the bright lights, or try a brimmed hat or tinted glasses.')
    else if (f.name === 'Patterns') fixes.push(s ? `Turn your seat away from the patterned area in the ${where(s)}.` : 'Turn your seat away from patterned surfaces.')
    else if (f.name === 'Crowds') fixes.push('Visit at a quieter time, or sit near an edge so fewer people are behind you.')
    else if (f.name === 'Clutter') fixes.push('Face a plain wall so fewer things compete for your attention.')
    else if (f.name === 'Color') fixes.push(s ? `Avoid facing the brightly colored area in the ${where(s)}.` : 'Avoid facing very bright or high-contrast colors.')
  }
  if (!fixes.length) fixes.push('No changes needed. This room looks fine for your triggers.')
  return fixes.slice(0, 3)
}
