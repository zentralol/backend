# Zentra Backend

Express.js API server for Zentra. The backend exposes the public API used by the web and mobile clients, calls the FastAPI ML service when available, and uses Supabase as a hosted PostgreSQL database.

## What Supabase Is Used For

This backend uses **Supabase PostgreSQL** only.

Current usage:

- `h3_grid_scores`: read H3 crowd prediction data for fallback predictions, forecasts, heatmaps, and recommendations.
- `h3_grid_cells`: read H3 cell centroids for ML-backed heatmap generation.
- `prediction_requests`: write prediction request logs and read admin prediction statistics.
- `feedback`: write user feedback and support future feedback analytics.
- PostgreSQL functions in `supabase/migrations`: keep complex H3 query logic inside the database instead of writing large SQL blocks in route handlers.

The backend does **not** expose Supabase keys to frontend or mobile clients. Clients call the Express API only.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (LTS recommended)
- [Git](https://git-scm.com/)
- Access to the Zentra Supabase project database
- Optional: access to the FastAPI ML service

## Install dependencies

```bash
npm install
```

## Environment variables

The app reads configuration from a `.env` file at startup through `dotenv`. This file is not committed to git.

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | HTTP port. Defaults to `3000`. |
| `DATABASE_URL` | Yes | Supabase PostgreSQL connection string for `pg`. |
| `ML_API_BASE_URL` | No | FastAPI ML service base URL, for example `http://localhost:8000`. |
| `ML_API_TIMEOUT_MS` | No | Timeout for ML requests. Defaults to `5000`. |

### Supabase `DATABASE_URL`

In Supabase Dashboard -> Project Settings -> Database -> Connection string, choose URI and copy the direct PostgreSQL connection string.

```env
DATABASE_URL=postgresql://postgres:<YOUR-PASSWORD>@db.<project-ref>.supabase.co:5432/postgres
```

## Apply Supabase Database Functions

Complex H3 read queries are stored as PostgreSQL functions in:

```text
supabase/migrations/20260707000000_backend_query_functions.sql
```

Apply this SQL in Supabase before running endpoints that depend on H3 prediction data. You can paste it into the Supabase SQL Editor, or apply it through the Supabase CLI if the project is linked.

These functions are used by the backend repository layer:

| Function | Backend purpose |
|----------|-----------------|
| `zentra_get_heatmap_scores` | Heatmap fallback data |
| `zentra_get_nearest_prediction_score` | Single and batch prediction fallback |
| `zentra_get_nearest_h3_cell` | Forecast H3 cell lookup |
| `zentra_get_forecast_scores` | Coordinate forecast data |
| `zentra_get_quieter_nearby_scores` | Quieter nearby area recommendations |

## Run locally

```bash
npm start
```

Or:

```bash
node server.js
```

You should see:

```text
Zentra Backend Server running on http://localhost:3000
```

## Verify the server

Health check:

```bash
curl http://localhost:3000/api/v1/health
```

Single prediction:

```bash
curl -X POST http://localhost:3000/api/v1/predictions \
  -H "Content-Type: application/json" \
  -d '{"lat":40.758,"lng":-73.9855,"targetTime":"2026-07-01T16:30:00-04:00","durationMinutes":60}'
```

Heatmap from database fallback:

```bash
curl "http://localhost:3000/api/v1/map/heatmap?limit=3&source=database"
```

## Run tests

Unit tests use Node's built-in `node:test` runner, so no extra test framework is required.

```bash
npm test
```

On Windows PowerShell, if `npm` is blocked by script execution policy, run:

```powershell
npm.cmd test
```

Current tests cover shared utility functions, response formatting, SQL query boundaries, app structure, ML client behavior, and API route behavior with a mocked Supabase pool.

To check the 80% coverage target for lines, functions, and branches, run:

```powershell
npm.cmd run test:coverage
```
## API documentation

Full request/response contract: [`docs/api-contract.md`](docs/api-contract.md).

Implemented endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Service and database health |
| `POST` | `/api/v1/predictions` | Single coordinate crowd prediction |
| `POST` | `/api/v1/predictions/batch` | Batch coordinate crowd predictions |
| `GET` | `/api/v1/predictions/forecast` | Forecast for one coordinate |
| `GET` | `/api/v1/map/heatmap` | H3 heatmap points |
| `POST` | `/api/v1/recommendations` | Quieter nearby H3 area recommendations |
| `POST` | `/api/v1/feedback` | Store prediction feedback |
| `GET` | `/api/v1/admin/stats/predictions` | Prediction request statistics |

## Project structure

```text
backend/
├── server.js
├── src/
│   ├── app.js
│   ├── config/
│   ├── repositories/
│   │   └── sql/
│   ├── routes/
│   ├── services/
│   └── utils/
├── supabase/
│   └── migrations/
├── docs/
│   └── api-contract.md
└── package.json
```

## Tech stack

- Runtime: Node.js
- HTTP API: Express 5
- Database: Supabase-hosted PostgreSQL through `pg`
- ML integration: FastAPI service through HTTP
- Config: `dotenv`


