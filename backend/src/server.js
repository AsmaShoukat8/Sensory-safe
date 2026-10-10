import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { fileURLToPath } from 'node:url'
import { analyzeBuffer } from './analyze.js'
import { HttpError } from './imageStats.js'
import { parseTriggers, parseSensitivity } from './score.js'
import { visionEnabled } from './vision.js'

const MAX_MB = 12

export function createApp() {
  const app = express()
  const origins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((s) => s.trim())
  app.use(cors({ origin: origins }))

  // Photos stay in memory only; nothing is written to disk or logged.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => (file.mimetype.startsWith('image/') ? cb(null, true) : cb(new HttpError(415, 'Please upload an image file.'))),
  })

  app.get('/api/health', (_req, res) => res.json({ ok: true, vision: visionEnabled() }))

  app.post('/api/analyze', upload.single('image'), async (req, res, next) => {
    try {
      if (!req.file) throw new HttpError(400, 'No image received. Send it as multipart field "image".')
      const result = await analyzeBuffer(req.file.buffer, {
        triggers: parseTriggers(req.body.triggers),
        sensitivity: parseSensitivity(req.body.sensitivity),
      })
      res.json(result)
    } catch (err) {
      next(err)
    }
  })

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      const tooBig = err.code === 'LIMIT_FILE_SIZE'
      return res.status(tooBig ? 413 : 400).json({ error: tooBig ? `Photo is too large (max ${MAX_MB} MB).` : err.message })
    }
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    console.error('[analyze] unexpected error:', err.message)
    res.status(500).json({ error: 'Something went wrong while analyzing the photo.' })
  })

  return app
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4000)
  createApp().listen(port, () => {
    console.log(`Sensory-Safe backend on http://localhost:${port}  (vision model: ${visionEnabled() ? 'on' : 'off'})`)
  })
}
