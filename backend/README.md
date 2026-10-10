# Sensory-Safe Scanner: backend

Express API that analyzes a room photo and returns the exact JSON the frontend (`lib/analyze-image.ts`) expects.

## Run it

```bash
cd backend
npm install
cp .env.example .env      # optional: add GEMINI_API_KEY
npm start                 # http://localhost:4000
npm test
```

Then in the frontend folder run `npm run dev` (or `pnpm dev`). It calls `http://localhost:4000` by default; override with `NEXT_PUBLIC_API_URL`.

## API

`POST /api/analyze` (multipart/form-data)

| field         | type   | notes                                                                 |
|---------------|--------|-----------------------------------------------------------------------|
| `image`       | file   | required, any image, max 12 MB                                        |
| `triggers`    | string | JSON array or comma list of `light, glare, clutter, crowds, patterns, color` |
| `sensitivity` | string | optional: `low`, `medium` (default), `high`                           |

Response: `{ calmScore, label, summary, factors[{name,score,note,spots[]}], calmestArea, quickFixes[], meta }`.
Spot coordinates are percentages of the photo. Factor `score` is 0-100 where **higher = more bothersome**; `calmScore` is 0-100 where **higher = calmer**. `meta` is extra info the frontend can ignore.

Errors are `{ "error": "message" }` with status 400 / 413 / 415 / 422 / 500.

`GET /api/health` returns `{ ok, vision }`.

## How it works

| Factor   | Method (in `src/`)                                                                                      |
|----------|----------------------------------------------------------------------------------------------------------|
| Lighting | Blown-out pixel share + connected bright regions (ceiling panels vs windows/glare); large dark areas too |
| Clutter  | Edge density per grid cell (+ object count from the vision model when on)                                |
| Patterns | Sliding-block autocorrelation: stripes, checks and prints oscillate with a steady period                 |
| Color    | Share of highly saturated pixels + share of harsh high-contrast edges                                    |
| Crowds   | Person boxes from the vision model (**needs `GEMINI_API_KEY`**; without it this factor is left out)      |

The Calm Score weights the factors by the triggers the user picked (selected 3x, others 0.6x) and by sensitivity. The calmest area is the quietest window of the photo under those same weights.

## Notes and limits

- Photos are processed in memory and never saved or logged.
- Pixel heuristics are tuned on a few images. If scores feel off, the thresholds are constants at the top of `imageStats.js` and in `factors.js`.
- Check the Gemini model name in `.env` (`GEMINI_MODEL`); models get retired.
- Not covered: flicker (needs video), sound, smell. The score is an aid, not a medical tool.
- Add rate limiting before deploying publicly, especially with an API key.
