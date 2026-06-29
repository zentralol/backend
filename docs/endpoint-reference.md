# Zentra Endpoint Reference

This is the quick reference file for aligning the web frontend, mobile app, and backend around the same API logic.

For the full contract, examples, validation rules, and ML handoff details, see [`api-contract.md`](./api-contract.md).

Last reviewed against backend implementation: 2026-06-29

## How to use this file

- Use this file when frontend/mobile teammates need a fast answer to “which endpoint do I call?”
- Use `api-contract.md` when backend/ML teammates need full response shapes, validation rules, or implementation notes.
- Do not treat planned endpoints as already available in the backend.

## Base API

```text
Local: /api/v1
Example local URL: http://localhost:3000/api/v1
```

All public API responses should use this wrapper:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "generatedAt": "2026-06-29T12:00:00Z"
  }
}
```

Errors should use this wrapper:

```json
{
  "success": false,
  "error": {
    "code": "LOCATION_NOT_FOUND",
    "message": "Location not found"
  },
  "meta": {
    "generatedAt": "2026-06-29T12:00:00Z"
  }
}
```

## Important shared conventions

### Location IDs

Use OpenStreetMap IDs as the public `locationId`.

Example:

```json
{
  "id": "123456",
  "externalId": "osm_123456"
}
```

Frontend and mobile should not depend on internal database IDs.

### Current location shape

The current backend returns this shape for locations:

```json
{
  "id": "123456",
  "externalId": "osm_123456",
  "name": "Times Square",
  "type": "attraction",
  "coordinates": {
    "lat": 40.758,
    "lng": -73.9855
  },
  "zoneId": "zone_midtown"
}
```

Planned enrichment fields include `address`, `borough`, `distanceMeters`, `tags`, `accessibility`, `openingHours`, `source`, and `updatedAt`.

### Sessions

Sessions are optional for MVP. Frontend/mobile can pass user preferences inline as `userContext` when calling prediction or recommendation endpoints.

## Endpoint summary

| Method | Path | State | Use |
|---|---|---|---|
| GET | `/health` | Implemented | Check API/database status |
| GET | `/locations/search` | Implemented | Search places by name/category |
| GET | `/locations/{locationId}` | Implemented | Get one place by location ID |
| GET | `/locations/nearby` | Planned MVP | Find places near a coordinate |
| POST | `/predictions` | Planned MVP | Predict busyness for one place/time |
| POST | `/predictions/batch` | Planned MVP | Predict busyness for many places |
| GET | `/locations/{locationId}/forecast` | Planned MVP | Get busyness across a time range |
| POST | `/recommendations` | Planned MVP | Suggest quieter times/places |
| POST | `/explanations` | Planned MVP | Generate user-friendly explanation |
| POST | `/feedback` | Planned MVP | Collect user feedback |
| POST | `/sessions` | Optional MVP | Create anonymous preference session |
| PUT | `/sessions/{sessionId}/preferences` | Optional MVP | Update session preferences |
| GET | `/map/heatmap` | Optional MVP | Convenience endpoint for map heatmap |

Future endpoints such as chat, safety-aware routing, and admin stats are documented in `api-contract.md`, but should not block MVP work.

## Implemented endpoints

### Health check

```http
GET /api/v1/health
```

Use this to check whether the backend and database connection are available.

Example response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "apiVersion": "v1",
    "database": "connected",
    "uptimeSeconds": 3600
  },
  "meta": {
    "generatedAt": "2026-06-29T12:00:00Z"
  }
}
```

### Search locations

```http
GET /api/v1/locations/search?q=museum&type=museum&limit=10
```

Query parameters:

| Name | Required | Notes |
|---|---:|---|
| `q` | No | Search text. Current backend allows empty search, but UI should normally send a query. |
| `type` | No | Location category filter, for example `museum`, `park`, or `cafe`. |
| `limit` | No | Default `10`, max `50`. |

Example response:

```json
{
  "success": true,
  "data": {
    "query": "museum",
    "results": [
      {
        "id": "123456",
        "externalId": "osm_123456",
        "name": "Museum of Modern Art",
        "type": "museum",
        "coordinates": {
          "lat": 40.7614,
          "lng": -73.9776
        },
        "zoneId": "zone_midtown"
      }
    ]
  },
  "meta": {
    "generatedAt": "2026-06-29T12:00:00Z"
  }
}
```

### Get location detail

```http
GET /api/v1/locations/123456
```

Use the public `locationId`, which is currently the OpenStreetMap ID as a string.

Example response:

```json
{
  "success": true,
  "data": {
    "location": {
      "id": "123456",
      "externalId": "osm_123456",
      "name": "Times Square",
      "type": "attraction",
      "coordinates": {
        "lat": 40.758,
        "lng": -73.9855
      },
      "zoneId": "zone_midtown"
    }
  },
  "meta": {
    "generatedAt": "2026-06-29T12:00:00Z"
  }
}
```

## Planned MVP endpoint notes

These endpoints are target shapes for the product flow, but are not implemented yet.

### Predict busyness

```http
POST /api/v1/predictions
```

Minimum request shape:

```json
{
  "locationId": "123456",
  "targetTime": "2026-07-01T15:00:00-04:00",
  "durationMinutes": 60,
  "userContext": {
    "crowdSensitivity": "high",
    "mobilityNeeds": ["step_free"],
    "preferredLanguage": "en"
  }
}
```

Expected response should include:

- `predictionId`
- `locationId`
- `targetTime`
- `busynessScore`
- `busynessLevel`
- `confidence`
- `modelVersion`

### Forecast

```http
GET /api/v1/locations/{locationId}/forecast?startTime={iso}&endTime={iso}&intervalMinutes=60
```

Use this for showing quiet/busy periods across a day.

### Recommendations

```http
POST /api/v1/recommendations
```

Use this for quieter time or nearby place suggestions.

Recommendation types:

- `quieter_time`
- `nearby_place`
- `route_adjustment`

### Explanations

```http
POST /api/v1/explanations
```

Use this for a user-friendly explanation of a prediction. Explanations should be grounded in prediction factors and include a prediction disclaimer.

### Feedback

```http
POST /api/v1/feedback
```

Use this to collect whether a prediction or recommendation was useful.

Minimum useful fields:

```json
{
  "locationId": "123456",
  "predictionId": "pred_123",
  "rating": 4,
  "wasUseful": true,
  "actualBusynessLevel": "busy",
  "clientType": "mobile"
}
```

## Web/mobile integration guidance

Frontend and mobile can safely integrate these now:

1. Search locations.
2. Load location detail.
3. Store/use `locationId` as a string.

Frontend and mobile should mock these until backend implementation is ready:

1. Prediction responses.
2. Forecast responses.
3. Recommendation responses.
4. Explanation responses.
5. Feedback submission success.

Do not call internal ML endpoints from web or mobile clients.
