'use client'

import { useEffect, useRef, useState } from 'react'
import { Analyzing } from '@/components/Analyzing'
import { History } from '@/components/History'
import { Home } from '@/components/Home'
import { Nav } from '@/components/Nav'
import { Profile } from '@/components/Profile'
import { Results } from '@/components/Results'
import { Scan } from '@/components/Scan'
import { Setup } from '@/components/Setup'
import { analyzeImage, type AnalysisResult } from '@/lib/analyze-image'
import { resizeThumbnail, saveScan } from '@/lib/history'
import type { ScanRecord, Settings, View } from '@/lib/types'

export default function Page() {
  const [view, setView] = useState<View>('home')
  const [photoSrc, setPhotoSrc] = useState('/cafe-room.png')
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [analysisError, setAnalysisError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings>({
    textSize: 'medium',
    highContrast: false,
    calmMode: false,
    spacing: 'normal',
  })
  const objectUrlRef = useRef<string | null>(null)
  const requestRef = useRef(0)

  useEffect(() => {
    const saved = window.localStorage.getItem('sensory-settings')
    if (saved) setSettings(JSON.parse(saved))
  }, [])

  useEffect(() => {
    window.localStorage.setItem('sensory-settings', JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    if (view !== 'scan' && view !== 'analyzing') setAnalysisError('')
  }, [view])

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    },
    [],
  )

  const startAnalysis = async (file: File) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    const request = ++requestRef.current
    setCurrentFile(file)
    setPhotoSrc(url)
    setAnalysis(null)
    setAnalysisError('')
    setSavedId(null)
    setSaveMessage('')
    setView('analyzing')

    try {
      const result = await analyzeImage(file)
      if (request !== requestRef.current) return
      setAnalysis(result)
      setView((v) => (v === 'analyzing' ? 'results' : v))
    } catch {
      if (request !== requestRef.current) return
      setAnalysisError("We couldn't check this photo. Please try again.")
      setView((v) => (v === 'analyzing' ? 'scan' : v))
    }
  }

  const saveCurrent = async () => {
    if (!currentFile || !analysis) return
    try {
      const thumbnail = await resizeThumbnail(currentFile)
      const id = crypto.randomUUID()
      await saveScan({ id, date: new Date().toISOString(), name: 'Untitled room', result: analysis, thumbnail })
      setSavedId(id)
      setSaveMessage('Scan saved.')
    } catch {
      setSaveMessage("We couldn't save this scan. You can still download the report.")
    }
  }

  const openSaved = (scan: ScanRecord) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    requestRef.current++
    setCurrentFile(null)
    setPhotoSrc(scan.thumbnail)
    setAnalysis(scan.result)
    setSavedId(scan.id)
    setSaveMessage('')
    setView('results')
  }

  const className = `${settings.calmMode ? 'calming ' : ''}${settings.highContrast ? 'high-contrast ' : ''}text-${settings.textSize} spacing-${settings.spacing}`

  return (
    <div className={className}>
      <Nav view={view} setView={setView} settings={settings} setSettings={setSettings} />
      {view === 'home' && <Home setView={setView} />}
      {view === 'setup' && <Setup setView={setView} />}
      {view === 'scan' && <Scan setView={setView} onAnalyze={startAnalysis} analysisError={analysisError} />}
      {view === 'analyzing' && (
        <Analyzing
          photoSrc={photoSrc}
          onCancel={() => {
            requestRef.current++
            setView('scan')
          }}
        />
      )}
      {view === 'results' && analysis && (
        <Results
          setView={setView}
          photoSrc={photoSrc}
          analysis={analysis}
          onSave={saveCurrent}
          saveMessage={saveMessage}
          savedId={savedId}
        />
      )}
      {view === 'history' && <History setView={setView} onOpen={openSaved} />}
      {view === 'profile' && <Profile settings={settings} setSettings={setSettings} setView={setView} />}
    </div>
  )
}
