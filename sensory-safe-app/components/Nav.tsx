import type { Settings, View } from '@/lib/types'

type NavProps = {
  view: View
  setView: (v: View) => void
  settings: Settings
  setSettings: (s: Settings) => void
}

export function Nav({ view, setView, settings, setSettings }: NavProps) {
  return (
    <header className="nav">
      <button className="brand" onClick={() => setView('home')} aria-label="Go to home">
        <span className="brand-mark">S</span>
        <span>
          Sensory-Safe
          <br />
          <b>Scanner</b>
        </span>
      </button>
      <nav aria-label="Main navigation">
        <button className={view === 'scan' ? 'active' : ''} onClick={() => setView('scan')}>
          Scan
        </button>
        <button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>
          History
        </button>
        <button className={view === 'profile' ? 'active' : ''} onClick={() => setView('profile')}>
          Profile
        </button>
        <button
          className="calm-toggle"
          aria-pressed={settings.calmMode}
          onClick={() => setSettings({ ...settings, calmMode: !settings.calmMode })}
        >
          Calm mode: {settings.calmMode ? 'On' : 'Off'}
        </button>
      </nav>
    </header>
  )
}
