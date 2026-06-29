# Zentra API Contract v1.0 - Project API Contract

Project: COMP47360 Team 10 - Zentra  
Backend scope: Express.js API, PostgreSQL, prediction/ML integration, GenAI explanation integration  
Clients: Web frontend, SwiftUI mobile app, optional admin/planning view  
Contract status: Team-facing API contract with current implementation notes
Last reviewed against backend implementation: 2026-06-29

## 1. Project Scope

This contract defines the API surface needed for the Zentra project. It is both:

- the target API shape that frontend, mobile, backend, ML, and product teammates can plan around; and
- a snapshot of what the current Express backend already implements.

The backend currently implements only the health check, location search, and location detail endpoints. The remaining MVP endpoints are planned contract targets, not proof that code exists yet.

### Product priority

| Status | Meaning |
|---|---|
| `MVP_REQUIRED` | Core MVP endpoint needed for the main product flow |
| `MVP_OPTIONAL` | Useful product endpoint, but not required for the core flow |
| `FUTURE` | Full-project extension endpoint for later implementation |
| `INTERNAL` | Backend-to-ML or backend-only service contract |

### Implementation state

| State | Meaning |
|---|---|
| `IMPLEMENTED` | Available in the current Express backend |
| `PLANNED` | Target API shape, but not implemented yet |
| `FUTURE_SCOPE` | Later product extension, not needed for MVP |
| `INTERNAL_OPTION` | Optional backend-to-ML boundary; not called by web/mobile clients |

API count:

| Group | Count | Notes |
|---|---:|---|
| Current implemented public endpoints | 3 | Health, location search, and location detail |
| Required public MVP target endpoints | 10 | Main web/mobile product flow; includes implemented endpoints |
| Optional public MVP target endpoints | 3 | Useful, but should not block the core flow |
| Future/admin endpoints | 3 | Shared for full-project planning |
| Internal ML integration options | 2 | Optional backend-to-ML service boundary; file-based handoff is also supported |

Target counts include endpoints that may already be implemented. Use the endpoint summary table below to see current implementation state.

## 2. Base URLs

```text
Local API:     http://localhost:3000/api/v1
Staging API:   https://staging.zentra.example.com/api/v1
Production:    https://api.zentra.example.com/api/v1
```

All requests and responses use JSON.

```http
Content-Type: application/json
Accept: application/json
```

Common optional headers:

```http
Accept-Language: en
X-Request-Id: req_client_generated_uuid
Authorization: Bearer <token>
```


## 3. Common Response Format

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "req_123",
    "generatedAt": "2026-06-25T12:00:00Z"
  }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TIME_RANGE",
    "message": "startTime must be before endTime.",
    "details": {
      "field": "startTime"
    }
  },
  "meta": {
    "requestId": "req_123"
  }
}
```

Pagination:

```json
{
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 148,
    "hasMore": true
  }
}
```

## 4. Standard HTTP Status Codes

| Status | Use |
|---:|---|
| 200 | Successful read/action |
| 201 | Resource created |
| 202 | Job accepted |
| 400 | Invalid JSON/body/query |
| 401 | Auth required or invalid |
| 403 | Auth valid but role not allowed |
| 404 | Resource not found |
| 409 | Conflict or duplicate |
| 422 | Valid JSON but invalid business input |
| 429 | Rate limited |
| 500 | Unexpected server error |
| 503 | Database, ML service, or GenAI service unavailable |

## 5. Shared Enums

```ts
type BusynessLevel =
  | "very_quiet"
  | "quiet"
  | "moderate"
  | "busy"
  | "very_busy";

type LocationType =
  | "attraction"
  | "cafe"
  | "restaurant"
  | "museum"
  | "park"
  | "transport"
  | "neighborhood"
  | "other";

type RecommendationType =
  | "quieter_time"
  | "nearby_place"
  | "route_adjustment";

type TravelStyle =
  | "relaxed"
  | "balanced"
  | "fast"
  | "work_friendly"
  | "family";

type MobilityNeed =
  | "wheelchair"
  | "step_free"
  | "low_walking"
  | "driving_needed"
  | "none";

type Sensitivity = "low" | "medium" | "high";
type TransportMode = "walk" | "transit" | "bike" | "drive";
type ClientType = "web" | "mobile" | "admin" | "unknown";
```
## 5.1 Database Notes

The database schema is still evolving and is not part of the public API contract.

The backend is responsible for mapping database fields to the API response shape. Frontend and mobile clients should only depend on the API fields defined in this contract, not on database table names or column names.

Prediction-related storage will be defined after Data & ML provides the final prediction output format.

## 6. Shared Data Models

### 6.1 Coordinates

```json
{
  "lat": 40.758,
  "lng": -73.9855
}
```

Validation:

- `lat`: number, -90 to 90
- `lng`: number, -180 to 180
- Public MVP endpoints should reject unsupported coordinates outside Manhattan.

### 6.2 AccessibilityInfo

```json
{
  "wheelchairAccessible": true,
  "stepFreeAccess": true,
  "accessibleTransitNearby": true,
  "dataConfidence": "medium",
  "notes": "Accessibility data may be incomplete."
}
```

### 6.3 LocationSummary

Current backend response:

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

Planned enriched fields, when data is available:

- `address`
- `borough`
- `distanceMeters`

### 6.4 LocationDetail

Current backend response:

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

Planned enriched location detail fields:

```json
{
  "tags": ["tourist", "outdoor", "landmark"],
  "accessibility": {
    "wheelchairAccessible": true,
    "stepFreeAccess": true,
    "accessibleTransitNearby": true,
    "dataConfidence": "medium",
    "notes": "Accessibility data may be incomplete."
  },
  "openingHours": null,
  "source": "openstreetmap",
  "updatedAt": "2026-06-25T12:00:00Z"
}
```

### 6.5 UserContext

This object can be passed inline to prediction/recommendation endpoints. For the MVP, it does not require a real user account.

```json
{
  "sessionId": "sess_123",
  "groupSize": 2,
  "travelStyle": "relaxed",
  "crowdSensitivity": "high",
  "noiseSensitivity": "medium",
  "mobilityNeeds": ["step_free"],
  "dietaryRestrictions": ["vegetarian"],
  "preferredLanguage": "en",
  "transportModes": ["walk", "transit"]
}
```

### 6.6 BusynessPrediction

```json
{
  "predictionId": "pred_123",
  "locationId": "123456",
  "targetTime": "2026-07-01T15:00:00-04:00",
  "durationMinutes": 60,
  "busynessScore": 82,
  "busynessLevel": "very_busy",
  "confidence": 0.78,
  "baselineScore": 64,
  "factors": [
    {
      "name": "time_of_day",
      "label": "Time of day",
      "impact": "high",
      "direction": "increase"
    }
  ],
  "modelVersion": "busyness-v0.1",
  "cached": true,
  "dataFreshness": {
    "lastUpdated": "2026-06-25T10:00:00Z",
    "sources": ["poi", "weather", "transport", "historical_patterns"]
  }
}
```

Score interpretation:

| Score | Level | UI label |
|---:|---|---|
| 0-20 | `very_quiet` | Very quiet |
| 21-40 | `quiet` | Quiet |
| 41-60 | `moderate` | Moderate |
| 61-80 | `busy` | Busy |
| 81-100 | `very_busy` | Very busy |

### 6.7 Recommendation

```json
{
  "id": "rec_123",
  "type": "nearby_place",
  "title": "Try Bryant Park instead",
  "reason": "It is nearby and predicted to be less crowded at the selected time.",
  "location": {
    "id": "654321",
    "name": "Bryant Park",
    "type": "park",
    "coordinates": {
      "lat": 40.7536,
      "lng": -73.9832
    }
  },
  "targetTime": "2026-07-01T15:00:00-04:00",
  "estimatedBusynessScore": 46,
  "estimatedBusynessLevel": "moderate",
  "distanceMeters": 900,
  "accessibilityMatch": true
}
```

## 7. Endpoint Summary

| # | Method | Path | Product priority | Implementation state | Main client |
|---:|---|---|---|---|---|
| 1 | GET | `/health` | `MVP_REQUIRED` | `IMPLEMENTED` | All |
| 2 | GET | `/locations/search` | `MVP_REQUIRED` | `IMPLEMENTED` | Web/mobile |
| 3 | GET | `/locations/{locationId}` | `MVP_REQUIRED` | `IMPLEMENTED` | Web/mobile |
| 4 | GET | `/locations/nearby` | `MVP_REQUIRED` | `PLANNED` | Web/mobile map |
| 5 | POST | `/predictions` | `MVP_REQUIRED` | `PLANNED` | Web/mobile |
| 6 | POST | `/predictions/batch` | `MVP_REQUIRED` | `PLANNED` | Map/heatmap |
| 7 | GET | `/locations/{locationId}/forecast` | `MVP_REQUIRED` | `PLANNED` | Web/mobile |
| 8 | POST | `/recommendations` | `MVP_REQUIRED` | `PLANNED` | Web/mobile |
| 9 | POST | `/explanations` | `MVP_REQUIRED` | `PLANNED` | Web/mobile |
| 10 | POST | `/feedback` | `MVP_REQUIRED` | `PLANNED` | Web/mobile |
| 11 | POST | `/sessions` | `MVP_OPTIONAL` | `PLANNED` | Web/mobile |
| 12 | GET | `/map/heatmap` | `MVP_OPTIONAL` | `PLANNED` | Web map |
| 13 | PUT | `/sessions/{sessionId}/preferences` | `MVP_OPTIONAL` | `PLANNED` | Web/mobile |
| 14 | POST | `/chat/messages` | `FUTURE` | `FUTURE_SCOPE` | Web/mobile |
| 15 | POST | `/routes/safety-aware` | `FUTURE` | `FUTURE_SCOPE` | Mobile |
| 16 | GET | `/admin/stats/predictions` | `FUTURE` | `FUTURE_SCOPE` | Admin |
| 17 | POST | `/internal/ml/predict-busyness` | `INTERNAL` | `INTERNAL_OPTION` | Backend |
| 18 | POST | `/internal/ml/predict-busyness-batch` | `INTERNAL` | `INTERNAL_OPTION` | Backend |

## 8. Public MVP Target Endpoints

### 8.1 Health Check

`GET /health`

Status: `MVP_REQUIRED`

Implementation state: `IMPLEMENTED`

Response `200`:

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
    "generatedAt": "2026-06-25T12:00:00Z"
  }
}
```

Note: `predictionService` should be added only after the ML integration has a service or batch job health signal.

### 8.2 Create Anonymous Session

`POST /sessions`

Status: `MVP_OPTIONAL`

Implementation state: `PLANNED`

Purpose:

- Store temporary onboarding/preferences without user accounts.
- Allows recommendation and explanation endpoints to personalize responses.

MVP note:

- This should not block the core prediction flow because `UserContext` can be passed inline to prediction and recommendation endpoints.
- Implement this when the app needs persistent onboarding state, preference updates, or multi-step sessions.

Request:

```json
{
  "clientType": "mobile",
  "preferredLanguage": "en",
  "preferences": {
    "groupSize": 2,
    "travelStyle": "relaxed",
    "crowdSensitivity": "high",
    "noiseSensitivity": "medium",
    "mobilityNeeds": ["step_free"],
    "dietaryRestrictions": [],
    "transportModes": ["walk", "transit"]
  }
}
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_123",
    "expiresAt": "2026-06-26T12:00:00Z",
    "preferences": {
      "groupSize": 2,
      "travelStyle": "relaxed",
      "crowdSensitivity": "high",
      "noiseSensitivity": "medium",
      "mobilityNeeds": ["step_free"],
      "dietaryRestrictions": [],
      "preferredLanguage": "en",
      "transportModes": ["walk", "transit"]
    }
  }
}
```

Validation:

- `clientType`: optional, default `unknown`
- `groupSize`: optional, integer 1-20
- `preferredLanguage`: optional, default `en`

### 8.3 Search Locations

`GET /locations/search?q={query}&type={type}&limit={limit}&lat={lat}&lng={lng}`

Status: `MVP_REQUIRED`

Implementation state: `IMPLEMENTED`

Query parameters:

| Name | Required | Example | Rule |
|---|---:|---|---|
| `q` | no in current backend; recommended for UX | `museum` | Current backend allows empty search; target UX should use 2-100 characters |
| `type` | no | `cafe` | Must be `LocationType` |
| `limit` | no | `10` | Default 10, max 50 |
| `lat` | no | `40.758` | Planned for distance sorting; not used by current backend |
| `lng` | no | `-73.9855` | Planned for distance sorting; not used by current backend |

Response `200`:

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
  }
}
```

Planned enriched response fields:

- `address`
- `borough`
- `distanceMeters`, when `lat` and `lng` are supported

Errors:

- `400 INVALID_QUERY`
- `400 INVALID_LOCATION_TYPE`
- `422 OUTSIDE_SUPPORTED_AREA`

### 8.4 Get Location Detail

`GET /locations/{locationId}`

Status: `MVP_REQUIRED`

Implementation state: `IMPLEMENTED`

Response `200`:

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
  }
}
```

Planned enriched response fields:

- `address`
- `borough`
- `tags`
- `accessibility`
- `openingHours`
- `source`
- `updatedAt`

Errors:

- `404 LOCATION_NOT_FOUND`

### 8.5 Get Nearby Locations

`GET /locations/nearby?lat={lat}&lng={lng}&radiusMeters={radius}&type={type}&limit={limit}`

Status: `MVP_REQUIRED`

Implementation state: `PLANNED`

Query parameters:

| Name | Required | Example | Rule |
|---|---:|---|---|
| `lat` | yes | `40.758` | Manhattan supported area |
| `lng` | yes | `-73.9855` | Manhattan supported area |
| `radiusMeters` | no | `1000` | Default 1000, max 5000 |
| `type` | no | `park` | Optional location type |
| `limit` | no | `20` | Default 20, max 100 |

Response `200`:

```json
{
  "success": true,
  "data": {
    "center": {
      "lat": 40.758,
      "lng": -73.9855
    },
    "radiusMeters": 1000,
    "results": [
      {
        "id": "654321",
        "name": "Bryant Park",
        "type": "park",
        "address": "New York, NY",
        "coordinates": {
          "lat": 40.7536,
          "lng": -73.9832
        },
        "distanceMeters": 900
      }
    ]
  }
}
```

### 8.6 Predict Busyness For One Location

`POST /predictions`

Status: `MVP_REQUIRED`

Implementation state: `PLANNED`

Request:

```json
{
  "locationId": "123456",
  "targetTime": "2026-07-01T15:00:00-04:00",
  "durationMinutes": 60,
  "userContext": {
    "sessionId": "sess_123",
    "crowdSensitivity": "high",
    "noiseSensitivity": "medium",
    "mobilityNeeds": ["step_free"],
    "preferredLanguage": "en"
  }
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "prediction": {
      "predictionId": "pred_123",
      "locationId": "123456",
      "targetTime": "2026-07-01T15:00:00-04:00",
      "durationMinutes": 60,
      "busynessScore": 82,
      "busynessLevel": "very_busy",
      "confidence": 0.78,
      "baselineScore": 64,
      "factors": [
        {
          "name": "time_of_day",
          "label": "Time of day",
          "impact": "high",
          "direction": "increase"
        }
      ],
      "modelVersion": "busyness-v0.1",
      "cached": true,
      "dataFreshness": {
        "lastUpdated": "2026-06-25T10:00:00Z",
        "sources": ["poi", "weather", "transport", "historical_patterns"]
      }
    }
  },
  "meta": {
    "modelVersion": "busyness-v0.1",
    "generatedAt": "2026-06-25T12:00:00Z"
  }
}
```

Validation:

- `locationId`: required
- `targetTime`: required ISO 8601; backend should normalize to New York timezone for model features
- `durationMinutes`: optional, default 60, allowed 15-240

Errors:

- `404 LOCATION_NOT_FOUND`
- `422 OUTSIDE_SUPPORTED_AREA`
- `503 MODEL_SERVICE_UNAVAILABLE`
- `503 PREDICTION_UNAVAILABLE`

### 8.7 Batch Predict For Map / Heatmap

`POST /predictions/batch`

Status: `MVP_REQUIRED`

Implementation state: `PLANNED`

Request:

```json
{
  "locationIds": ["123456", "654321", "789012"],
  "targetTime": "2026-07-01T15:00:00-04:00",
  "durationMinutes": 60,
  "userContext": {
    "sessionId": "sess_123",
    "crowdSensitivity": "high",
    "mobilityNeeds": ["step_free"]
  }
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "targetTime": "2026-07-01T15:00:00-04:00",
    "predictions": [
      {
        "predictionId": "pred_123",
        "locationId": "123456",
        "busynessScore": 82,
        "busynessLevel": "very_busy",
        "confidence": 0.78,
        "modelVersion": "busyness-v0.1"
      },
      {
        "predictionId": "pred_456",
        "locationId": "654321",
        "busynessScore": 46,
        "busynessLevel": "moderate",
        "confidence": 0.71,
        "modelVersion": "busyness-v0.1"
      }
    ],
    "warnings": [
      {
        "locationId": "789012",
        "code": "PREDICTION_UNAVAILABLE",
        "message": "Prediction not available for this location."
      }
    ]
  }
}
```

Validation:

- `locationIds`: required, 1-100 IDs
- Return partial success where possible.

### 8.8 Get Location Forecast

`GET /locations/{locationId}/forecast?startTime={iso}&endTime={iso}&intervalMinutes={interval}`

Status: `MVP_REQUIRED`

Implementation state: `PLANNED`

Use case:

- Show quiet/busy periods across the day.
- Support "go later" or "go earlier" recommendations.

Response `200`:

```json
{
  "success": true,
  "data": {
    "locationId": "123456",
    "startTime": "2026-07-01T09:00:00-04:00",
    "endTime": "2026-07-01T21:00:00-04:00",
    "intervalMinutes": 60,
    "points": [
      {
        "time": "2026-07-01T09:00:00-04:00",
        "busynessScore": 38,
        "busynessLevel": "quiet",
        "confidence": 0.74
      },
      {
        "time": "2026-07-01T15:00:00-04:00",
        "busynessScore": 82,
        "busynessLevel": "very_busy",
        "confidence": 0.78
      }
    ]
  }
}
```

Validation:

- Max forecast window: 7 days
- `intervalMinutes`: 30, 60, or 120

### 8.9 Get Quieter Recommendations

`POST /recommendations`

Status: `MVP_REQUIRED`

Implementation state: `PLANNED`

Request:

```json
{
  "locationId": "123456",
  "targetTime": "2026-07-01T15:00:00-04:00",
  "recommendationTypes": ["quieter_time", "nearby_place"],
  "maxResults": 5,
  "userContext": {
    "sessionId": "sess_123",
    "travelStyle": "relaxed",
    "crowdSensitivity": "high",
    "noiseSensitivity": "medium",
    "mobilityNeeds": ["step_free"],
    "transportModes": ["walk", "transit"],
    "preferredLanguage": "en"
  }
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "originalPrediction": {
      "predictionId": "pred_123",
      "locationId": "123456",
      "busynessScore": 82,
      "busynessLevel": "very_busy",
      "confidence": 0.78
    },
    "recommendations": [
      {
        "id": "rec_time_1",
        "type": "quieter_time",
        "title": "Go around 10:00 instead",
        "reason": "The forecast is lower in the morning.",
        "targetTime": "2026-07-01T10:00:00-04:00",
        "estimatedBusynessScore": 44,
        "estimatedBusynessLevel": "moderate",
        "accessibilityMatch": true
      },
      {
        "id": "rec_place_1",
        "type": "nearby_place",
        "title": "Try Bryant Park instead",
        "reason": "It is nearby and predicted to be less crowded.",
        "location": {
          "id": "654321",
          "name": "Bryant Park",
          "type": "park",
          "coordinates": {
            "lat": 40.7536,
            "lng": -73.9832
          }
        },
        "targetTime": "2026-07-01T15:00:00-04:00",
        "estimatedBusynessScore": 46,
        "estimatedBusynessLevel": "moderate",
        "distanceMeters": 900,
        "accessibilityMatch": true
      }
    ]
  }
}
```

Recommendation rules for the MVP:

- `quieter_time`: compare same location across forecast window.
- `nearby_place`: compare nearby locations within 1-2 km.
- Respect accessibility filters where data exists.
- If accessibility data is missing, return `accessibilityMatch: null` or include a warning.

### 8.10 Generate AI Explanation

`POST /explanations`

Status: `MVP_REQUIRED`

Implementation state: `PLANNED`

Request:

```json
{
  "locationId": "123456",
  "targetTime": "2026-07-01T15:00:00-04:00",
  "predictionId": "pred_123",
  "language": "en",
  "readingLevel": "simple",
  "userContext": {
    "sessionId": "sess_123",
    "crowdSensitivity": "high",
    "mobilityNeeds": ["step_free"]
  }
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "explanation": {
      "summary": "Times Square is expected to be very busy in the afternoon.",
      "reasons": [
        "This is usually a high-traffic time for tourist visits.",
        "Nearby transport activity is expected to increase footfall."
      ],
      "suggestedAction": "If you prefer a calmer visit, try going earlier in the morning or choosing a nearby park.",
      "disclaimer": "This is a prediction, not a live crowd count."
    }
  },
  "meta": {
    "modelVersion": "busyness-v0.1",
    "aiProvider": "server_configured"
  }
}
```

Implementation rules:

- Explanation must be grounded in prediction factors.
- Do not send raw model internals directly to the frontend.
- Always include a prediction disclaimer.
- If GenAI fails, backend may return a template explanation instead of failing the whole flow.

### 8.11 Submit User Feedback

`POST /feedback`

Status: `MVP_REQUIRED`

Implementation state: `PLANNED`

Request:

```json
{
  "sessionId": "sess_123",
  "locationId": "123456",
  "predictionId": "pred_123",
  "recommendationId": "rec_place_1",
  "rating": 4,
  "wasUseful": true,
  "actualBusynessLevel": "busy",
  "comment": "The suggestion was helpful but the subway nearby was still crowded.",
  "clientType": "mobile"
}
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "feedbackId": "fb_123",
    "receivedAt": "2026-06-25T12:05:00Z"
  }
}
```

Validation:

- `rating`: optional integer 1-5
- `wasUseful`: optional boolean
- `actualBusynessLevel`: optional `BusynessLevel`
- `comment`: optional, max 1000 characters
- At least one of `rating`, `wasUseful`, `actualBusynessLevel`, or `comment` should be present.

### 8.12 Map Heatmap

`GET /map/heatmap?north={n}&south={s}&east={e}&west={w}&targetTime={iso}&type={type}`

Status: `MVP_OPTIONAL`

Implementation state: `PLANNED`

Purpose:

- Convenience endpoint for web map. If not implemented, frontend can call `/locations/nearby` then `/predictions/batch`.

Response `200`:

```json
{
  "success": true,
  "data": {
    "targetTime": "2026-07-01T15:00:00-04:00",
    "bounds": {
      "north": 40.79,
      "south": 40.72,
      "east": -73.93,
      "west": -74.02
    },
    "points": [
      {
        "locationId": "123456",
        "name": "Times Square",
        "type": "attraction",
        "coordinates": {
          "lat": 40.758,
          "lng": -73.9855
        },
        "busynessScore": 82,
        "busynessLevel": "very_busy"
      }
    ]
  }
}
```

## 9. Optional / Future Endpoints

### 9.1 Update Session Preferences

`PUT /sessions/{sessionId}/preferences`

Status: `MVP_OPTIONAL`

Implementation state: `PLANNED`

Request:

```json
{
  "groupSize": 3,
  "travelStyle": "work_friendly",
  "crowdSensitivity": "high",
  "noiseSensitivity": "high",
  "mobilityNeeds": ["step_free"],
  "dietaryRestrictions": ["vegetarian"],
  "preferredLanguage": "en",
  "transportModes": ["walk", "transit"]
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "sessionId": "sess_123",
    "preferences": {
      "groupSize": 3,
      "travelStyle": "work_friendly",
      "crowdSensitivity": "high",
      "noiseSensitivity": "high",
      "mobilityNeeds": ["step_free"],
      "dietaryRestrictions": ["vegetarian"],
      "preferredLanguage": "en",
      "transportModes": ["walk", "transit"]
    },
    "updatedAt": "2026-06-25T12:10:00Z"
  }
}
```

### 9.2 Conversational Planning Chat

`POST /chat/messages`

Status: `FUTURE`

Implementation state: `FUTURE_SCOPE`

Request:

```json
{
  "sessionId": "sess_123",
  "message": "I want somewhere quiet to work near Midtown after lunch.",
  "context": {
    "lat": 40.7549,
    "lng": -73.984,
    "targetTime": "2026-07-01T14:00:00-04:00"
  }
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "reply": "Here are quieter work-friendly options near Midtown for 2 PM.",
    "suggestedLocations": ["654321", "789012"],
    "suggestedActions": ["view_recommendations", "open_map"]
  }
}
```

### 9.3 Safety-Aware Route Suggestion

`POST /routes/safety-aware`

Status: `FUTURE`

Implementation state: `FUTURE_SCOPE`

Request:

```json
{
  "origin": {
    "lat": 40.758,
    "lng": -73.9855
  },
  "destinationLocationId": "654321",
  "targetTime": "2026-07-01T21:00:00-04:00",
  "transportModes": ["walk", "transit"],
  "userContext": {
    "sessionId": "sess_123",
    "travelStyle": "relaxed",
    "mobilityNeeds": ["step_free"],
    "crowdSensitivity": "high"
  }
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "routes": [
      {
        "id": "route_123",
        "mode": "walk",
        "durationMinutes": 18,
        "distanceMeters": 1300,
        "crowdLevel": "moderate",
        "safetyNotes": ["Well-lit route preferred where data is available."],
        "accessibilityNotes": ["Step-free information may be incomplete."],
        "geometry": {
          "type": "LineString",
          "coordinates": [
            [-73.9855, 40.758],
            [-73.9832, 40.7536]
          ]
        }
      }
    ]
  }
}
```

### 9.4 Admin Prediction Statistics

`GET /admin/stats/predictions?startDate={date}&endDate={date}`

Status: `FUTURE`

Implementation state: `FUTURE_SCOPE`

Response `200`:

```json
{
  "success": true,
  "data": {
    "totalPredictionRequests": 1200,
    "averageLatencyMs": 180,
    "cacheHitRate": 0.64,
    "mostRequestedLocations": [
      {
        "locationId": "123456",
        "name": "Times Square",
        "count": 210
      }
    ],
    "feedbackAverageRating": 4.1
  }
}
```

## 10. ML Integration Contract

The public API does not require the ML component to run as a REST service. Web and mobile clients should only call the public backend endpoints such as `/predictions`, `/locations/{locationId}/forecast`, and `/recommendations`.

For the team handoff, Data & ML Lead can provide the prediction layer in one of three supported formats:

| Option | ML deliverable | Backend work |
|---|---|---|
| A | Precomputed prediction CSV files | Import CSV into PostgreSQL `prediction_cache`; Express reads from DB |
| B | Model artifact such as `.pkl`, `.joblib`, or `.pt` plus feature schema | Backend calls a small Python prediction script or scheduled batch job |
| C | Python REST service using Flask/FastAPI | Express calls ML service over HTTP |


### 10.1 Option A - Precomputed Prediction CSV Handoff

Status: `INTERNAL`

Implementation state: `INTERNAL_OPTION`

ML deliverable:

```text
data/predictions/prediction_cache.csv
```

Required CSV columns:

| Column | Type | Example | Notes |
|---|---|---|---|
| `location_id` | string | `123456` | Must match the public `locationId` (`locations.osm_id` as a string) |
| `target_time` | ISO datetime | `2026-07-01T15:00:00-04:00` | Time bucket for prediction |
| `duration_minutes` | integer | `60` | Default 60 |
| `busyness_score` | integer | `82` | 0-100 |
| `busyness_level` | string | `very_busy` | Derived from score |
| `confidence` | float | `0.78` | 0-1 |
| `baseline_score` | integer/null | `64` | Optional |
| `model_version` | string | `busyness-v0.1` | Required |
| `factors_json` | JSON string | `[{...}]` | Optional explainability factors |
| `generated_at` | ISO datetime | `2026-06-25T12:00:00Z` | When ML output was generated |

Example row:

```csv
location_id,target_time,duration_minutes,busyness_score,busyness_level,confidence,baseline_score,model_version,factors_json,generated_at
123456,2026-07-01T15:00:00-04:00,60,82,very_busy,0.78,64,busyness-v0.1,"[{""name"":""time_of_day"",""impact"":""high"",""direction"":""increase""}]",2026-06-25T12:00:00Z
```

Backend behavior:

- Import CSV into backend-managed prediction storage.
- Public `POST /predictions` reads the closest matching `location_id + target_time + model_version`.
- Public forecast endpoint reads multiple rows from `prediction_cache`.
- If no prediction output exists, return `PREDICTION_UNAVAILABLE`.

### 10.2 Option B - Model File Handoff

Status: `INTERNAL`

Implementation state: `INTERNAL_OPTION`

ML deliverables:

```text
ml/model.pkl
ml/feature_schema.json
ml/predict.py
ml/requirements.txt
```

Required rule:

- If ML Lead provides a `.pkl`, `.joblib`, or `.pt` file, they should also provide a runnable `predict.py` script.
- Backend should not be responsible for reverse-engineering a notebook.

Expected command contract:

```bash
python ml/predict.py --input tmp/prediction_input.json --output tmp/prediction_output.json
```

Input JSON:

```json
{
  "items": [
    {
      "locationId": "123456",
      "features": {
        "lat": 40.758,
        "lng": -73.9855,
        "hourOfDay": 15,
        "dayOfWeek": 3,
        "isWeekend": false,
        "weatherCode": "clear",
        "nearbyTransitActivityScore": 0.72,
        "historicalDemandScore": 0.81
      }
    }
  ]
}
```

Output JSON:

```json
{
  "results": [
    {
      "locationId": "123456",
      "busynessScore": 82,
      "confidence": 0.78,
      "modelVersion": "busyness-v0.1",
      "featureContributions": [
        {
          "name": "historicalDemandScore",
          "value": 0.81,
          "impact": 0.31
        }
      ]
    }
  ],
  "errors": []
}
```

Backend behavior:

- Express can call this script during a batch import job, not necessarily during every user request.
- Recommended pattern: run `predict.py` offline or on a schedule, save results into `prediction_cache`, then serve users from PostgreSQL.
- Avoid calling Python synchronously on every request unless performance is acceptable.

### 10.3 Option C - Optional REST ML Service

Status: `INTERNAL`

Implementation state: `INTERNAL_OPTION`

These endpoints are only needed if Data & ML Lead provides and maintains a Python Flask/FastAPI service. They should not be called by web/mobile clients.

#### 10.3.1 Predict Busyness

`POST /internal/ml/predict-busyness`

Request:

```json
{
  "locationId": "123456",
  "features": {
    "lat": 40.758,
    "lng": -73.9855,
    "hourOfDay": 15,
    "dayOfWeek": 3,
    "isWeekend": false,
    "weatherCode": "clear",
    "nearbyTransitActivityScore": 0.72,
    "historicalDemandScore": 0.81,
    "poiDensityScore": 0.66,
    "eventImpactScore": 0.2
  }
}
```

Response:

```json
{
  "busynessScore": 82,
  "confidence": 0.78,
  "modelVersion": "busyness-v0.1",
  "featureContributions": [
    {
      "name": "historicalDemandScore",
      "value": 0.81,
      "impact": 0.31
    },
    {
      "name": "hourOfDay",
      "value": 15,
      "impact": 0.18
    }
  ]
}
```

#### 10.3.2 Batch Predict Busyness

`POST /internal/ml/predict-busyness-batch`

Request:

```json
{
  "items": [
    {
      "locationId": "123456",
      "features": {
        "lat": 40.758,
        "lng": -73.9855,
        "hourOfDay": 15,
        "dayOfWeek": 3,
        "historicalDemandScore": 0.81
      }
    }
  ]
}
```

Response:

```json
{
  "results": [
    {
      "locationId": "123456",
      "busynessScore": 82,
      "confidence": 0.78,
      "modelVersion": "busyness-v0.1"
    }
  ],
  "errors": []
}
```
## 11. Error Codes

| Code | HTTP | Meaning |
|---|---:|---|
| `INVALID_JSON` | 400 | Request body is not valid JSON |
| `DATABASE_UNAVAILABLE` | 503 | Database connection failed |
| `INVALID_QUERY` | 400 | Query string missing or malformed |
| `INVALID_LOCATION_TYPE` | 400 | Unknown location type |
| `INVALID_TIME_RANGE` | 422 | Time range invalid or too large |
| `INVALID_COORDINATES` | 422 | Latitude/longitude invalid |
| `OUTSIDE_SUPPORTED_AREA` | 422 | Location is outside supported Manhattan area |
| `LOCATION_NOT_FOUND` | 404 | Location ID does not exist |
| `SESSION_NOT_FOUND` | 404 | Session ID does not exist or expired |
| `PREDICTION_NOT_FOUND` | 404 | Prediction ID does not exist |
| `PREDICTION_UNAVAILABLE` | 503 | Model cannot produce a prediction |
| `MODEL_SERVICE_UNAVAILABLE` | 503 | ML service timeout/down |
| `EXPLANATION_UNAVAILABLE` | 503 | AI explanation failed and fallback unavailable |
| `ACCESSIBILITY_DATA_UNAVAILABLE` | 200/422 | Use warning for partial data; error only when strict filter required |
| `RATE_LIMITED` | 429 | Too many requests |
| `UNAUTHORIZED` | 401 | Missing/invalid auth |
| `FORBIDDEN` | 403 | Valid auth but insufficient role |
| `INTERNAL_ERROR` | 500 | Unexpected server failure |

## 12. Frontend/Mobile Integration Flow

Primary user flow:

1. Optional: create anonymous session with `POST /sessions` if persistent preferences are needed.
2. Search place: `GET /locations/search`.
3. Load selected place: `GET /locations/{locationId}`.
4. Get prediction: `POST /predictions`.
5. Get explanation: `POST /explanations`.
6. Get quieter alternatives: `POST /recommendations`.
7. Show map context: `GET /locations/nearby` then `POST /predictions/batch`.
8. Submit feedback: `POST /feedback`.

Current integration flow:

1. Frontend/mobile can integrate location search and detail now.
2. Frontend/mobile should mock prediction, recommendation, explanation, and feedback responses until backend implements those endpoints.
3. Backend should keep returning the current location shape unless the contract is deliberately updated and communicated.

Fallback rules:

- If `/explanations` fails, frontend should still display prediction and recommendations.
- If `/recommendations` fails, frontend should still display forecast.
- If `/predictions/batch` partly fails, map should render successful locations and ignore failed ones.

## 13. Non-Functional Requirements

| Requirement | Project target |
|---|---|
| Single cached prediction latency | under 500 ms |
| Single uncached prediction latency | under 2 s |
| Batch size | max 100 locations |
| Forecast window | max 7 days |
| Public API rate limit | Suggested 60 requests/minute/session |
| Timezone | Store UTC, present/request ISO 8601; use New York local time for model features |
| Accessibility | Return text labels, not only color scores |
| GenAI safety | Ground explanations in prediction factors and include disclaimer |
| Data transparency | Include `confidence`, `modelVersion`, and `dataFreshness` where possible |

## 14. Backend Implementation Priority

The first three endpoints are already implemented in the Express backend. Build the remaining endpoints in this order:

1. `POST /predictions` after Data & ML output is available.
2. `GET /locations/{locationId}/forecast`.
3. `GET /locations/nearby`.
4. `POST /predictions/batch`.
5. `POST /recommendations`.
6. `POST /explanations` after prediction factors or GenAI strategy is available.
7. `POST /feedback`.
8. Optional: `POST /sessions`.
9. Optional: `/map/heatmap`.

This order lets frontend/mobile integrate early while the ML model, recommendation logic, and GenAI layer continue improving.

## 15. Team Decisions To Agree

These should be agreed:

| Decision | Recommended answer |
|---|---|
| Canonical location ID | Use `locations.osm_id` as the public `locationId` string for now. Return `externalId` as `osm_<osm_id>`. Do not expose internal database IDs to clients. |
| Timezone | Client sends ISO 8601; backend converts model features to New York local time |
| GenAI failure behavior | Return template explanation fallback |
| Heatmap implementation | Prefer `nearby + batch`; `/map/heatmap` optional |
| Safety-aware routing | Future, unless already available from frontend |

## 16. Review Checklist / Next Improvements

Before moving from contract review to implementation, the team should confirm:

1. Data & ML handoff format: choose CSV, model file, or REST service. CSV is the simplest MVP path.
2. Prediction output shape: confirm `busynessScore`, `busynessLevel`, `confidence`, `modelVersion`, and optional `factors`.
3. Location enrichment: decide whether address, borough, accessibility, opening hours, and tags are required for MVP or can remain planned fields.
4. Session behavior: keep sessions optional unless the frontend/mobile flow truly needs stored preferences.
5. Human-friendly docs: after this contract is stable, generate the public/team docs from this file so the friendly docs and contract do not drift.
