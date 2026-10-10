import { Back } from '@/components/Back'
import type { Settings, View } from '@/lib/types'

type ProfileProps = {
  settings: Settings
  setSettings: (s: Settings) => void
  setView: (v: View) => void
}

export function Profile({ settings, setSettings, setView }: ProfileProps) {
  return (
    <main className="narrow">
      <Back setView={setView} />
      <section className="page-intro">
        <h1>Settings</h1>
        <p>Change how this app looks and moves.</p>
      </section>
      <section className="profile-card">
        <h2>Text size</h2>
        <select
          value={settings.textSize}
          onChange={(e) => setSettings({ ...settings, textSize: e.target.value as Settings['textSize'] })}
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
        <h2>Spacing</h2>
        <select
          value={settings.spacing}
          onChange={(e) => setSettings({ ...settings, spacing: e.target.value as Settings['spacing'] })}
        >
          <option value="normal">Normal</option>
          <option value="wide">Wide</option>
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.highContrast}
            onChange={(e) => setSettings({ ...settings, highContrast: e.target.checked })}
          />{' '}
          High contrast
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.calmMode}
            onChange={() => setSettings({ ...settings, calmMode: !settings.calmMode })}
          />{' '}
          Calm mode. Remove motion.
        </label>
      </section>
    </main>
  )
}
