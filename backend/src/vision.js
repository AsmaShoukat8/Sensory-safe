// Optional vision-model step (Google Gemini via plain fetch, so no extra SDK).
// It supplies what pixel math can't: counting people, counting objects, and naming things.
// If GEMINI_API_KEY is missing or the call fails, analysis continues without it.
import sharp from 'sharp'

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const TIMEOUT_MS = Number(process.env.VISION_TIMEOUT_MS || 15000)

const PROMPT = `You are analyzing a photo of a room for a sensory-accessibility tool.
Return JSON only. Boxes use box_2d = [ymin, xmin, ymax, xmax], each 0-1000 relative to the image.
- people: every visible person (full or partial).
- object_count: rough number of distinct objects competing for attention (furniture, decor, posters, items on shelves/tables). Integer.
- light_sources: bright ceiling panels, lamps, bright windows, and strong glare/reflections. label = short name.
- patterns: stripes, checkerboards, busy wallpaper/prints/carpets. label = short name (e.g. "striped wall").
Be conservative: only include things clearly visible.`

const boxSchema = { type: 'ARRAY', items: { type: 'INTEGER' } }
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    people: { type: 'ARRAY', items: { type: 'OBJECT', properties: { box_2d: boxSchema }, required: ['box_2d'] } },
    object_count: { type: 'INTEGER' },
    light_sources: { type: 'ARRAY', items: { type: 'OBJECT', properties: { label: { type: 'STRING' }, box_2d: boxSchema }, required: ['label', 'box_2d'] } },
    patterns: { type: 'ARRAY', items: { type: 'OBJECT', properties: { label: { type: 'STRING' }, box_2d: boxSchema }, required: ['label', 'box_2d'] } },
  },
  required: ['people', 'object_count', 'light_sources', 'patterns'],
}

export const visionEnabled = () => Boolean(process.env.GEMINI_API_KEY)

/** [ymin,xmin,ymax,xmax] (0-1000) -> {x,y,w,h} in %. Returns null if malformed. */
function toSpot(box) {
  if (!Array.isArray(box) || box.length !== 4 || box.some((v) => !Number.isFinite(v))) return null
  const [y0, x0, y1, x1] = box.map((v) => Math.min(1000, Math.max(0, v)))
  if (y1 <= y0 || x1 <= x0) return null
  return { x: x0 / 10, y: y0 / 10, w: (x1 - x0) / 10, h: (y1 - y0) / 10 }
}

/** Returns { people, objectCount, lights, patterns } or throws. */
export async function runVision(buffer) {
  const jpeg = await sharp(buffer, { failOn: 'none' })
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer()

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: jpeg.toString('base64') } }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.1 },
      }),
    })
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
    const body = await res.json()
    const text = body?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('Gemini returned no content')
    const j = JSON.parse(text)
    const labelled = (arr) =>
      (Array.isArray(arr) ? arr : []).map((o) => ({ label: String(o.label || '').slice(0, 40), spot: toSpot(o.box_2d) })).filter((o) => o.spot)
    return {
      people: (Array.isArray(j.people) ? j.people : []).map((p) => toSpot(p.box_2d)).filter(Boolean),
      objectCount: Number.isFinite(j.object_count) ? Math.max(0, Math.min(200, j.object_count)) : null,
      lights: labelled(j.light_sources),
      patterns: labelled(j.patterns),
    }
  } finally {
    clearTimeout(timer)
  }
}
