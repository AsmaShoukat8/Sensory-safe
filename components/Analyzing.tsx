import { useEffect, useState } from 'react'
import { Photo } from '@/components/Photo'

const STEPS = [
  'Reading your photo',
  'Checking lights and glare',
  'Looking for patterns and clutter',
  'Checking for people',
  'Working out your score',
]

export function Analyzing({ photoSrc, onCancel }: { photoSrc: string; onCancel: () => void }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const step = STEPS[Math.min(Math.floor(seconds / 7), STEPS.length - 1)]

  return (
    <main className="narrow analyzing" aria-busy="true">
      <h1>Checking your photo</h1>
      <div className="wait-card" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <div>
          <p className="wait-step">{step}...</p>
          <p className="wait-time">
            Please wait. This can take up to 40 seconds. Waited {seconds} {seconds === 1 ? 'second' : 'seconds'}.
          </p>
          {seconds >= 30 && (
            <p className="wait-time">Still working. The first scan can be slower while the server wakes up.</p>
          )}
        </div>
      </div>
      <div className="dimmed">
        <Photo src={photoSrc} />
      </div>
      <button className="secondary" onClick={onCancel}>
        Cancel
      </button>
    </main>
  )
}
