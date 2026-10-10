import type { View } from '@/lib/types'

export function Back({ setView }: { setView: (v: View) => void }) {
  return (
    <button className="back" onClick={() => setView('home')}>
      Back
    </button>
  )
}
