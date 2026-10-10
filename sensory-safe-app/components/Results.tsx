import { Back } from '@/components/Back'
import { Photo } from '@/components/Photo'
import type { AnalysisResult } from '@/lib/analyze-image'
import type { View } from '@/lib/types'

type ResultsProps = {
  setView: (v: View) => void
  photoSrc: string
  analysis: AnalysisResult
  onSave: () => void
  saveMessage: string
  savedId: string | null
}

export function Results({ setView, photoSrc, analysis, onSave, saveMessage, savedId }: ResultsProps) {
  return (
    <main className="container">
      <Back setView={setView} />
      <section className="results-top">
        <div>
          <h1>Your room scan</h1>
          <p>Summary: {analysis.summary}</p>
        </div>
        <button className="secondary" onClick={() => setView('scan')}>
          Choose a different photo
        </button>
      </section>
      <section className="results-grid">
        <div>
          <Photo analysis={analysis} src={photoSrc} />
        </div>
        <div className="score-panel">
          <div className="gauge">
            <strong>{analysis.calmScore}</strong>
            <span>out of 100</span>
          </div>
          <h2>{analysis.label} room</h2>
          {analysis.factors.map((f) => (
            <details key={f.name}>
              <summary>
                <span>{f.name}</span>
                <b>{f.score}</b>
              </summary>
              <div className="bar">
                <i style={{ width: `${f.score}%` }} />
              </div>
              <small>{f.note}</small>
            </details>
          ))}
        </div>
      </section>
      <section className="bottom-cards">
        <article>
          <h3>Calmest area</h3>
          <p>{analysis.calmestArea.note}</p>
        </article>
        <article>
          <h3>Quick fixes</h3>
          <ul>
            {analysis.quickFixes.map((fix) => (
              <li key={fix}>{fix}</li>
            ))}
          </ul>
        </article>
      </section>
      <div className="button-row">
        <button className="primary" onClick={onSave} disabled={Boolean(savedId)}>
          Save this scan
        </button>
        <button className="secondary" onClick={() => setView('history')}>
          View history
        </button>
      </div>
      {saveMessage && (
        <p role="status" className="save-message">
          {saveMessage}
        </p>
      )}
      <p className="button-help">Your scan will stay on this device.</p>
    </main>
  )
}
