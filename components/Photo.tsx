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
    <div className={'photo-wrap' + (analysis ? ' natural' : '')}>
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
                style={{ left: `${Math.min(f.spots[0].x, 40)}%`, top: `${Math.min(f.spots[0].y, 84)}%` }}
              >
                {f.name}: {f.note}
              </span>
            ))}
          <span
            className="calm-area"
            style={{ left: `${Math.min(analysis.calmestArea.x, 40)}%`, top: `${Math.min(analysis.calmestArea.y, 84)}%`, bottom: 'auto' }}
          >
            Calmest area: {analysis.calmestArea.note}
          </span>
        </>
      )}
    </div>
  )
}
