import { useRef, useState } from 'react'
import { Back } from '@/components/Back'
import type { View } from '@/lib/types'

type ScanProps = {
  onAnalyze: (file: File) => void
  setView: (v: View) => void
  analysisError?: string
}

export function Scan({ onAnalyze, setView, analysisError = '' }: ScanProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [dragging, setDragging] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState(false)
  const [error, setError] = useState('')

  const accept = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Unsupported file type. Choose an image.')
      return
    }
    setError('')
    onAnalyze(file)
  }

  const close = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOpen(false)
  }

  const open = async () => {
    setCameraError(false)
    setCameraOpen(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch {
      setCameraError(true)
    }
  }

  const capture = () => {
    const video = videoRef.current
    if (!video?.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob) {
          close()
          onAnalyze(new File([blob], 'webcam-room.jpg', { type: 'image/jpeg' }))
        }
      },
      'image/jpeg',
      0.9,
    )
  }

  const message = error || analysisError

  return (
    <main className="container">
      <Back setView={setView} />
      <section className="page-intro">
        <h1>Add a room photo</h1>
        <p>Stand where you plan to sit. Then choose a photo.</p>
      </section>
      <section
        className={'dropzone ' + (dragging ? 'dragging' : '')}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          accept(e.dataTransfer.files[0])
        }}
      >
        <input ref={inputRef} hidden type="file" accept="image/*" onChange={(e) => accept(e.target.files?.[0])} />
        <h2>Drop a photo here</h2>
        <p>or click to choose an image</p>
      </section>
      <div className="button-row">
        <button className="primary" onClick={() => inputRef.current?.click()}>
          Upload photo
        </button>
        <button className="secondary" onClick={open}>
          Use webcam
        </button>
      </div>
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
      <p className="button-help">JPG, PNG, or another image type.</p>
      {cameraOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="camera-modal" role="dialog" aria-modal="true" aria-labelledby="camera-title">
            <h2 id="camera-title">Take a room photo</h2>
            {cameraError ? (
              <>
                <p>We couldn&apos;t access a camera. Please check webcam permission or use Upload photo.</p>
                <button className="secondary" onClick={close}>
                  Close
                </button>
              </>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline aria-label="Live webcam preview" />
                <div className="button-row">
                  <button className="primary" onClick={capture}>
                    Capture
                  </button>
                  <button className="secondary" onClick={close}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
