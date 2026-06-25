# Zentra API Contract v1.0 - Full Project Version

Project: COMP47360 Team 10 - Zentra  
Backend scope: Express.js API, PostgreSQL, prediction/ML integration, GenAI explanation integration  
Clients: Web frontend, SwiftUI mobile app, optional admin/planning view  
Contract status: Full project team-sharing contract  

## 1. Project Scope

This contract defines the API surface needed for the full Zentra project. It separates endpoints by implementation priority so backend, web, mobile, ML, and product teammates can share one source of truth:

| Status | Meaning |
|---|---|
| `MVP_REQUIRED` | Core MVP endpoint needed for the main product flow |
| `MVP_OPTIONAL` | Useful product endpoint, but not required for the core flow |
| `FUTURE` | Full-project extension endpoint for later implementation |
| `INTERNAL` | Backend-to-ML or backend-only service contract |

Full project API count:

| Group | Count | Notes |
|---|---:|---|
| Core public MVP endpoints | 12 | Main web/mobile product flow |
| Optional/future/admin endpoints | 4 | Shared for full-project planning |
| Internal ML integration options | 2 | Optional backend-to-ML service boundary; file-based handoff is also supported |

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

```json
{
  "id": "loc_123",
  "externalId": "osm_node_123456",
  "name": "Times Square",
  "type": "attraction",
  "address": "Manhattan, New York, NY",
  "borough": "Manhattan",
  "coordinates": {
    "lat": 40.758,
    "lng": -73.9855
  },
  "distanceMeters": 450
}
```

### 6.4 LocationDetail

```json
{
  "id": "loc_123",
  "externalId": "osm_node_123456",
  "name": "Times Square",
  "type": "attraction",
  "address": "Manhattan, New York, NY",
  "borough": "Manhattan",
  "coordinates": {
    "lat": 40.758,
    "lng": -73.9855
  },
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
  "locationId": "loc_123",
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
    "id": "loc_456",
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

| # | Method | Path | Status | Main client |
|---:|---|---|---|---|
| 1 | GET | `/health` | `MVP_REQUIRED` | All |
| 2 | POST | `/sessions` | `MVP_REQUIRED` | Web/mobile |
| 3 | GET | `/locations/search` | `MVP_REQUIRED` | Web/mobile |
| 4 | GET | `/locations/{locationId}` | `MVP_REQUIRED` | Web/mobile |
| 5 | GET | `/locations/nearby` | `MVP_REQUIRED` | Web/mobile map |
| 6 | POST | `/predictions` | `MVP_REQUIRED` | Web/mobile |
| 7 | POST | `/predictions/batch` | `MVP_REQUIRED` | Map/heatmap |
| 8 | GET | `/locations/{locationId}/forecast` | `MVP_REQUIRED` | Web/mobile |
| 9 | POST | `/recommendations` | `MVP_REQUIRED` | Web/mobile |
| 10 | POST | `/explanations` | `MVP_REQUIRED` | Web/mobile |
| 11 | POST | `/feedback` | `MVP_REQUIRED` | Web/mobile |
| 12 | GET | `/map/heatmap` | `MVP_OPTIONAL` | Web map |
| 13 | PUT | `/sessions/{sessionId}/preferences` | `MVP_OPTIONAL` | Web/mobile |
| 14 | POST | `/chat/messages` | `FUTURE` | Web/mobile |
| 15 | POST | `/routes/safety-aware` | `FUTURE` | Mobile |
| 16 | GET | `/admin/stats/predictions` | `FUTURE` | Admin |
| 17 | POST | `/internal/ml/predict-busyness` | `INTERNAL` | Backend |
| 18 | POST | `/internal/ml/predict-busyness-batch` | `INTERNAL` | Backend |

## 8. Public MVP Endpoints

### 8.1 Health Check

`GET /health`

Status: `MVP_REQUIRED`

Response `200`:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "apiVersion": "v1",
    "database": "ok",
    "predictionService": "ok",
    "uptimeSeconds": 3600
  },
  "meta": {
    "generatedAt": "2026-06-25T12:00:00Z"
  }
}
```

### 8.2 Create Anonymous Session

`POST /sessions`

Status: `MVP_REQUIRED`

Purpose:

- Store temporary onboarding/preferences without user accounts.
- Allows recommendation and explanation endpoints to personalize responses.

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

Query parameters:

| Name | Required | Example | Rule |
|---|---:|---|---|
| `q` | yes | `museum` | 2-100 characters |
| `type` | no | `cafe` | Must be `LocationType` |
| `limit` | no | `10` | Default 10, max 50 |
| `lat` | no | `40.758` | If present, `lng` must also be present |
| `lng` | no | `-73.9855` | If present, `lat` must also be present |

Response `200`:

```json
{
  "success": true,
  "data": {
    "query": "museum",
    "results": [
      {
        "id": "loc_123",
        "externalId": "osm_node_123456",
        "name": "Museum of Modern Art",
        "type": "museum",
        "address": "11 W 53rd St, New York, NY",
        "borough": "Manhattan",
        "coordinates": {
          "lat": 40.7614,
          "lng": -73.9776
        },
        "distanceMeters": 450
      }
    ]
  }
}
```

Errors:

- `400 INVALID_QUERY`
- `400 INVALID_LOCATION_TYPE`
- `422 OUTSIDE_SUPPORTED_AREA`

### 8.4 Get Location Detail

`GET /locations/{locationId}`

Status: `MVP_REQUIRED`

Response `200`:

```json
{
  "success": true,
  "data": {
    "location": {
      "id": "loc_123",
      "externalId": "osm_node_123456",
      "name": "Times Square",
      "type": "attraction",
      "address": "Manhattan, New York, NY",
      "borough": "Manhattan",
      "coordinates": {
        "lat": 40.758,
        "lng": -73.9855
      },
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
  }
}
```

Errors:

- `404 LOCATION_NOT_FOUND`

### 8.5 Get Nearby Locations

`GET /locations/nearby?lat={lat}&lng={lng}&radiusMeters={radius}&type={type}&limit={limit}`

Status: `MVP_REQUIRED`

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
        "id": "loc_456",
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

Request:

```json
{
  "locationId": "loc_123",
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
      "locationId": "loc_123",
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

Request:

```json
{
  "locationIds": ["loc_123", "loc_456", "loc_789"],
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
        "locationId": "loc_123",
        "busynessScore": 82,
        "busynessLevel": "very_busy",
        "confidence": 0.78,
        "modelVersion": "busyness-v0.1"
      },
      {
        "predictionId": "pred_456",
        "locationId": "loc_456",
        "busynessScore": 46,
        "busynessLevel": "moderate",
        "confidence": 0.71,
        "modelVersion": "busyness-v0.1"
      }
    ],
    "warnings": [
      {
        "locationId": "loc_789",
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

Use case:

- Show quiet/busy periods across the day.
- Support "go later" or "go earlier" recommendations.

Response `200`:

```json
{
  "success": true,
  "data": {
    "locationId": "loc_123",
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

Request:

```json
{
  "locationId": "loc_123",
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
      "locationId": "loc_123",
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
          "id": "loc_456",
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

Request:

```json
{
  "locationId": "loc_123",
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

Request:

```json
{
  "sessionId": "sess_123",
  "locationId": "loc_123",
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
        "locationId": "loc_123",
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
    "suggestedLocations": ["loc_456", "loc_789"],
    "suggestedActions": ["view_recommendations", "open_map"]
  }
}
```

### 9.3 Safety-Aware Route Suggestion

`POST /routes/safety-aware`

Status: `FUTURE`

Request:

```json
{
  "origin": {
    "lat": 40.758,
    "lng": -73.9855
  },
  "destinationLocationId": "loc_456",
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
        "locationId": "loc_123",
        "name": "Times Square",
        "count": 210
      }
    ],
    "feedbackAverageRating": 4.1
  }
}
```

## 10. ML Integration Contract

The public API does not require the ML component to run as a REST service. Web and mobile clients should only call the public backend endpoints such as `/predictions`, `/forecast`, and `/recommendations`.

For the team handoff, Data & ML Lead can provide the prediction layer in one of three supported formats:

| Option | ML deliverable | Backend work |
|---|---|---|
| A | Precomputed prediction CSV files | Import CSV into PostgreSQL `prediction_cache`; Express reads from DB |
| B | Model artifact such as `.pkl`, `.joblib`, or `.pt` plus feature schema | Backend calls a small Python prediction script or scheduled batch job |
| C | Python REST service using Flask/FastAPI | Express calls ML service over HTTP |


### 10.1 Option A - Precomputed Prediction CSV Handoff

Status: `INTERNAL`

ML deliverable:

```text
data/predictions/prediction_cache.csv
```

Required CSV columns:

| Column | Type | Example | Notes |
|---|---|---|---|
| `location_id` | string | `loc_123` | Must match backend `locations.id` |
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
loc_123,2026-07-01T15:00:00-04:00,60,82,very_busy,0.78,64,busyness-v0.1,"[{""name"":""time_of_day"",""impact"":""high"",""direction"":""increase""}]",2026-06-25T12:00:00Z
```

Backend behavior:

- Import CSV into backend-managed prediction storage.
- Public `POST /predictions` reads the closest matching `location_id + target_time + model_version`.
- Public forecast endpoint reads multiple rows from `prediction_cache`.
- If no prediction output exists, return `PREDICTION_UNAVAILABLE`.

### 10.2 Option B - Model File Handoff

Status: `INTERNAL`

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
      "locationId": "loc_123",
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
      "locationId": "loc_123",
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

Status: `INTERNAL_OPTIONAL`

These endpoints are only needed if Data & ML Lead provides and maintains a Python Flask/FastAPI service. They should not be called by web/mobile clients.

#### 10.3.1 Predict Busyness

`POST /internal/ml/predict-busyness`

Request:

```json
{
  "locationId": "loc_123",
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
      "locationId": "loc_123",
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
      "locationId": "loc_123",
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

1. Create anonymous session: `POST /sessions`.
2. Search place: `GET /locations/search`.
3. Load selected place: `GET /locations/{locationId}`.
4. Get prediction: `POST /predictions`.
5. Get explanation: `POST /explanations`.
6. Get quieter alternatives: `POST /recommendations`.
7. Show map context: `GET /locations/nearby` then `POST /predictions/batch`.
8. Submit feedback: `POST /feedback`.

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

Build in this order:

1. `GET /health`
2. `GET /locations/search`
3. `GET /locations/{locationId}`
4. `POST /predictions` after Data & ML output is available
5. `GET /locations/{locationId}/forecast`
6. `POST /recommendations`
7. `POST /explanations` after prediction factors or GenAI strategy is available
8. `GET /locations/nearby`
9. `POST /predictions/batch`
10. `POST /sessions`
11. `POST /feedback`
12. Optional `/map/heatmap`

This order lets frontend/mobile integrate early while the ML model, recommendation logic, and GenAI layer continue improving.

## 15. Team Decisions To Agree

These should be agreed:

| Decision | Recommended answer |
|---|---|
| Canonical location ID | Current database uses `locations.osm_id` as the public `locationId`; API should return it as a string. If a separate internal UUID is added later, keep `osm_id` as `externalId` |
| Timezone | Client sends ISO 8601; backend converts model features to New York local time |
| GenAI failure behavior | Return template explanation fallback |
| Heatmap implementation | Prefer `nearby + batch`; `/map/heatmap` optional |
| Safety-aware routing | Future, unless already available from frontend |
