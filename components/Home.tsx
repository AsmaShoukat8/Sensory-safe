import { Photo } from '@/components/Photo'
import type { View } from '@/lib/types'

export function Home({ setView }: { setView: (v: View) => void }) {
  return (
    <main className="container">
      <section className="hero">
        <div>
          <h1>Know a room before it overwhelms you.</h1>
          <p className="lede">Add a photo. See what may bother you. Find a calmer place to sit.</p>
          <button className="primary" onClick={() => setView('setup')}>
            Try the scanner
          </button>
          <p className="button-help">Next, choose what you want to check.</p>
        </div>
        <div className="hero-card">
          <Photo overlay src="/cafe-room.png" />
        </div>
      </section>
      <section className="section">
        <h2>How it works</h2>
        <ol className="steps">
          <li>
            <b>1. Add a photo.</b>
            <p>Use your camera or upload a room photo.</p>
          </li>
          <li>
            <b>2. See the results.</b>
            <p>We mark lights, patterns, crowds, and clutter.</p>
          </li>
          <li>
            <b>3. Find a calmer spot.</b>
            <p>We show the easiest place to try.</p>
          </li>
        </ol>
      </section>
    </main>
  )
}
