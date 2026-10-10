// Turns raw image statistics (+ optional vision-model output) into the five frontend factors.
// Every factor returns { factor: {name, score, note, spots}, load } where:
//   score = 0..100, HIGHER = MORE bothersome (this is what the frontend's bars show)
//   load  = per-grid-cell 0..1 map, used later to find the calmest area of the photo
import { components, compToSpot, clampSpot, detectPatterns } from './imageStats.js'

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const round = (v) => Math.round(v)

/** Plain-language position of a % spot, e.g. "upper left". */
export function where(s) {
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2
  const h = cx < 33 ? 'left' : cx < 66 ? 'center' : 'right'
  const v = cy < 33 ? 'upper' : cy < 66 ? '' : 'lower'
  if (h === 'center' && !v) return 'center'
  if (h === 'center') return `${v} center`
  return v ? `${v} ${h}` : h
}

/** Find a vision-model label whose box overlaps the centre of one of our spots. */
function labelFor(spot, items) {
  if (!items?.length) return null
  const cx = spot.x + spot.w / 2, cy = spot.y + spot.h / 2
  const hit = items.find(({ spot: b }) => cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h)
  return hit?.label ? hit.label.toLowerCase() : null
}

const topSpots = (comps, stats, max, minCells = 1) =>
  comps
    .filter((c) => c.cells.length >= minCells)
    .sort((a, b) => b.cells.length - a.cells.length)
    .slice(0, max)
    .map((c) => compToSpot(c, stats))

// ---------------------------------------------------------------- Lighting
export function lightingFactor(stats, vision) {
  const { cells, cols, rows, global: g } = stats
  const mask = cells.map((c) => c.bright / c.n >= 0.3)
  const spots = topSpots(components(mask, cols, rows), stats, 4)

  const brightScore = 100 * (1 - Math.exp(-g.brightFrac * 25)) // 1% blown-out -> 22, 5% -> 71, 10% -> 92
  const dimScore = clamp((g.dimFrac - 0.3) * 150, 0, 60)
  const score = round(Math.max(brightScore, dimScore))

  let note
  if (brightScore >= dimScore && brightScore >= 20) {
    const top = spots.filter((s) => s.y + s.h / 2 < 35)
    const other = spots.filter((s) => s.y + s.h / 2 >= 35)
    const parts = []
    if (top.length) {
      const lbl = labelFor(top[0], vision?.lights) || 'light'
      parts.push(`${top.length === 1 ? 'a bright' : top.length + ' bright'} ${lbl}${top.length > 1 && !lbl.endsWith('s') ? 's' : ''} near the top`)
    }
    if (other.length) {
      const lbl = labelFor(other[0], vision?.lights) || 'window or reflection'
      parts.push(`a bright ${lbl} in the ${where(other[0])}`)
    }
    note = parts.length
      ? `${parts.join(' and ')} may feel harsh.`.replace(/^./, (c) => c.toUpperCase())
      : 'Large very bright areas in the photo may feel harsh.'
  } else if (dimScore >= 20) {
    note = 'Large dark areas may be tiring to look at.'
  } else {
    note = 'Lighting looks soft and even.'
  }

  const load = new Float32Array(cells.length)
  cells.forEach((c, i) => {
    load[i] = clamp((c.bright / c.n) * 2.5 + (c.sumL / c.n < 30 ? 0.5 : 0), 0, 1)
  })
  return { factor: { name: 'Lighting', score, note, spots: score >= 20 ? spots : [] }, load }
}

// ---------------------------------------------------------------- Clutter
export function clutterFactor(stats, vision) {
  const { cells, cols, rows, global: g } = stats
  const busy = cells.map((c) => c.edge / c.n >= 0.25)
  const busyFrac = busy.filter(Boolean).length / cells.length
  const local = 100 * (0.6 * Math.min(1, g.edgeFrac / 0.2) + 0.4 * Math.min(1, busyFrac / 0.4))

  const n = vision?.objectCount
  const score = round(n != null ? 0.5 * local + 0.5 * Math.min(100, n * 5) : local)

  let note =
    score < 30 ? 'The scene looks clean and uncluttered.' : score < 60 ? 'Some objects and details add visual busyness.' : 'Lots of small details compete for attention.'
  if (n != null && n > 0 && score >= 30) note = `About ${n} objects and many small details compete for attention.`

  const spots = score >= 30 ? topSpots(components(busy, cols, rows), stats, 2, 3) : []
  const load = new Float32Array(cells.length)
  cells.forEach((c, i) => (load[i] = clamp(c.edge / c.n / 0.3, 0, 1)))
  return { factor: { name: 'Clutter', score, note, spots }, load }
}

// ---------------------------------------------------------------- Crowds (needs vision model)
export function crowdsFactor(stats, vision) {
  const { cells, cols, cell, w, h } = stats
  const people = vision.people
  const n = people.length
  const areaFrac = clamp(people.reduce((a, p) => a + (p.w * p.h) / 10000, 0), 0, 1)
  const score = n === 0 ? 0 : round(clamp(n * 8 + areaFrac * 50, 0, 100))
  const note =
    n === 0 ? 'No people are visible.' : n === 1 ? 'One person is visible.' : n <= 3 ? `${n} people are visible.` : n <= 7 ? `${n} people are visible across the room.` : `${n} people are visible, so it may feel crowded.`

  // per-cell load = fraction of the cell covered by any person box
  const load = new Float32Array(cells.length)
  cells.forEach((c, i) => {
    const cx0 = ((i % cols) * cell) / w * 100, cy0 = (Math.floor(i / cols) * cell) / h * 100
    const cw = (cell / w) * 100, ch = (cell / h) * 100
    let cover = 0
    for (const p of people) {
      const ox = Math.max(0, Math.min(cx0 + cw, p.x + p.w) - Math.max(cx0, p.x))
      const oy = Math.max(0, Math.min(cy0 + ch, p.y + p.h) - Math.max(cy0, p.y))
      cover += (ox * oy) / (cw * ch)
    }
    load[i] = clamp(cover, 0, 1)
  })
  return { factor: { name: 'Crowds', score, note, spots: people.slice(0, 8).map(clampSpot) }, load }
}

// ---------------------------------------------------------------- Patterns
export function patternsFactor(stats, vision) {
  const { w, h, cell, cols, rows, cells } = stats
  const blocks = detectPatterns(stats)
  const bcols = Math.floor((w - 64) / 32) + 1
  const hit = blocks.map((b) => b.strength >= 0.3)
  const hitCount = hit.filter(Boolean).length
  const f = blocks.length ? hitCount / blocks.length : 0
  const avgStrength = hitCount ? blocks.filter((b, i) => hit[i]).reduce((a, b) => a + b.strength, 0) / hitCount : 0
  const score = round(100 * (1 - Math.exp(-f * 8)) * (0.6 + 0.4 * avgStrength))

  const spots = components(hit, bcols, Math.max(1, blocks.length / bcols))
    .filter((c) => c.cells.length >= 2)
    .sort((a, b) => b.cells.length - a.cells.length)
    .slice(0, 3)
    .map((c) => clampSpot({ x: ((c.minC * 32) / w) * 100, y: ((c.minR * 32) / h) * 100, w: (((c.maxC - c.minC) * 32 + 64) / w) * 100, h: (((c.maxR - c.minR) * 32 + 64) / h) * 100 }))

  let note
  if (score < 25 || !spots.length) note = 'No strong repeating patterns found.'
  else {
    const lbl = labelFor(spots[0], vision?.patterns)
    note = `${lbl ? `The ${lbl}` : `Repeating lines or shapes in the ${where(spots[0])}`} may be visually demanding.`
    if (lbl === null && spots.length > 1) note = `Repeating lines or shapes in ${spots.length} areas may be visually demanding.`
  }

  const load = new Float32Array(cells.length)
  blocks.forEach((b, i) => {
    if (!hit[i]) return
    for (let r = Math.floor(b.y / cell); r <= Math.min(rows - 1, Math.floor((b.y + b.size - 1) / cell)); r++)
      for (let c = Math.floor(b.x / cell); c <= Math.min(cols - 1, Math.floor((b.x + b.size - 1) / cell)); c++)
        load[r * cols + c] = Math.max(load[r * cols + c], b.strength)
  })
  return { factor: { name: 'Patterns', score, note, spots: score >= 25 ? spots : [] }, load }
}

// ---------------------------------------------------------------- Color
export function colorFactor(stats) {
  const { cells, cols, rows, global: g } = stats
  const score = round(100 * (0.6 * Math.min(1, g.satFrac / 0.25) + 0.4 * Math.min(1, g.hiEdgeFrac / 0.06)))
  const note =
    score < 30 ? 'Colors are mostly muted and low contrast.' : score < 60 ? 'Some strong colors or sharp contrast are present.' : 'Very bright or high-contrast colors may feel loud.'
  const mask = cells.map((c) => c.sat / c.n >= 0.5)
  const spots = score >= 30 ? topSpots(components(mask, cols, rows), stats, 2) : []
  const load = new Float32Array(cells.length)
  cells.forEach((c, i) => (load[i] = clamp(c.sat / c.n / 0.5, 0, 1)))
  return { factor: { name: 'Color', score, note, spots }, load }
}
