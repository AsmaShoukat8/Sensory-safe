import type { ScanRecord } from '@/lib/types'

const dbRequest = (request: IDBOpenDBRequest) =>
  new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

async function openHistoryDb() {
  const request = indexedDB.open('sensory-safe-scanner', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('scans', { keyPath: 'id' })
  return dbRequest(request)
}

export async function saveScan(scan: ScanRecord) {
  const db = await openHistoryDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('scans', 'readwrite')
    tx.objectStore('scans').put(scan)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export async function getScans() {
  const db = await openHistoryDb()
  return new Promise<ScanRecord[]>((resolve, reject) => {
    const tx = db.transaction('scans', 'readonly')
    const request = tx.objectStore('scans').getAll()
    request.onsuccess = () => {
      db.close()
      // Scans saved before the analysis object existed have a different shape; skip them.
      const scans = (request.result as ScanRecord[]).filter((s) => typeof s.result?.calmScore === 'number')
      resolve(scans.sort((a, b) => b.date.localeCompare(a.date)))
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

export async function deleteScan(id: string) {
  const db = await openHistoryDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('scans', 'readwrite')
    tx.objectStore('scans').delete(id)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

export function resizeThumbnail(file: File) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      const scale = Math.min(1, 400 / image.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(image.width * scale)
      canvas.height = Math.round(image.height * scale)
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('thumbnail'))
    }
    image.src = url
  })
}
