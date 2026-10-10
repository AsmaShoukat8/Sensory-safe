// Orchestrator: buffer in -> AnalysisResult (the exact shape lib/analyze-image.ts expects) out.
import { loadImage, computeStats } from './imageStats.js'
import { lightingFactor, clutterFactor, crowdsFactor, patternsFactor, colorFactor } from './factors.js'
import { calmScore, findCalmestArea, buildSummary, buildFixes, weightsFor } from './score.js'
import { runVision, visionEnabled } from './vision.js'

export async function analyzeBuffer(buffer, { triggers = new Set(), sensitivity = 'medium' } = {}) {
  const warnings = []

  // Pixel analysis and the (optional) vision model run in parallel.
  const visionPromise = visionEnabled()
    ? runVision(buffer).catch((err) => {
        console.warn('[vision] failed, continuing without it:', err.message)
        warnings.push('The vision model was unavailable, so people were not counted.')
        return null
      })
    : Promise.resolve(null)

  const img = await loadImage(buffer)
  const stats = computeStats(img)
  const vision = await visionPromise
  if (!visionEnabled()) warnings.push('People counting is off. Set GEMINI_API_KEY to turn on the Crowds check.')

  const results = [lightingFactor(stats, vision), clutterFactor(stats, vision)]
  if (vision) results.push(crowdsFactor(stats, vision))
  results.push(patternsFactor(stats, vision), colorFactor(stats))

  const factors = results.map((r) => r.factor)
  const weights = weightsFor(triggers)
  const { score, label } = calmScore(factors, weights, sensitivity)
  const area = findCalmestArea(stats, results, weights)

  return {
    calmScore: score,
    label,
    summary: buildSummary(factors, weights, label, vision?.people.length ?? 0),
    factors,
    calmestArea: area.spot,
    quickFixes: buildFixes(factors, weights, area),
    // Extra, ignored by the current frontend:
    meta: {
      mode: vision ? 'pixels+vision' : 'pixels-only',
      warnings,
      disclaimer: 'The Calm Score is an aid, not a medical tool. A single photo cannot show flicker, sound or smell.',
    },
  }
}
