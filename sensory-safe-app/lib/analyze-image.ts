export type Spot = { x: number; y: number; w: number; h: number }

export type AnalysisResult = {
  calmScore: number
  label: 'Calm' | 'Okay' | 'Tough'
  summary: string
  factors: { name: string; score: number; note: string; spots: Spot[] }[]
  calmestArea: Spot & { note: string }
  quickFixes: string[]
}

export async function analyzeImage(_file: File): Promise<AnalysisResult> {
  await new Promise((resolve) => setTimeout(resolve, 900))
  return {
    calmScore: 38,
    label: 'Tough',
    summary: 'This room may feel busy because of bright overhead lights and the number of people nearby.',
    factors: [
      { name: 'Lighting', score: 76, note: 'Three bright ceiling panels may create harsh light.', spots: [{ x: 16, y: 10, w: 14, h: 16 }, { x: 42, y: 8, w: 15, h: 17 }, { x: 68, y: 9, w: 14, h: 17 }] },
      { name: 'Clutter', score: 42, note: 'Tables and chairs create some visual busyness.', spots: [{ x: 50, y: 55, w: 31, h: 25 }] },
      { name: 'Crowds', score: 69, note: 'Several people are visible across the seating area.', spots: [{ x: 18, y: 43, w: 19, h: 32 }, { x: 54, y: 37, w: 18, h: 35 }] },
      { name: 'Patterns', score: 58, note: 'The striped wall may be visually demanding.', spots: [{ x: 77, y: 21, w: 19, h: 36 }] },
      { name: 'Color', score: 24, note: 'Colors are mostly muted and low contrast.', spots: [] },
    ],
    calmestArea: { x: 2, y: 32, w: 24, h: 54, note: 'Left corner by the window' },
    quickFixes: ['Choose the left corner by the window.', 'Turn your seat away from the striped wall.', 'Try a brimmed hat or tinted glasses for the ceiling lights.'],
  }
}

export const mockFile = new File([], 'cafe-room.jpg', { type: 'image/jpeg' })

export const sampleAnalysis: AnalysisResult = {
  calmScore: 38,
  label: 'Tough',
  summary: 'This room may feel busy because of bright overhead lights and the number of people nearby.',
  factors: [
    { name: 'Lighting', score: 76, note: 'Three bright ceiling panels may create harsh light.', spots: [{ x: 16, y: 10, w: 14, h: 16 }, { x: 42, y: 8, w: 15, h: 17 }, { x: 68, y: 9, w: 14, h: 17 }] },
    { name: 'Clutter', score: 42, note: 'Tables and chairs create some visual busyness.', spots: [{ x: 50, y: 55, w: 31, h: 25 }] },
    { name: 'Crowds', score: 69, note: 'Several people are visible across the seating area.', spots: [{ x: 18, y: 43, w: 19, h: 32 }, { x: 54, y: 37, w: 18, h: 35 }] },
    { name: 'Patterns', score: 58, note: 'The striped wall may be visually demanding.', spots: [{ x: 77, y: 21, w: 19, h: 36 }] },
    { name: 'Color', score: 24, note: 'Colors are mostly muted and low contrast.', spots: [] },
  ],
  calmestArea: { x: 2, y: 32, w: 24, h: 54, note: 'Left corner by the window' },
  quickFixes: ['Choose the left corner by the window.', 'Turn your seat away from the striped wall.', 'Try a brimmed hat or tinted glasses for the ceiling lights.'],
}
