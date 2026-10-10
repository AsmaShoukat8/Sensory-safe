import type { AnalysisResult } from '@/lib/analyze-image'

export type View = 'home' | 'setup' | 'scan' | 'analyzing' | 'results' | 'history' | 'profile'

export type Settings = {
  textSize: 'small' | 'medium' | 'large'
  highContrast: boolean
  calmMode: boolean
  spacing: 'normal' | 'wide'
}

export type ScanRecord = {
  id: string
  date: string
  name: string
  result: AnalysisResult
  thumbnail: string
}
