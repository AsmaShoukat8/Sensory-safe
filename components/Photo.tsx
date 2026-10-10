import type { AnalysisResult } from '@/lib/analyze-image'

type PhotoProps = {
  src: string
  // Static labels for the home page demo photo.
  overlay?: boolean
  // Labels placed from a real analysis result.
  analysis?: AnalysisResult
}

export function Photo({ src, overlay = false, analysis }: PhotoProps) {
  return (
    <div className="photo-wrap">
      <img src={src} alt="The room photo selected for this scan" />
      {overlay && (
        <>
          <span className="spot light">Harsh light: ceiling panels</span>
          <span className="spot pattern">Busy pattern: striped wall</span>
          <span className="spot crowd">Crowd: seating area</span>
          <span className="calm-area">Calmest area: left corner</span>
        </>
      )}
      {analysis && (
        <>
          {analysis.factors
            .filter((f) => f.score > 50 && f.spots.length > 0)
            .map((f) => (
              <span
                key={f.name}
                className="spot"
                style={{ left: `${f.spots[0].x}%`, top: `${f.spots[0].y}%` }}
              >
                {f.name}: {f.note}
              </span>
            ))}
          <span
            className="calm-area"
            style={{ left: `${analysis.calmestArea.x}%`, top: `${analysis.calmestArea.y}%`, bottom: 'auto' }}
          >
            Calmest area: {analysis.calmestArea.note}
          </span>
        </>
      )}
    </div>
  )
}
