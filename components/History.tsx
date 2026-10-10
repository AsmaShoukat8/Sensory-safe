import { useEffect, useState } from 'react'
import { Back } from '@/components/Back'
import { deleteScan, getScans, saveScan } from '@/lib/history'
import type { ScanRecord, View } from '@/lib/types'

export function History({ setView, onOpen }: { setView: (v: View) => void; onOpen: (scan: ScanRecord) => void }) {
  const [scans, setScans] = useState<ScanRecord[]>([])
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    getScans()
      .then(setScans)
      .finally(() => setLoading(false))
  }, [])

  const filtered = scans.filter((s) => filter === 'All' || s.result.label === filter)

  const rename = async (scan: ScanRecord) => {
    const updated = { ...scan, name: draft.trim() || 'Untitled room' }
    await saveScan(updated)
    setScans((items) => items.map((item) => (item.id === scan.id ? updated : item)))
    setEditing(null)
  }

  return (
    <main className="container">
      <Back setView={setView} />
      <section className="page-intro">
        <h1>Scan history</h1>
        <p>Scans are saved on this device only.</p>
      </section>
      <div className="filters" aria-label="Filter scans">
        {['All', 'Calm', 'Okay', 'Tough'].map((option) => (
          <button key={option} className={filter === option ? 'selected' : ''} onClick={() => setFilter(option)}>
            {option}
          </button>
        ))}
      </div>
      {loading ? (
        <p>Loading saved scans...</p>
      ) : filtered.length === 0 ? (
        <section className="empty">
          <h2>No scans yet. Scan your first room.</h2>
          <button className="primary" onClick={() => setView('scan')}>
            Add a room photo
          </button>
        </section>
      ) : (
        <section className="history-list">
          {filtered.map((scan) => (
            <article className="history-item" key={scan.id}>
              <button className="history-open" onClick={() => onOpen(scan)}>
                <img src={scan.thumbnail} alt="Thumbnail of scanned room" />
                <span>
                  <strong>{scan.name}</strong>
                  <small>
                    {new Date(scan.date).toLocaleDateString()} · {scan.result.label} ({scan.result.calmScore})
                  </small>
                </span>
              </button>
              {editing === scan.id ? (
                <div className="inline-edit">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-label="Scan name"
                  />
                  <button className="primary" onClick={() => rename(scan)}>
                    Save
                  </button>
                  <button className="secondary" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="item-actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      setEditing(scan.id)
                      setDraft(scan.name)
                    }}
                  >
                    Rename
                  </button>
                  <button className="danger" onClick={() => setDeleting(scan.id)}>
                    Delete
                  </button>
                </div>
              )}
              {deleting === scan.id && (
                <div className="confirm">
                  <p>Delete this scan?</p>
                  <button
                    className="danger"
                    onClick={async () => {
                      await deleteScan(scan.id)
                      setScans((items) => items.filter((item) => item.id !== scan.id))
                      setDeleting(null)
                    }}
                  >
                    Yes, delete
                  </button>
                  <button className="secondary" onClick={() => setDeleting(null)}>
                    No, keep it
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
