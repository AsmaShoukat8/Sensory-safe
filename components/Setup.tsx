import { useEffect, useState } from 'react'
import { Back } from '@/components/Back'
import { TRIGGERS_STORAGE_KEY } from '@/lib/analyze-image'
import type { View } from '@/lib/types'

const triggers = [
  ['Light', 'Bright lights', 'Ceiling lights or bulbs'],
  ['Glare', 'Glare', 'Window or screen reflections'],
  ['Objects', 'Clutter', 'Many objects together'],
  ['People', 'Crowds', 'Busy or crowded spaces'],
  ['Pattern', 'Busy patterns', 'Stripes or checks'],
  ['Color', 'Bright colors', 'Strong wall or object colors'],
]

export function Setup({ setView }: { setView: (v: View) => void }) {
  const [selected, setSelected] = useState<number[]>([0, 1])

  // Load previously saved choices, and save every change so the backend can personalize the score.
  // Only start saving AFTER the saved choices were loaded, otherwise the defaults overwrite them
  // (React dev mode runs effects twice, which made the first version lose your choices).
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TRIGGERS_STORAGE_KEY)
      if (saved) setSelected(JSON.parse(saved))
    } catch {}
    setLoaded(true)
  }, [])
  useEffect(() => {
    if (!loaded) return
    try {
      window.localStorage.setItem(TRIGGERS_STORAGE_KEY, JSON.stringify(selected))
    } catch {}
  }, [selected, loaded])

  return (
    <main className="narrow">
      <Back setView={setView} />
      <section className="page-intro">
        <h1>Choose what to check</h1>
        <p>Select all that may bother you.</p>
      </section>
      <section>
        <h2>Room triggers</h2>
        <div className="trigger-grid">
          {triggers.map((t, i) => (
            <button
              className={'trigger ' + (selected.includes(i) ? 'selected' : '')}
              aria-pressed={selected.includes(i)}
              onClick={() => setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))}
              key={t[1]}
            >
              <strong>{t[1]}</strong>
              <span>{t[2]}</span>
              <b>{selected.includes(i) ? 'Selected' : 'Select'}</b>
            </button>
          ))}
        </div>
      </section>
      <button className="primary wide" onClick={() => setView('scan')}>
        Save choices
      </button>
    </main>
  )
}
