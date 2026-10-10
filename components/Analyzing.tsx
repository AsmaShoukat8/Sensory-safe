import { Photo } from '@/components/Photo'

export function Analyzing({ photoSrc }: { photoSrc: string }) {
  return (
    <main className="narrow analyzing">
      <h1>Checking your photo</h1>
      <p>We are checking light, clutter, patterns, and crowds.</p>
      <Photo src={photoSrc} />
    </main>
  )
}
