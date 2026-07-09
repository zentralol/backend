# Zentra Backend

Express.js API server for Zentra. It is the public API gateway used by the web and mobile clients: it validates requests, calls the FastAPI ML service when available, falls back to precomputed H3 grid scores in Supabase PostgreSQL, and returns crowd predictions, forecasts, heatmaps, and recommendations.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Authentication](#authentication)
3. [Project Structure](#project-structure)
4. [How a Prediction Request Flows](#how-a-prediction-request-flows)
5. [How to Run Locally](#how-to-run-locally)
6. [Testing the API](#testing-the-api)
7. [Endpoint Reference](#endpoint-reference)
8. [Shared Response Conventions](#shared-response-conventions)
9. [Error Codes](#error-codes)
10. [Running Unit Tests](#running-unit-tests)
11. [Tech Stack](#tech-stack)

---

## Project Overview

The backend sits between the clients and the two data sources:

```
Web Frontend / Mobile App
        |
        v
Express Backend API  (this repo, port 3000)
        |
        |----------------> FastAPI ML Service  (zentra-ml, port 8000, optional)
        |
        v
Supabase PostgreSQL  (h3_grid_scores fallback + request logs)
```

Clients only ever call the Express API. The backend never exposes Supabase keys or the ML service directly to clients.

**What Supabase is used for** (PostgreSQL only, accessed through the `pg` driver):

| Table | Backend usage |
|-------|---------------|
| `h3_grid_scores` | Read precomputed H3 crowd scores for fallback predictions, forecasts, heatmaps, and recommendations |
| `h3_grid_cells` | Read H3 cell centroids for ML-backed heatmap generation |
| `prediction_requests` | Write a log row for every prediction served, for later analysis |

Complex H3 read queries live as PostgreSQL functions in `supabase/migrations/` so route handlers stay small (see [Apply the database functions](#step-3--apply-the-supabase-database-functions)).

---

## Authentication

The crowd prediction API uses Clerk for request authentication. Clients call protected endpoints with a Clerk session token:

```http
Authorization: Bearer <clerk-session-token>
```

The backend verifies the token with `@clerk/express` and derives the authenticated user from Clerk. It does not use Supabase Auth for API authentication.

Current auth scope:

| Route group | Authentication |
|-------------|----------------|
| `/api/v1/health` | Public |
| `/api/v1/map/*` | Required |
| `/api/v1/predictions/*` | Required |
| `/api/v1/recommendations/*` | Required |

Requests to protected route groups without a valid Clerk session token return `401 UNAUTHORIZED`.

---

## Project Structure

```
backend/
├── server.js                 # Entry point — starts the HTTP server
├── src/
│   ├── app.js                # Express app: middleware + route mounting
│   ├── config/
│   │   ├── database.js       # pg pool from DATABASE_URL
│   │   └── ml.js             # ML base URL + timeout from env
│   ├── middleware/
│   │   ├── auth.js           # JSON 401 guard for protected API routes
│   │   └── clerkAuth.js      # Clerk middleware setup
│   ├── routes/
│   │   ├── healthRoutes.js         # GET  /health
│   │   ├── predictionRoutes.js     # POST /predictions, /predictions/batch,
│   │   │                           # GET  /predictions/forecast, POST /predictions/explanation
│   │   ├── heatmapRoutes.js        # GET  /map/heatmap
│   │   └── recommendationRoutes.js # POST /recommendations, /quiet-times, /places
│   ├── services/
│   │   └── mlClient.js       # HTTP client for the FastAPI ML service
│   ├── repositories/         # All SQL access (one file per domain)
│   │   └── sql/              # Raw query strings
│   └── utils/
│       ├── response.js       # success/error response envelope
│       ├── busyness.js       # score normalisation + busyness level mapping
│       └── validation.js     # date, coordinate, and limit validation helpers
├── supabase/
│   └── migrations/           # PostgreSQL functions used by the repositories
├── docs/
│   └── api-contract.md       # API contract document
└── package.json
```

---

## How a Prediction Request Flows

Not every endpoint talks to the ML service. The ML-first flow below applies to `POST /predictions`, `POST /predictions/batch`, and `GET /map/heatmap` (when `source` is `auto` or `ml`):

1. **Authenticate the request** — protected prediction, map, and recommendation endpoints require a valid Clerk session token in the `Authorization` header.
2. **Validate input** — coordinates must be finite numbers inside the Manhattan coverage box (lat `40.679–40.882`, lng `-74.020` to `-73.907`), and time values must parse as date-times. All times are Manhattan local time (see [Time zones](#time-zones)). Invalid input returns a `400`/`422` error envelope immediately.
3. **Try the ML service first** — when `ML_API_BASE_URL` is set, the backend calls the FastAPI service (`POST /predict/crowd` for current/past times, `POST /predict/future` for future times, body `{lat, lon, when}`). ML-backed responses carry `source: "ml_fastapi"` and `cached: false`.
4. **Fall back to Supabase** — if ML is not configured, times out (`ML_API_TIMEOUT_MS`, default 5000 ms), or errors, the backend reads the nearest precomputed score from `h3_grid_scores`. These responses carry `source: "h3_grid_scores"` and `cached: true`.
5. **Log the request** — every served prediction writes a row to `prediction_requests` for later analysis.

This means the backend works without the ML service running — you just get database-fallback predictions instead of live model output.

The remaining endpoints never call the ML service, even when it is configured: `GET /predictions/forecast` and all three `/recommendations` endpoints read precomputed scores straight from `h3_grid_scores` in the database, and `POST /predictions/explanation` calls neither the database nor the ML service. Each endpoint's actual data source is listed in the [Endpoint Reference](#endpoint-reference).

---

## How to Run Locally

### Prerequisites

- [Node.js](https://nodejs.org/) 20.9+ (required by the Clerk backend SDK)
- Access to the Zentra Supabase project database
- Clerk publishable and secret keys for protected API routes
- Optional: the FastAPI ML service running locally (see the `zentra-ml` README)

### Step 1 — Install dependencies

```bash
npm install
```

### Step 2 — Create a `.env` file

Configuration is read from a `.env` file at startup via `dotenv`. This file is not committed to git.

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | HTTP port. Defaults to `3000`. |
| `DATABASE_URL` | Yes | Supabase PostgreSQL connection string for `pg`. |
| `CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key used by `@clerk/express` to identify the Clerk instance. |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key used by `@clerk/express` to verify session tokens. |
| `ML_API_BASE_URL` | No | FastAPI ML service base URL, e.g. `http://localhost:8000`. Leave unset to run on database fallback only. |
| `ML_API_TIMEOUT_MS` | No | Timeout for each ML request. Defaults to `5000`. |
| `TZ` | Yes | Set to `America/New_York` so naive time strings are interpreted as Manhattan time (see [Time zones](#time-zones)). Set it in the shell/deployment environment, not in `.env` — Node reads `TZ` at process start. |

The `DATABASE_URL` comes from Supabase Dashboard → Project Settings → Database → Connection string (URI format):

```env
DATABASE_URL=postgresql://postgres:<YOUR-PASSWORD>@db.<project-ref>.supabase.co:5432/postgres
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
ML_API_BASE_URL=http://localhost:8000
```

### Step 3 —  (Optional) Apply the Supabase database functions

The repository layer calls PostgreSQL functions defined in:

```text
supabase/migrations/20260707000000_backend_query_functions.sql
```

These need to exist in the database before the H3-backed endpoints work. You can paste the SQL into the Supabase SQL Editor, or apply it through the Supabase CLI if the project is linked.

| Function | Backend purpose |
|----------|-----------------|
| `zentra_get_heatmap_scores` | Heatmap fallback data |
| `zentra_get_nearest_prediction_score` | Single and batch prediction fallback |
| `zentra_get_nearest_h3_cell` | Forecast H3 cell lookup |
| `zentra_get_forecast_scores` | Coordinate forecast data |
| `zentra_get_quieter_nearby_scores` | Quieter nearby area recommendations |

### Step 4 — (Optional) Start the ML service

To exercise the ML-first path, start the FastAPI service from the `zentra-ml` repo in another terminal:

```bash
cd ../zentra-ml/api
TZ=America/New_York uvicorn main:app --reload --port 8000
```

The `TZ` variable makes the ML service interpret naive time strings as Manhattan time, matching the API-wide convention (see [Time zones](#time-zones)).

Skipping this step is fine — every endpoint still works from the Supabase fallback.

### Step 5 — Start the server

```bash
TZ=America/New_York npm start
```

You should see:

```text
Zentra Backend Server running on http://localhost:3000
```

### Step 6 — Verify startup

Hit the health check:

```bash
curl http://localhost:3000/api/v1/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "apiVersion": "v1",
    "database": "connected",
    "uptimeSeconds": 12.34
  },
  "meta": { "generatedAt": "2026-07-08T12:00:00.000Z" }
}
```

A `503` with code `DATABASE_UNAVAILABLE` means the `DATABASE_URL` is wrong or the database is unreachable.

---

## Testing the API

All endpoints live under `http://localhost:3000/api/v1`. The examples below cover every implemented crowd endpoint; expected response shapes are in the [Endpoint Reference](#endpoint-reference). All times in the examples are Manhattan local time, written without an offset (see [Time zones](#time-zones)).

The prediction, map, and recommendation examples require a Clerk session token. Export one from an authenticated client session before running the examples:

```bash
export ZENTRA_API_TOKEN="<clerk-session-token>"
```

### Test 1 — Single prediction at Times Square

```bash
curl -X POST http://localhost:3000/api/v1/predictions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ZENTRA_API_TOKEN" \
  -d '{"lat":40.758,"lng":-73.9855,"targetTime":"2026-07-10T16:30:00","durationMinutes":60}'
```

Check the `source` field in the response: `ml_fastapi` means the ML service answered; `h3_grid_scores` means the database fallback was used.

### Test 2 — Batch prediction for two locations

```bash
curl -X POST http://localhost:3000/api/v1/predictions/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ZENTRA_API_TOKEN" \
  -d '{
    "targetTime": "2026-07-10T16:30:00",
    "coordinates": [
      {"clientId": "times-square", "lat": 40.758, "lng": -73.9855},
      {"clientId": "union-square", "lat": 40.7359, "lng": -73.9911}
    ]
  }'
```

### Test 3 — Forecast over a time window

```bash
curl -H "Authorization: Bearer $ZENTRA_API_TOKEN" \
  "http://localhost:3000/api/v1/predictions/forecast?lat=40.758&lng=-73.9855&startTime=2026-07-10T00:00:00&endTime=2026-07-11T00:00:00&limit=6"
```

### Test 4 — Heatmap from the database fallback

```bash
curl -H "Authorization: Bearer $ZENTRA_API_TOKEN" \
  "http://localhost:3000/api/v1/map/heatmap?limit=3&source=database"
```

Use `source=ml` to force the ML path (returns `503` if ML is unavailable), or omit `source` for automatic selection.

### Test 5 — Quieter nearby areas

```bash
curl -X POST http://localhost:3000/api/v1/recommendations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ZENTRA_API_TOKEN" \
  -d '{"lat":40.758,"lng":-73.9855,"targetTime":"2026-07-10T16:30:00","limit":3}'
```

### Test 6 — Quieter times for the same spot

```bash
curl -X POST http://localhost:3000/api/v1/recommendations/quiet-times \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ZENTRA_API_TOKEN" \
  -d '{
    "lat": 40.758, "lng": -73.9855,
    "targetTime": "2026-07-10T16:30:00",
    "startTime": "2026-07-10T09:00:00",
    "endTime": "2026-07-10T21:00:00",
    "limit": 3
  }'
```

### Test 7 — Rank candidate places

```bash
curl -X POST http://localhost:3000/api/v1/recommendations/places \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ZENTRA_API_TOKEN" \
  -d '{
    "currentLocation": {"lat": 40.758, "lng": -73.9855},
    "targetTime": "2026-07-10T16:30:00",
    "candidatePlaces": [
      {"placeId": "poi_1", "name": "Central Park", "category": "park",
       "coordinates": {"lat": 40.7812, "lng": -73.9665}}
    ]
  }'
```

### Test 8 — Prediction explanation text

```bash
curl -X POST http://localhost:3000/api/v1/predictions/explanation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ZENTRA_API_TOKEN" \
  -d '{"lat":40.758,"lng":-73.9855,"targetTime":"2026-07-10T16:30:00","busynessScore":82,"period":"PM"}'
```

### Test 9 — Validation errors (expected failures)

```bash
# Outside Manhattan coverage — returns 422 LOCATION_OUT_OF_COVERAGE
curl -X POST http://localhost:3000/api/v1/predictions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ZENTRA_API_TOKEN" \
  -d '{"lat":40.6501,"lng":-73.9496,"targetTime":"2026-07-10T16:30:00"}'

# Missing targetTime — returns 400 INVALID_QUERY
curl -X POST http://localhost:3000/api/v1/predictions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ZENTRA_API_TOKEN" \
  -d '{"lat":40.758,"lng":-73.9855}'
```

---

## Endpoint Reference

| Method | Path | Purpose | Talks to |
|--------|------|---------|----------|
| `GET` | `/api/v1/health` | Service and database health | Database |
| `POST` | `/api/v1/predictions` | Single coordinate crowd prediction | ML first → database fallback |
| `POST` | `/api/v1/predictions/batch` | Batch coordinate crowd predictions | ML first → database fallback (per coordinate) |
| `GET` | `/api/v1/predictions/forecast` | Crowd forecast for one coordinate over a time window | Database only |
| `POST` | `/api/v1/predictions/explanation` | Human-readable explanation for a prediction | Neither (in-process) |
| `GET` | `/api/v1/map/heatmap` | H3 heatmap points for map display | ML per cell or database, by `source` |
| `POST` | `/api/v1/recommendations` | Quieter nearby H3 area recommendations | Database only |
| `POST` | `/api/v1/recommendations/quiet-times` | Quieter time recommendations for one coordinate | Database only |
| `POST` | `/api/v1/recommendations/places` | Rank client-provided candidate places by predicted crowd | Database only |

This README focuses on the functionality that exists in the current code.

### GET /health

Reports whether the API is up and can reach the database. Returns `200` with `status: "ok"`, `apiVersion`, `database: "connected"`, and the process `uptimeSeconds`. Returns `503` with `DATABASE_UNAVAILABLE` if the database query fails.

**Data source:** database — runs a connection-check query. Does not check the ML service, so a green health check says nothing about ML availability.

### POST /predictions

Predicts the crowd level for one coordinate at one time.

**Data source:** tries the ML service first when `ML_API_BASE_URL` is configured (`source: "ml_fastapi"`); on ML failure or when unconfigured, reads the nearest precomputed score from `h3_grid_scores` (`source: "h3_grid_scores"`). Every served prediction is also logged to the `prediction_requests` table.

**Request body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `lat` / `lng` | float | yes | Must be inside the Manhattan coverage box |
| `targetTime` | string | yes | Manhattan local time, ISO 8601 without offset, e.g. `2026-07-10T16:30:00` (see [Time zones](#time-zones)) |
| `durationMinutes` | int | no | Defaults to 60; accepted range 15–240 |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "prediction": {
      "predictionId": "grid_123",
      "h3Cell": "892a100d67bffff",
      "coordinates": { "lat": 40.758, "lng": -73.9855 },
      "matchedCoordinates": { "lat": 40.7581, "lng": -73.9854 },
      "targetTime": "2026-07-10T16:30:00",
      "durationMinutes": 60,
      "busynessScore": 82,
      "busynessLevel": "very_busy",
      "pedestriansPredicted": 3067.3,
      "period": "PM",
      "confidence": 0.6,
      "modelVersion": "h3-grid-v0.1",
      "cached": true,
      "source": "h3_grid_scores",
      "features": {
        "ensembleLogPrediction": 8.02,
        "poiTotal": 42,
        "poiDensityScore": 0.91,
        "taxiTripCount": 1520,
        "mtaRidershipTotal": 20415,
        "citibikeTripCount": 310
      }
    }
  },
  "meta": { "modelVersion": "h3-grid-v0.1", "generatedAt": "2026-07-08T12:00:00.000Z" }
}
```

**Prediction field reference:**

| Field | Type | Description |
|-------|------|-------------|
| `predictionId` | string | `ml_<h3>_<timestamp>` for ML results, `grid_<row-id>` for database fallback |
| `h3Cell` | string | Uber H3 resolution-9 hex cell ID (~150 m grid) matched to the coordinate |
| `coordinates` | object | Echo of the requested `lat`/`lng` |
| `matchedCoordinates` | object | Centroid of the H3 cell the prediction actually comes from |
| `targetTime` | string | Echo of the requested Manhattan time, returned as sent |
| `busynessScore` | int | 0–100 crowd intensity (higher = busier) |
| `busynessLevel` | string | `very_quiet` / `quiet` / `moderate` / `busy` / `very_busy` (see [thresholds](#busyness-levels)) |
| `crowdCategory` | string | ML label such as `"Very Busy"` — present only on ML-backed responses |
| `pedestriansPredicted` | float | Predicted pedestrian count in the corridor |
| `period` | string | Time bucket: `EARLY` / `AM` / `MD` / `PM` / `EVE` / `NIGHT` |
| `confidence` | float | Heuristic confidence: `0.8` ML current, `0.65` ML future, `0.6` database fallback |
| `modelVersion` | string | `ml-fastapi-v1.0` or `h3-grid-v0.1` |
| `cached` | bool | `true` when the value came from precomputed grid scores |
| `source` | string | `ml_fastapi` or `h3_grid_scores` |
| `features` | object | Underlying grid signals (POI, taxi, MTA, Citi Bike) — present only on database-fallback responses |

Errors: `400 INVALID_QUERY` (missing/invalid fields), `422 LOCATION_OUT_OF_COVERAGE`, `422 INVALID_QUERY` (durationMinutes out of range), `503 PREDICTION_UNAVAILABLE` (no data for the coordinate/time).

### POST /predictions/batch

Same prediction logic as above, applied to 1–100 coordinates in one call — useful for scoring a list of place cards at once.

**Data source:** the same ML-first / database-fallback flow as the single endpoint, decided per coordinate — one batch can mix `ml_fastapi` and `h3_grid_scores` results if the ML service fails partway through.

**Request body:** `targetTime` (required), optional `durationMinutes`, and `coordinates`: an array of `{clientId?, lat, lng}` items. `clientId` is echoed back so the client can match results to its own items.

**Response `200`:** `data.predictions` is an array of the same prediction objects as the single endpoint (each with `clientId`), and `data.warnings` collects per-coordinate problems instead of failing the whole request:

```json
{
  "success": true,
  "data": {
    "targetTime": "2026-07-10T16:30:00",
    "durationMinutes": 60,
    "predictions": [ { "clientId": "times-square", "busynessScore": 82, "...": "..." } ],
    "warnings": [
      { "clientId": "bad-point", "code": "LOCATION_OUT_OF_COVERAGE", "message": "Prediction is currently available for Manhattan only" }
    ]
  },
  "meta": { "count": 1, "warningCount": 1, "generatedAt": "..." }
}
```

A coordinate that is invalid, out of coverage, or has no data becomes a warning entry (`INVALID_COORDINATES`, `LOCATION_OUT_OF_COVERAGE`, `PREDICTION_UNAVAILABLE`, or `INTERNAL_ERROR`); the remaining coordinates still get predictions.

### GET /predictions/forecast

Returns a time series of predicted crowd levels for one coordinate. The backend maps the coordinate to its nearest H3 cell and reads all grid scores for that cell inside the window.

**Data source:** database only — reads precomputed `h3_grid_scores` rows and never calls the ML service, even when it is configured. The forecast is only as fresh and as time-granular as the grid data loaded into the database.

**Query parameters:**

| Name | Required | Default | Notes |
|------|----------|---------|-------|
| `lat` / `lng` | yes | — | Coordinate to forecast |
| `startTime` / `endTime` | yes | — | Window bounds, Manhattan local time without offset (see [Time zones](#time-zones)) |
| `limit` | no | 24 | Max 100 forecast entries |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "h3Cell": "892a100d67bffff",
    "coordinates": { "lat": 40.758, "lng": -73.9855 },
    "startTime": "2026-07-10T00:00:00",
    "endTime": "2026-07-11T00:00:00",
    "forecast": [
      {
        "timestamp": "2026-07-10T16:30:00.000Z",
        "period": "PM",
        "busynessScore": 82,
        "busynessLevel": "very_busy",
        "pedestriansPredicted": 3067.3
      }
    ]
  },
  "meta": { "count": 1, "generatedAt": "..." }
}
```

`timestamp` values come from the grid data and represent Manhattan wall-clock time; database serialization appends a `Z` suffix, so read the date/time digits as Manhattan time and ignore the `Z` (see [Time zones](#time-zones)).

### POST /predictions/explanation

Turns a score the client already has into display-ready explanation text.

**Data source:** neither — the text is generated in-process from the submitted score and period, with no database query and no ML call, so it responds instantly.

**Request body:** `lat`, `lng`, `targetTime`, and `busynessScore` (0–100) are required; `period` is optional and gets woven into the wording when provided.

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "explanation": {
      "summary": "This area is expected to be very busy during the PM period.",
      "reasons": [
        "The predicted crowd score is in the highest range.",
        "Nearby transit, visitor activity, or POI density may increase foot traffic."
      ],
      "suggestedAction": "Consider changing the time or choosing a quieter nearby area.",
      "disclaimer": "This is a model prediction, not a live crowd count."
    }
  },
  "meta": { "generatedAt": "..." }
}
```

The `summary`, `reasons`, and `suggestedAction` texts vary by the busyness level derived from the score.

### GET /map/heatmap

Returns crowd scores for many H3 cells at once, for rendering a map heatmap.

**Data source:** decided by the `source` parameter. With `auto` (default) or `ml`, the backend reads cell centroids from `h3_grid_cells` in the database, then calls the ML service **once per cell**; if ML is unconfigured or produces no points, `auto` falls back to precomputed `h3_grid_scores` while `ml` returns `503`. With `database`, the ML service is skipped entirely.

**Query parameters:**

| Name | Required | Default | Notes |
|------|----------|---------|-------|
| `targetTime` | no | current time | Manhattan local time without offset (see [Time zones](#time-zones)) |
| `limit` | no | 100 | Max 524 (the full Manhattan grid) |
| `source` | no | `auto` | `auto` tries ML then falls back; `ml` forces ML (503 if unavailable); `database` skips ML |

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "targetTime": "2026-07-10T16:30:00",
    "source": "h3_grid_scores",
    "points": [
      {
        "h3Cell": "892a1008807ffff",
        "coordinates": { "lat": 40.79523, "lng": -73.97250 },
        "period": "PM",
        "queryTimestamp": "2026-07-10T16:30:00.000Z",
        "crowdScore": 53,
        "crowdLevel": "moderate",
        "pedestriansPredicted": 3399.1,
        "poiTotal": 42,
        "source": "h3_grid_scores"
      }
    ]
  },
  "meta": { "count": 1, "generatedAt": "..." }
}
```

Database points include `poiTotal` (POI count in the cell); ML points include `crowdCategory` instead. Because the ML path makes one call per cell, large `limit` values respond noticeably faster with `source=database`.

### POST /recommendations

Suggests nearby H3 areas that are predicted to be quieter than the requested coordinate at the requested time.

**Data source:** database only — reads precomputed `h3_grid_scores` through the `zentra_get_quieter_nearby_scores` function; never calls the ML service.

**Request body:** `lat`, `lng`, `targetTime` (required); `limit` optional (default 5, max 20).

**Response `200`:** `data.recommendations` is an array of quieter cells sorted by the database function, each shaped as:

```json
{
  "type": "quieter_area",
  "h3Cell": "892a100d6d3ffff",
  "coordinates": { "lat": 40.77140, "lng": -73.97372 },
  "busynessScore": 38,
  "busynessLevel": "quiet",
  "pedestriansPredicted": 920.4,
  "period": "PM",
  "reason": "This nearby grid cell has a lower predicted crowd score."
}
```

### POST /recommendations/quiet-times

For a single coordinate, compares the crowd score at the chosen `targetTime` against other times in a client-provided window, and returns the quietest alternatives.

**Data source:** database only — the original score and the alternative times all come from precomputed `h3_grid_scores` (the same data the forecast endpoint reads); never calls the ML service.

**Request body:** `lat`, `lng`, `targetTime`, `startTime`, `endTime` (all required); `limit` optional (default 3, max 24).

**Response `200`:**

```json
{
  "success": true,
  "data": {
    "original": {
      "targetTime": "2026-07-10T16:30:00",
      "busynessScore": 86,
      "busynessLevel": "very_busy"
    },
    "quietTimes": [
      {
        "targetTime": "2026-07-10T10:00:00.000Z",
        "busynessScore": 42,
        "busynessLevel": "moderate",
        "confidence": 0.6,
        "reason": "Predicted crowd score is lower than the selected time."
      }
    ]
  },
  "meta": { "count": 1, "generatedAt": "..." }
}
```

`quietTimes` is sorted from quietest to busiest and excludes the original `targetTime` itself. The `targetTime` inside each `quietTimes` entry comes from the forecast grid (Manhattan time, serialized with a `Z` suffix); the top-level `original.targetTime` echoes what was sent.

### POST /recommendations/places

Ranks candidate places the client has already resolved through its own place search or geocoding provider — the backend does not need a POI catalog. Each candidate is scored, then sorted by busyness score (ties broken by distance from `currentLocation`).

**Data source:** database only — each candidate is scored from precomputed `h3_grid_scores` (one nearest-score lookup per place); never calls the ML service.

**Request body:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `currentLocation` | object | yes | `{lat, lng}`, inside Manhattan coverage |
| `targetTime` | string | yes | Date-time string |
| `candidatePlaces` | array | yes | 1–100 items of `{placeId?, name?, category?, coordinates: {lat, lng}, source?}` |
| `limit` | int | no | Default 5, max 20 |

**Response `200`:** ranked recommendations plus per-place warnings (same warning pattern as batch predictions):

```json
{
  "success": true,
  "data": {
    "targetTime": "2026-07-10T16:30:00",
    "recommendations": [
      {
        "type": "candidate_place",
        "rank": 1,
        "place": {
          "placeId": "poi_1",
          "name": "Central Park",
          "category": "park",
          "coordinates": { "lat": 40.7812, "lng": -73.9665 },
          "source": "frontend_place_provider"
        },
        "prediction": {
          "h3Cell": "892a10089abffff",
          "targetTime": "2026-07-10T16:30:00.000Z",
          "busynessScore": 44,
          "busynessLevel": "moderate",
          "pedestriansPredicted": 1204.7,
          "period": "PM",
          "confidence": 0.6,
          "source": "h3_grid_scores"
        },
        "distanceMeters": 2400,
        "reason": "This candidate place is ranked using its predicted crowd score and distance from the current location."
      }
    ],
    "warnings": []
  },
  "meta": { "count": 1, "warningCount": 0, "generatedAt": "..." }
}
```

---

## Shared Response Conventions

### Response envelope

Every endpoint wraps its payload in the same envelope:

```json
// success
{ "success": true, "data": { }, "meta": { "generatedAt": "2026-07-08T12:00:00.000Z" } }

// error
{ "success": false, "error": { "code": "INVALID_QUERY", "message": "..." }, "meta": { "generatedAt": "..." } }
```

`meta` also carries endpoint-specific extras such as `count`, `warningCount`, or `modelVersion`. `meta.generatedAt` is always UTC (ISO 8601 with `Z`).

### Busyness levels

Scores are normalised to an integer 0–100 (ML scores arriving as 0–1 fractions are scaled up), then mapped to a level:

| busynessScore | busynessLevel |
|--------------:|---------------|
| 0 – 20 | `very_quiet` |
| 21 – 40 | `quiet` |
| 41 – 60 | `moderate` |
| 61 – 80 | `busy` |
| 81 – 100 | `very_busy` |

### Periods

`period` values come from the ML grid and bucket the day the same way as the ML service. The hour ranges refer to **Manhattan local wall-clock time**:

| period | Hours (24h, Manhattan local) |
|--------|------------------------------|
| `EARLY` | 00:00 – 06:59 |
| `AM` | 07:00 – 09:59 |
| `MD` | 10:00 – 13:59 |
| `PM` | 14:00 – 17:59 |
| `EVE` | 18:00 – 21:59 |
| `NIGHT` | 22:00 – 23:59 |

### Time zones

**Every time value in this API is Manhattan local time** (`America/New_York` wall-clock time). There is one system-wide convention:

- **Request times** (`targetTime`, `startTime`, `endTime`) are sent as naive ISO 8601 — no offset, no `Z`: `2026-07-10T16:30:00` means 4:30 PM in Manhattan. Clients convert to Manhattan time before calling the API, using the IANA zone name (`America/New_York`) so daylight saving is handled automatically — never by appending `-04:00`/`-05:00` manually and never with `toISOString()` (which produces UTC).
- **Response times** are Manhattan time too: echoed request fields come back exactly as sent, and `period` buckets refer to Manhattan hours (see [Periods](#periods)).
- **Database-backed timestamps** (forecast `timestamp`, heatmap `queryTimestamp`, quiet-times `quietTimes[].targetTime`, places `prediction.targetTime`) represent Manhattan wall-clock time, but the database serialization appends a `Z` suffix — read the date/time digits as Manhattan time and ignore the `Z`.
- **The one exception**: `meta.generatedAt` is response metadata (when the server built the response) and is a true UTC timestamp.

The server processes read naive time strings in their own local time zone, so both the Express server and the ML service run with the `TZ=America/New_York` environment variable to interpret them as Manhattan time — see [Run locally](#how-to-run-locally).

Because naive wall-clock time has no offset, the daylight-saving switch produces one ambiguous hour a year (1:00–1:59 AM occurs twice each November) and one skipped hour (each March). At crowd-prediction granularity this has no practical effect.

### Coverage area

Predictions cover Manhattan only. Coordinates outside lat `40.679–40.882` / lng `-74.020` to `-73.907` are rejected with `LOCATION_OUT_OF_COVERAGE`.

---

## Error Codes

| Code | HTTP | Meaning |
|------|-----:|---------|
| `UNAUTHORIZED` | 401 | Missing or invalid Clerk session token for a protected endpoint |
| `DATABASE_UNAVAILABLE` | 503 | Database connection failed |
| `INVALID_QUERY` | 400/422 | Missing or invalid request fields |
| `INVALID_COORDINATES` | 422 | Latitude/longitude not valid numbers |
| `LOCATION_OUT_OF_COVERAGE` | 422 | Coordinate outside Manhattan coverage |
| `PREDICTION_UNAVAILABLE` | 503 | No ML or fallback prediction available |
| `ML_API_UNAVAILABLE` | 503 | ML forced via `source=ml` but the ML service did not respond |
| `INTERNAL_ERROR` | 500 | Unexpected server failure |

In batch-style endpoints (`/predictions/batch`, `/recommendations/places`) these codes also appear inside per-item `warnings` entries without failing the whole request.

---

## Running Unit Tests

Tests use Node's built-in `node:test` runner, so no extra test framework is needed:

```bash
npm test
```

Coverage report (lines, functions, branches):

```bash
npm run test:coverage
```

On Windows PowerShell, if `npm` is blocked by script execution policy, use `npm.cmd test` / `npm.cmd run test:coverage` instead.

The suite covers the shared utilities, response formatting, SQL query boundaries, app structure, ML client behavior, and API route behavior with a mocked Supabase pool — so it runs without a real database or ML service.

---

## Tech Stack

- Runtime: Node.js 20.9+
- HTTP API: Express 5
- Authentication: Clerk via `@clerk/express`
- Database: Supabase-hosted PostgreSQL through `pg`
- ML integration: FastAPI service (`zentra-ml`) over HTTP with automatic fallback
- Config: `dotenv`
