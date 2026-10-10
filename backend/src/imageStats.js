// Low-level image processing: decode, per-cell statistics, repeating-pattern detection.
// Everything here is plain pixel math (no ML), so it runs offline and fast.
import sharp from 'sharp'

const MAX_SIDE = 480 // analysis resolution; keeps things fast on 12MP phone photos
const BRIGHT = 240 // luminance counted as "blown out"
const EDGE = 28 // gradient magnitude counted as an edge (ignores fine texture like grain and JPEG noise)
const HI_EDGE = 45 // gradient magnitude counted as a harsh edge (black next to white, etc.)
const PATTERN_BLOCK = 64
const PATTERN_STRIDE = 32

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export async function loadImage(buffer) {
  try {
    const { data, info } = await sharp(buffer, { failOn: 'none', limitInputPixels: 100e6 })
      .rotate() // apply EXIF orientation so our % coordinates match what the browser shows
      .flatten({ background: '#ffffff' })
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .toColourspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true })
    return { data, w: info.width, h: info.height }
  } catch {
    throw new HttpError(415, 'That file could not be read as an image.')
  }
}

export function computeStats({ data, w, h }) {
  if (w < 96 || h < 96) throw new HttpError(422, 'That photo is too small to analyze. Try a larger one.')

  const n = w * h
  const L = new Float32Array(n)
  const S = new Float32Array(n)
  const V = new Float32Array(n)
  for (let i = 0, p = 0; i < n; i++, p += 3) {
    const r = data[p], g = data[p + 1], b = data[p + 2]
    L[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    V[i] = mx / 255
    S[i] = mx === 0 ? 0 : (mx - mn) / mx
  }

  const cell = Math.max(8, Math.round(w / 16))
  const cols = Math.ceil(w / cell)
  const rows = Math.ceil(h / cell)
  const cells = Array.from({ length: cols * rows }, () => ({ n: 0, sumL: 0, bright: 0, edge: 0, sat: 0 }))

  let sumL = 0, sumL2 = 0, bright = 0, dim = 0, edge = 0, hiEdge = 0, sat = 0, interior = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const l = L[i]
      const c = cells[Math.floor(y / cell) * cols + Math.floor(x / cell)]
      c.n++
      c.sumL += l
      sumL += l
      sumL2 += l * l
      if (l >= BRIGHT) { c.bright++; bright++ }
      if (l < 35) dim++
      if (S[i] > 0.65 && V[i] > 0.5) { c.sat++; sat++ }
      if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
        interior++
        const gx = (L[i + 1] - L[i - 1]) / 2
        const gy = (L[i + w] - L[i - w]) / 2
        const g = Math.hypot(gx, gy)
        if (g > EDGE) { c.edge++; edge++ }
        if (g > HI_EDGE) hiEdge++
      }
    }
  }

  const meanL = sumL / n
  return {
    w, h, cell, cols, rows, cells, L,
    global: {
      meanL,
      stdL: Math.sqrt(Math.max(0, sumL2 / n - meanL * meanL)),
      brightFrac: bright / n,
      dimFrac: dim / n,
      edgeFrac: edge / interior,
      hiEdgeFrac: hiEdge / interior,
      satFrac: sat / n,
    },
  }
}

// ---------- geometry helpers ----------

/** Connected components (4-neighbour) over a cols*rows boolean mask. */
export function components(mask, cols, rows) {
  const seen = new Uint8Array(mask.length)
  const out = []
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue
    const stack = [start]
    seen[start] = 1
    const comp = { cells: [], minC: cols, maxC: 0, minR: rows, maxR: 0 }
    while (stack.length) {
      const idx = stack.pop()
      const c = idx % cols, r = Math.floor(idx / cols)
      comp.cells.push(idx)
      comp.minC = Math.min(comp.minC, c); comp.maxC = Math.max(comp.maxC, c)
      comp.minR = Math.min(comp.minR, r); comp.maxR = Math.max(comp.maxR, r)
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
        const ni = nr * cols + nc
        if (mask[ni] && !seen[ni]) { seen[ni] = 1; stack.push(ni) }
      }
    }
    out.push(comp)
  }
  return out
}

const round1 = (v) => Math.round(v * 10) / 10
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

/** Cell-grid bounding box -> % spot of the full image. */
export function compToSpot(comp, stats) {
  const { cell, w, h } = stats
  const x0 = comp.minC * cell, x1 = Math.min(w, (comp.maxC + 1) * cell)
  const y0 = comp.minR * cell, y1 = Math.min(h, (comp.maxR + 1) * cell)
  return { x: round1((x0 / w) * 100), y: round1((y0 / h) * 100), w: round1(((x1 - x0) / w) * 100), h: round1(((y1 - y0) / h) * 100) }
}

export function clampSpot(s) {
  const x = clamp(s.x, 0, 100), y = clamp(s.y, 0, 100)
  return { x: round1(x), y: round1(y), w: round1(clamp(s.w, 0, 100 - x)), h: round1(clamp(s.h, 0, 100 - y)) }
}

// ---------- repeating pattern detection ----------

/**
 * Average normalised autocorrelation of 1-D luminance lines (rows or columns) inside a block.
 * Stripes, checks and dense repeating prints make lines oscillate with a steady period, so the
 * autocorrelation dips below zero and then peaks again. Plain walls and smooth gradients don't.
 * Returns { periodicity: 0..1, contrast: avg std-dev of the lines }.
 */
function lineAutocorr(L, w, x0, y0, size, vertical) {
  const maxLag = size >> 1
  const acc = new Float32Array(maxLag + 1)
  let used = 0, stdSum = 0
  const p = new Float32Array(size)
  for (let k = 0; k < size; k++) {
    let mean = 0
    for (let i = 0; i < size; i++) {
      const v = vertical ? L[(y0 + i) * w + x0 + k] : L[(y0 + k) * w + x0 + i]
      p[i] = v
      mean += v
    }
    mean /= size
    let energy = 0
    for (let i = 0; i < size; i++) { p[i] -= mean; energy += p[i] * p[i] }
    const std = Math.sqrt(energy / size)
    if (std < 10) continue // flat line, no signal
    used++
    stdSum += std
    for (let lag = 3; lag <= maxLag; lag++) {
      let s = 0
      for (let i = 0; i + lag < size; i++) s += p[i] * p[i + lag]
      acc[lag] += (s / (size - lag)) / (energy / size)
    }
  }
  if (used < size * 0.5) return { periodicity: 0, contrast: 0 }
  let crossed = false, peak = 0
  for (let lag = 3; lag <= maxLag; lag++) {
    const r = acc[lag] / used
    if (r < 0) crossed = true
    else if (crossed && r > peak) peak = r
  }
  return { periodicity: peak, contrast: stdSum / used }
}

/** Slide a block across the image; return blocks whose content repeats strongly. */
export function detectPatterns({ L, w, h }) {
  const blocks = []
  for (let y = 0; y + PATTERN_BLOCK <= h; y += PATTERN_STRIDE) {
    for (let x = 0; x + PATTERN_BLOCK <= w; x += PATTERN_STRIDE) {
      const a = lineAutocorr(L, w, x, y, PATTERN_BLOCK, false)
      const b = lineAutocorr(L, w, x, y, PATTERN_BLOCK, true)
      const best = a.periodicity >= b.periodicity ? a : b
      const strength = best.periodicity * Math.min(1, best.contrast / 25)
      blocks.push({ x, y, size: PATTERN_BLOCK, strength })
    }
  }
  return blocks
}
