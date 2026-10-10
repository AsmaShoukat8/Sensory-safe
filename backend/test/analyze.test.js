import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { analyzeBuffer } from '../src/analyze.js'
import { createApp } from '../src/server.js'

const W = 640, H = 480
const png = (svg) => sharp(Buffer.from(svg)).png().toBuffer()
const svg = (body, bg = '#b9b4ab') => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`
const factor = (r, name) => r.factors.find((f) => f.name === name)

let plain, stripes, panels, neon
before(async () => {
  plain = await png(svg(''))
  const bars = Array.from({ length: 16 }, (_, i) => `<rect x="${400 + i * 15}" y="60" width="7" height="360" fill="#222"/>`).join('')
  stripes = await png(svg(bars))
  const lights = [60, 250, 440].map((x) => `<rect x="${x}" y="15" width="130" height="50" fill="#fff"/>`).join('')
  panels = await png(svg(lights, '#6b665e'))
  neon = await png(svg('', '#ff1a1a'))
})

test('plain wall scores calm', async () => {
  const r = await analyzeBuffer(plain)
  assert.equal(r.label, 'Calm')
  assert.ok(r.calmScore >= 80, `score ${r.calmScore}`)
  assert.equal(r.factors.length, 4) // no Crowds factor without a vision model
})

test('striped wall is detected on the right side', async () => {
  const r = await analyzeBuffer(stripes)
  const p = factor(r, 'Patterns')
  assert.ok(p.score >= 40, `pattern score ${p.score}`)
  assert.ok(p.spots.length >= 1)
  assert.ok(p.spots[0].x > 50, `spot x ${p.spots[0].x}`)
  assert.equal(factor(await analyzeBuffer(plain), 'Patterns').score, 0)
})

test('bright ceiling panels are found near the top', async () => {
  const r = await analyzeBuffer(panels, { triggers: new Set(['light']) })
  const l = factor(r, 'Lighting')
  assert.ok(l.score >= 40, `lighting score ${l.score}`)
  assert.ok(l.spots.length >= 2)
  assert.ok(l.spots.every((s) => s.y < 30))
  assert.match(l.note, /near the top/)
})

test('saturated color is flagged', async () => {
  const r = await analyzeBuffer(neon)
  assert.ok(factor(r, 'Color').score >= 60)
})

test('same room scores differently per profile', async () => {
  const lightSensitive = await analyzeBuffer(panels, { triggers: new Set(['light', 'glare']) })
  const patternSensitive = await analyzeBuffer(panels, { triggers: new Set(['patterns']) })
  assert.ok(lightSensitive.calmScore < patternSensitive.calmScore, `${lightSensitive.calmScore} vs ${patternSensitive.calmScore}`)
})

test('sensitivity lowers the score', async () => {
  const lo = await analyzeBuffer(panels, { sensitivity: 'low' })
  const hi = await analyzeBuffer(panels, { sensitivity: 'high' })
  assert.ok(hi.calmScore < lo.calmScore)
})

test('response matches the frontend AnalysisResult contract', async () => {
  const sample = await readFile(new URL('../../public/cafe-room.png', import.meta.url))
  const r = await analyzeBuffer(sample, { triggers: new Set(['light', 'glare']) })
  console.log(JSON.stringify(r, null, 1))
  assert.ok(Number.isInteger(r.calmScore) && r.calmScore >= 0 && r.calmScore <= 100)
  assert.ok(['Calm', 'Okay', 'Tough'].includes(r.label))
  assert.equal(typeof r.summary, 'string')
  assert.ok(Array.isArray(r.quickFixes) && r.quickFixes.length >= 1 && r.quickFixes.length <= 3)
  for (const f of r.factors) {
    assert.ok(f.score >= 0 && f.score <= 100 && typeof f.note === 'string')
    for (const s of f.spots) for (const k of ['x', 'y', 'w', 'h']) assert.ok(Number.isFinite(s[k]) && s[k] >= 0 && s[k] <= 100)
  }
  const a = r.calmestArea
  for (const k of ['x', 'y', 'w', 'h']) assert.ok(a[k] >= 0 && a[k] <= 100)
  assert.ok(a.x + a.w <= 100.1 && a.y + a.h <= 100.1)
  assert.equal(typeof a.note, 'string')
})

// ---- HTTP layer
let server, base
before(async () => {
  server = createApp().listen(0)
  base = `http://localhost:${server.address().port}`
})
after(() => server.close())

const post = (buf, type = 'image/png', extra = {}) => {
  const fd = new FormData()
  if (buf) fd.append('image', new Blob([buf], { type }), 'room.png')
  for (const [k, v] of Object.entries(extra)) fd.append(k, v)
  return fetch(`${base}/api/analyze`, { method: 'POST', body: fd })
}

test('HTTP: analyze works end to end', async () => {
  const res = await post(stripes, 'image/png', { triggers: JSON.stringify(['patterns']), sensitivity: 'high' })
  assert.equal(res.status, 200)
  const j = await res.json()
  assert.ok(j.calmScore < 80)
})

test('HTTP: errors are clean JSON', async () => {
  assert.equal((await post(null)).status, 400)
  assert.equal((await post(Buffer.from('not an image'), 'text/plain')).status, 415)
  assert.equal((await post(Buffer.from('not an image'), 'image/png')).status, 415)
  const tiny = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#888' } }).png().toBuffer()
  assert.equal((await post(tiny)).status, 422)
  const health = await (await fetch(`${base}/api/health`)).json()
  assert.equal(health.ok, true)
})
