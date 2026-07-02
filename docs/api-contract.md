# Zentra API Contract v1.0 - Full Project Complete Version

Project: COMP47360 Team 10 - Zentra  
Backend scope: Express.js API gateway, Supabase PostgreSQL, FastAPI ML integration, H3 grid data service, recommendation support  
Clients: Web frontend, SwiftUI mobile app, optional admin/planning view  
Last updated: 2026-07-02  
Contract status: Full project API contract with implementation states

## 1. Purpose

This contract describes the full project API surface, not only the endpoints currently implemented.

It separates endpoints into:

- `IMPLEMENTED`: available in the current Express backend
- `PLANNED_MVP`: needed for the MVP but not implemented yet
- `PLANNED_AFTER_POI`: depends on confirmed online POI source or POI catalog
- `FUTURE`: later full-project extensions
- `INTERNAL`: backend-only or backend-to-ML boundary
- `REMOVED`: deliberately removed from backend scope

## 2. Current Product Direction

Zentra is now a coordinate-based crowd prediction system.

Location search is handled by the frontend or an online POI/geocoding API. After the user selects a place, the frontend sends `lat`, `lng`, and `targetTime` to the Express backend.

The backend is responsible for:

- validating coordinates and time;
- calling FastAPI ML through Express;
- mapping coordinates to H3 grid predictions;
- reading fallback H3 data from Supabase;
- returning predictions, heatmap data, recommendations, feedback responses, and admin statistics;
- logging prediction requests;
- later supporting authenticated preferences and POI-aware recommendations.

## 3. Architecture

```text
Frontend / Mobile
      |
      v
Express Backend API
      |---------------------> FastAPI ML Service
      |
      v
Supabase PostgreSQL

External / future services:
      - Clerk authentication
      - Online POI / geocoding API
      - Routing / itinerary tools
```

Express acts as the API gateway. Frontend clients should call Express only.

## 4. Base URL

```text
Local API: http://localhost:3000/api/v1
```

All requests and responses use JSON.

```http
Content-Type: application/json
Accept: application/json
```

Optional headers:

```http
Authorization: Bearer <clerk_jwt>
X-Request-Id: req_client_generated_uuid
Accept-Language: en
```

Current backend does not yet verify Clerk JWT tokens. Clerk verification is planned.

## 5. Shared Models

### Coordinates

```json
{
  "lat": 40.758,
  "lng": -73.9855
}
```

Current supported area: Manhattan.

### Place Input

Used when frontend or online POI provider has already resolved a place.

```json
{
  "placeId": "optional_external_place_id",
  "name": "Central Park",
  "category": "park",
  "coordinates": {
    "lat": 40.7812,
    "lng": -73.9665
  },
  "source": "online_poi_api"
}
```

### Busyness Level

```ts
type BusynessLevel =
  | "very_quiet"
  | "quiet"
  | "moderate"
  | "busy"
  | "very_busy";
```

| Score | Level |
|---:|---|
| 0-20 | `very_quiet` |
| 21-40 | `quiet` |
| 41-60 | `moderate` |
| 61-80 | `busy` |
| 81-100 | `very_busy` |

### User Preferences

User preferences belong to authenticated Clerk users. They are not anonymous session context and should not be passed around as `userContext` in normal prediction requests.

Target design:

```text
Frontend logs in with Clerk
Backend verifies Clerk JWT
Backend reads/writes preferences through /users/me/preferences
Recommendation and itinerary logic reads stored preferences server-side
```

Preference shape:

```json
{
  "travelPace": "relaxed",
  "interests": ["parks", "museums", "food"],
  "budgetRange": "medium",
  "crowdTolerance": "low",
  "mobilityNeeds": ["step_free"],
  "dietaryNeeds": ["vegetarian"],
  "inclusionNeeds": ["quiet_spaces"],
  "preferredLanguage": "en"
}
```

## 6. Common Response Format

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_QUERY",
    "message": "targetTime must be a valid date-time string"
  },
  "meta": {
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

## 7. Endpoint Summary

| # | Method | Path | State | Client | Purpose |
|---:|---|---|---|---|---|
| 1 | GET | `/health` | `IMPLEMENTED` | All | Service and database health |
| 2 | POST | `/predictions` | `IMPLEMENTED` | Web/mobile | Single coordinate crowd prediction |
| 3 | POST | `/predictions/batch` | `IMPLEMENTED` | Web/mobile/map | Batch coordinate predictions |
| 4 | GET | `/map/heatmap` | `IMPLEMENTED` | Web map | H3 heatmap points |
| 5 | POST | `/recommendations` | `IMPLEMENTED` | Web/mobile | Current quieter H3 area recommendations |
| 6 | GET | `/predictions/forecast` | `IMPLEMENTED` | Web/mobile | Prototype coordinate forecast |
| 7 | POST | `/feedback` | `IMPLEMENTED` | Web/mobile | Store user feedback |
| 8 | GET | `/admin/stats/predictions` | `IMPLEMENTED` | Admin | Prediction request statistics |
| 9 | POST | `/explanations` | `PLANNED_MVP` | Web/mobile | Plain-language prediction explanation |
| 10 | POST | `/recommendations/quiet-times` | `PLANNED_MVP` | Web/mobile | Suggest quieter times for same coordinate |
| 11 | GET | `/users/me/preferences` | `PLANNED_MVP` | Web/mobile | Read logged-in user's onboarding preferences |
| 12 | PUT | `/users/me/preferences` | `PLANNED_MVP` | Web/mobile | Update logged-in user's onboarding preferences |
| 13 | POST | `/recommendations/places` | `PLANNED_AFTER_POI` | Web/mobile | Rank candidate POIs with crowd prediction |
| 14 | POST | `/itineraries` | `FUTURE` | Web/mobile | Generate custom crowd-aware itinerary |
| 15 | POST | `/routes/crowd-aware` | `FUTURE` | Mobile/web map | Route-level crowd-aware guidance |
| 16 | GET | `/admin/stats/feedback` | `FUTURE` | Admin | Feedback analytics |
| 17 | POST | `/internal/ml/predict-busyness` | `INTERNAL` | Backend only | Express-to-ML single prediction boundary |
| 18 | POST | `/internal/ml/predict-busyness-batch` | `INTERNAL` | Backend only | Express-to-ML batch prediction boundary |

Removed from backend scope:

| Removed endpoint | Reason |
|---|---|
| `GET /locations/search` | Frontend / online POI API handles place search |
| `GET /locations/{locationId}` | Backend no longer depends on stored backend location IDs |
| `GET /locations/nearby` | Replaced by future POI-based recommendation flow |
| `POST /sessions` | Anonymous sessions removed because app uses login |
| `PUT /sessions/{sessionId}/preferences` | Replaced by authenticated user preferences |
| `POST /chat/messages` | Chatbot is frontend-owned |

## 8. Implemented Endpoints

### 8.1 Health Check

`GET /health`

State: `IMPLEMENTED`

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
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

### 8.2 Single Crowd Prediction

`POST /predictions`

State: `IMPLEMENTED`

Request:

```json
{
  "lat": 40.758,
  "lng": -73.9855,
  "targetTime": "2026-07-01T16:30:00-04:00",
  "durationMinutes": 60
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "prediction": {
      "predictionId": "ml_892a100d67bffff_1782938161771",
      "h3Cell": "892a100d67bffff",
      "coordinates": {
        "lat": 40.758,
        "lng": -73.9855
      },
      "matchedCoordinates": {
        "lat": 40.758,
        "lng": -73.9855
      },
      "targetTime": "2026-07-01T16:30:00-04:00",
      "durationMinutes": 60,
      "busynessScore": 100,
      "busynessLevel": "very_busy",
      "crowdCategory": "Very Busy",
      "pedestriansPredicted": 3067.3,
      "period": "PM",
      "confidence": 0.8,
      "modelVersion": "ml-fastapi-v1.0",
      "cached": false,
      "source": "ml_fastapi"
    }
  },
  "meta": {
    "modelVersion": "ml-fastapi-v1.0",
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

Behavior:

- Tries FastAPI ML first.
- Falls back to Supabase `h3_grid_scores` if ML is unavailable.
- Logs request into `prediction_requests`.

### 8.3 Batch Crowd Prediction

`POST /predictions/batch`

State: `IMPLEMENTED`

Request:

```json
{
  "targetTime": "2026-07-01T16:30:00-04:00",
  "durationMinutes": 60,
  "locations": [
    {
      "locationId": "times-square",
      "lat": 40.758,
      "lng": -73.9855
    },
    {
      "locationId": "union-square",
      "lat": 40.7359,
      "lng": -73.9911
    }
  ]
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "targetTime": "2026-07-01T16:30:00-04:00",
    "durationMinutes": 60,
    "predictions": [
      {
        "predictionId": "ml_892a100d67bffff_1782938184499",
        "locationId": "times-square",
        "h3Cell": "892a100d67bffff",
        "coordinates": {
          "lat": 40.758,
          "lng": -73.9855
        },
        "busynessScore": 100,
        "busynessLevel": "very_busy",
        "crowdCategory": "Very Busy",
        "pedestriansPredicted": 3067.3,
        "period": "PM",
        "confidence": 0.8,
        "modelVersion": "ml-fastapi-v1.0",
        "cached": false,
        "source": "ml_fastapi"
      }
    ],
    "warnings": []
  },
  "meta": {
    "count": 1,
    "warningCount": 0,
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

Notes:

- `locationId` is optional and client-defined.
- Backend uses `lat` and `lng`, not stored location rows.
- Max batch size: 100.

### 8.4 Map Heatmap

`GET /map/heatmap?targetTime={iso}&limit={limit}&source={source}`

State: `IMPLEMENTED`

Query parameters:

| Name | Required | Default | Notes |
|---|---:|---|---|
| `targetTime` | no | current time | Valid date-time string |
| `limit` | no | 100 | Max 524 |
| `source` | no | `auto` | `auto`, `ml`, or `database` |

Response `200`:

```json
{
  "success": true,
  "data": {
    "targetTime": "2026-07-01T16:30:00-04:00",
    "source": "ml_fastapi",
    "points": [
      {
        "h3Cell": "892a1008807ffff",
        "coordinates": {
          "lat": 40.7952379433945,
          "lng": -73.9725090299033
        },
        "period": "PM",
        "queryTimestamp": "2026-07-01T16:30:00-04:00",
        "crowdScore": 53,
        "crowdLevel": "moderate",
        "crowdCategory": "Moderate",
        "pedestriansPredicted": 3399.1,
        "source": "ml_fastapi"
      }
    ]
  },
  "meta": {
    "count": 1,
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

### 8.5 Quieter H3 Area Recommendations

`POST /recommendations`

State: `IMPLEMENTED`

Current purpose:

- Returns quieter H3 grid areas near the requested coordinate.
- Does not yet return named POI places.

Request:

```json
{
  "lat": 40.758,
  "lng": -73.9855,
  "targetTime": "2026-07-01T16:30:00-04:00",
  "limit": 5
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "targetTime": "2026-07-01T16:30:00-04:00",
    "recommendations": [
      {
        "type": "quieter_place",
        "h3Cell": "892a100d6d3ffff",
        "coordinates": {
          "lat": 40.7714011091155,
          "lng": -73.9737226811384
        },
        "busynessScore": 76,
        "busynessLevel": "busy",
        "pedestriansPredicted": 1679.2,
        "period": "PM",
        "reason": "This nearby grid cell has a lower predicted crowd score."
      }
    ]
  },
  "meta": {
    "count": 1,
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

### 8.6 Coordinate Forecast

`GET /predictions/forecast?lat={lat}&lng={lng}&startTime={iso}&endTime={iso}&limit={limit}`

State: `IMPLEMENTED`

Response `200`:

```json
{
  "success": true,
  "data": {
    "h3Cell": "892a100d67bffff",
    "coordinates": {
      "lat": 40.758,
      "lng": -73.9855
    },
    "startTime": "2026-07-01T00:00:00-04:00",
    "endTime": "2026-07-02T00:00:00-04:00",
    "forecast": [
      {
        "timestamp": "2026-07-01T16:30:00-04:00",
        "period": "PM",
        "busynessScore": 82,
        "busynessLevel": "very_busy",
        "pedestriansPredicted": 3067.3
      }
    ]
  },
  "meta": {
    "count": 1,
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

Current limitation:

- Prototype endpoint.
- Reads Supabase `h3_grid_scores`.
- May return empty `forecast` if no rows exist for the selected H3 cell and time range.
- Future version should call FastAPI `/predict/future` for generated time points.

### 8.7 Submit User Feedback

`POST /feedback`

State: `IMPLEMENTED`

Request:

```json
{
  "userId": "user_123",
  "h3Cell": "892a100d67bffff",
  "rating": 5,
  "wasUseful": true,
  "comment": "The prediction was useful."
}
```

Response `201`:

```json
{
  "success": true,
  "data": {
    "feedback": {
      "id": "1",
      "userId": "user_123",
      "h3Cell": "892a100d67bffff",
      "rating": 5,
      "wasUseful": true,
      "comment": "The prediction was useful.",
      "createdAt": "2026-07-02T12:00:00Z"
    }
  },
  "meta": {
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

### 8.8 Admin Prediction Statistics

`GET /admin/stats/predictions?startDate={iso}&endDate={iso}`

State: `IMPLEMENTED`

Response `200`:

```json
{
  "success": true,
  "data": {
    "totalPredictionRequests": 120,
    "averageCrowdScore": 72.4,
    "mlRequests": 90,
    "cachedRequests": 30,
    "cacheHitRate": 0.25,
    "uniqueH3Cells": 42,
    "mostRequestedH3Cells": [
      {
        "h3Cell": "892a100d67bffff",
        "count": 14,
        "averageCrowdScore": 85.2
      }
    ]
  },
  "meta": {
    "startDate": null,
    "endDate": null,
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

## 9. Planned MVP Endpoints

### 9.1 Prediction Explanation

`POST /explanations`

State: `PLANNED_MVP`

Purpose:

- Explain why an area is predicted to be busy or quiet.
- Chat UI remains frontend-owned.
- Backend can start with rule-based explanations grounded in prediction fields.

Request:

```json
{
  "lat": 40.758,
  "lng": -73.9855,
  "targetTime": "2026-07-01T16:30:00-04:00",
  "h3Cell": "892a100d67bffff",
  "busynessScore": 100,
  "language": "en"
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "explanation": {
      "summary": "This area is expected to be very busy at the selected time.",
      "reasons": [
        "The selected time period usually has high activity.",
        "Nearby transit and visitor activity may increase foot traffic.",
        "The H3 grid cell has a high predicted crowd score."
      ],
      "suggestedAction": "Consider choosing a quieter nearby grid area or a different time.",
      "disclaimer": "This is a model prediction, not a live crowd count."
    }
  },
  "meta": {
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

### 9.2 Quieter Time Recommendation

`POST /recommendations/quiet-times`

State: `PLANNED_MVP`

Request:

```json
{
  "lat": 40.758,
  "lng": -73.9855,
  "targetTime": "2026-07-01T16:30:00-04:00",
  "startTime": "2026-07-01T09:00:00-04:00",
  "endTime": "2026-07-01T21:00:00-04:00",
  "limit": 3
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "original": {
      "targetTime": "2026-07-01T16:30:00-04:00",
      "busynessScore": 86,
      "busynessLevel": "very_busy"
    },
    "quietTimes": [
      {
        "targetTime": "2026-07-01T10:00:00-04:00",
        "busynessScore": 42,
        "busynessLevel": "moderate",
        "confidence": 0.68,
        "reason": "Predicted crowd score is lower earlier in the day."
      }
    ]
  },
  "meta": {
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

Implementation options:

- query multiple rows from `h3_grid_scores`;
- or call FastAPI `/predict/future` for multiple time points.

### 9.3 Read Current User Preferences

`GET /users/me/preferences`

State: `PLANNED_MVP`

Future auth rule:

- Requires valid Clerk JWT.
- Backend derives `userId` from token, not from request body.

Response `200`:

```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "preferences": {
      "travelPace": "relaxed",
      "interests": ["parks", "museums"],
      "budgetRange": "medium",
      "crowdTolerance": "low",
      "mobilityNeeds": ["step_free"],
      "dietaryNeeds": [],
      "inclusionNeeds": ["quiet_spaces"],
      "onboardingCompleted": true,
      "updatedAt": "2026-07-02T12:00:00Z"
    }
  },
  "meta": {
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

### 9.4 Update Current User Preferences

`PUT /users/me/preferences`

State: `PLANNED_MVP`

Request:

```json
{
  "travelPace": "relaxed",
  "interests": ["parks", "food", "museums"],
  "budgetRange": "medium",
  "crowdTolerance": "low",
  "mobilityNeeds": ["step_free"],
  "dietaryNeeds": ["vegetarian"],
  "inclusionNeeds": ["quiet_spaces"],
  "onboardingCompleted": true
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "userId": "user_123",
    "preferences": {
      "travelPace": "relaxed",
      "interests": ["parks", "food", "museums"],
      "budgetRange": "medium",
      "crowdTolerance": "low",
      "mobilityNeeds": ["step_free"],
      "dietaryNeeds": ["vegetarian"],
      "inclusionNeeds": ["quiet_spaces"],
      "onboardingCompleted": true,
      "updatedAt": "2026-07-02T12:00:00Z"
    }
  },
  "meta": {
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

## 10. Planned After POI Source

### 10.1 POI-Aware Place Recommendations

`POST /recommendations/places`

State: `PLANNED_AFTER_POI`

Purpose:

- Rank named candidate places using crowd prediction, distance, category, and user preferences.
- The backend does not perform general place search.
- Frontend or online POI API provides candidate places. Any `preferenceOverrides` field is temporary for planning; target implementation should read preferences from the authenticated Clerk user.

Request:

```json
{
  "currentLocation": {
    "lat": 40.758,
    "lng": -73.9855
  },
  "targetTime": "2026-07-01T16:30:00-04:00",
  "candidatePlaces": [
    {
      "placeId": "poi_1",
      "name": "Central Park",
      "category": "park",
      "coordinates": {
        "lat": 40.7812,
        "lng": -73.9665
      },
      "source": "online_poi_api"
    }
  ],
  "preferenceOverrides": {
    "crowdTolerance": "low",
    "interests": ["parks"],
    "mobilityNeeds": ["step_free"]
  },
  "limit": 5
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "targetTime": "2026-07-01T16:30:00-04:00",
    "recommendations": [
      {
        "type": "poi_place",
        "rank": 1,
        "place": {
          "placeId": "poi_1",
          "name": "Central Park",
          "category": "park",
          "coordinates": {
            "lat": 40.7812,
            "lng": -73.9665
          },
          "source": "online_poi_api"
        },
        "prediction": {
          "h3Cell": "892a10089abffff",
          "busynessScore": 44,
          "busynessLevel": "moderate",
          "confidence": 0.7,
          "source": "ml_fastapi"
        },
        "distanceMeters": 2400,
        "preferenceMatch": {
          "matchesInterests": true,
          "crowdToleranceMatch": true,
          "mobilityMatch": null
        },
        "reason": "This place matches the selected interest and is predicted to be less crowded than the current area."
      }
    ],
    "warnings": [
      {
        "code": "ACCESSIBILITY_DATA_UNAVAILABLE",
        "message": "Accessibility matching is incomplete until the POI source provides accessibility fields."
      }
    ]
  },
  "meta": {
    "count": 1,
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

## 11. Future Full-Project Endpoints

### 11.1 Custom Itinerary

`POST /itineraries`

State: `FUTURE`

Request:

```json
{
  "startLocation": {
    "lat": 40.758,
    "lng": -73.9855
  },
  "endLocation": {
    "lat": 40.758,
    "lng": -73.9855
  },
  "startTime": "2026-07-01T10:00:00-04:00",
  "endTime": "2026-07-01T16:00:00-04:00",
  "interests": ["food", "art", "parks"],
  "candidatePlaces": [
    {
      "placeId": "poi_1",
      "name": "Museum of Modern Art",
      "category": "museum",
      "coordinates": {
        "lat": 40.7614,
        "lng": -73.9776
      },
      "source": "online_poi_api"
    }
  ],
  "preferenceOverrides": {
    "crowdTolerance": "low",
    "travelPace": "relaxed",
    "mobilityNeeds": ["step_free"],
    "dietaryNeeds": ["vegetarian"]
  },
  "constraints": {
    "maxStops": 5,
    "avoidVeryBusy": true,
    "transportModes": ["walk", "transit"]
  }
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "itinerary": {
      "id": "itin_123",
      "summary": "A relaxed crowd-aware plan for food, art, and parks.",
      "startTime": "2026-07-01T10:00:00-04:00",
      "endTime": "2026-07-01T16:00:00-04:00",
      "stops": [
        {
          "order": 1,
          "arrivalTime": "2026-07-01T10:00:00-04:00",
          "departureTime": "2026-07-01T11:30:00-04:00",
          "place": {
            "placeId": "poi_1",
            "name": "Museum of Modern Art",
            "category": "museum",
            "coordinates": {
              "lat": 40.7614,
              "lng": -73.9776
            }
          },
          "prediction": {
            "busynessScore": 48,
            "busynessLevel": "moderate",
            "h3Cell": "892a100d2d7ffff"
          },
          "reason": "This stop matches the user's art interest and is predicted to be less crowded in the morning."
        }
      ],
      "routeSummary": {
        "totalDistanceMeters": 3200,
        "totalTravelMinutes": 48,
        "transportModes": ["walk", "transit"]
      },
      "warnings": [
        {
          "code": "POI_DATA_LIMITED",
          "message": "Opening hours and accessibility data may be incomplete."
        }
      ],
      "disclaimer": "Itinerary is generated from predictions and available POI data."
    }
  },
  "meta": {
    "planningMode": "future_llm_or_rule_based",
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

### 11.2 Crowd-Aware Route Guidance

`POST /routes/crowd-aware`

State: `FUTURE`

Request:

```json
{
  "origin": {
    "lat": 40.758,
    "lng": -73.9855
  },
  "destination": {
    "lat": 40.7812,
    "lng": -73.9665
  },
  "targetTime": "2026-07-01T16:30:00-04:00",
  "transportMode": "walk",
  "preferenceOverrides": {
    "crowdTolerance": "low",
    "mobilityNeeds": ["step_free"]
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
        "routeId": "route_1",
        "transportMode": "walk",
        "durationMinutes": 32,
        "distanceMeters": 2600,
        "overallCrowdScore": 58,
        "overallCrowdLevel": "moderate",
        "segments": [
          {
            "order": 1,
            "start": {
              "lat": 40.758,
              "lng": -73.9855
            },
            "end": {
              "lat": 40.765,
              "lng": -73.98
            },
            "estimatedMinutes": 8,
            "crowdScore": 72,
            "crowdLevel": "busy",
            "h3Cells": ["892a100d67bffff"]
          }
        ],
        "warnings": [
          {
            "code": "ROUTING_DATA_LIMITED",
            "message": "Route guidance depends on external routing data."
          }
        ],
        "reason": "This route avoids the busiest nearby H3 cells where possible."
      }
    ]
  },
  "meta": {
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

### 11.3 Admin Feedback Statistics

`GET /admin/stats/feedback?startDate={iso}&endDate={iso}`

State: `FUTURE`

Response `200`:

```json
{
  "success": true,
  "data": {
    "totalFeedback": 85,
    "averageRating": 4.2,
    "usefulRate": 0.78,
    "feedbackByH3Cell": [
      {
        "h3Cell": "892a100d67bffff",
        "count": 12,
        "averageRating": 4.0,
        "usefulRate": 0.75
      }
    ],
    "recentComments": [
      {
        "id": "12",
        "h3Cell": "892a100d67bffff",
        "rating": 5,
        "wasUseful": true,
        "comment": "The prediction was useful.",
        "createdAt": "2026-07-02T12:00:00Z"
      }
    ]
  },
  "meta": {
    "startDate": null,
    "endDate": null,
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

## 12. Internal ML Integration

Frontend should not call FastAPI directly.

Express uses:

```text
ML_API_BASE_URL=http://localhost:8000
```

Current FastAPI ML endpoints:

```text
GET  /
POST /predict/crowd
POST /predict/future
GET  /predict/crowd-score
```

### 12.1 Internal Single ML Prediction

`POST /internal/ml/predict-busyness`

State: `INTERNAL`

Request:

```json
{
  "lat": 40.758,
  "lng": -73.9855,
  "targetTime": "2026-07-01T16:30:00-04:00",
  "durationMinutes": 60
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "prediction": {
      "h3Cell": "892a100d67bffff",
      "coordinates": {
        "lat": 40.758,
        "lng": -73.9855
      },
      "targetTime": "2026-07-01T16:30:00-04:00",
      "period": "PM",
      "busynessScore": 100,
      "busynessLevel": "very_busy",
      "crowdCategory": "Very Busy",
      "pedestriansPredicted": 3067.3,
      "modelVersion": "ml-fastapi-v1.0",
      "source": "ml_fastapi"
    }
  },
  "meta": {
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

Notes:

- This endpoint is not required by frontend/mobile.
- Current Express code already calls FastAPI internally.
- This route can be added later for internal testing if useful.

### 12.2 Internal Batch ML Prediction

`POST /internal/ml/predict-busyness-batch`

State: `INTERNAL`

Request:

```json
{
  "targetTime": "2026-07-01T16:30:00-04:00",
  "locations": [
    {
      "locationId": "times-square",
      "lat": 40.758,
      "lng": -73.9855
    }
  ]
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "targetTime": "2026-07-01T16:30:00-04:00",
    "results": [
      {
        "locationId": "times-square",
        "h3Cell": "892a100d67bffff",
        "busynessScore": 100,
        "busynessLevel": "very_busy",
        "crowdCategory": "Very Busy",
        "pedestriansPredicted": 3067.3,
        "source": "ml_fastapi"
      }
    ],
    "errors": []
  },
  "meta": {
    "count": 1,
    "errorCount": 0,
    "generatedAt": "2026-07-02T12:00:00Z"
  }
}
```

Notes:

- If FastAPI later provides a real batch endpoint, Express should call that instead of looping through single predictions.
- Partial success should be supported.

## 13. Data / ML Notes

Current ML crowd prediction:

- Manhattan is divided into 524 H3 grid cells.
- Crowd prediction is built and being tested.
- The model uses pedestrian counts, transit activity, POI density, weather, events, and holidays.
- Only some H3 cells have real pedestrian ground truth; many predictions rely on proxy features.
- Current coverage is Manhattan-only.

Recommendation and custom itinerary:

- Planned as Feature 2 in Data/ML.
- Requires POI catalog or online POI provider.
- May later use an LLM/tool-calling agent that calls crowd prediction as a tool.

## 14. Error Codes

| Code | HTTP | Meaning |
|---|---:|---|
| `DATABASE_UNAVAILABLE` | 503 | Database connection failed |
| `INVALID_QUERY` | 400/422 | Missing or invalid request fields |
| `INVALID_COORDINATES` | 422 | Latitude/longitude invalid |
| `LOCATION_OUT_OF_COVERAGE` | 422 | Coordinate outside Manhattan coverage |
| `PREDICTION_UNAVAILABLE` | 503 | No ML or fallback prediction available |
| `ML_API_UNAVAILABLE` | 503 | FastAPI ML service unavailable |
| `INVALID_RATING` | 422 | Feedback rating must be 1-5 |
| `PREFERENCES_NOT_FOUND` | 404 | User preferences do not exist yet |
| `UNAUTHORIZED` | 401 | Future auth token missing/invalid |
| `FORBIDDEN` | 403 | Future auth valid but not allowed |
| `INTERNAL_ERROR` | 500 | Unexpected server failure |

## 15. Frontend Integration Flow

Current flow:

1. User logs in through Clerk on frontend.
2. User searches/selects a place through frontend or online POI/geocoding API.
3. Frontend obtains `lat`, `lng`, optional place name/category, and `targetTime`.
4. Frontend calls `POST /predictions`.
5. Frontend optionally calls `GET /map/heatmap`.
6. Frontend optionally calls `POST /recommendations`.
7. Frontend submits feedback with `POST /feedback`.

Future POI-aware flow:

1. Frontend obtains candidate POIs from online API.
2. Frontend sends candidate POIs to `POST /recommendations/places`.
3. Backend ranks candidates using crowd prediction and preferences.
4. Future itinerary endpoint sequences places into a timed plan.

## 16. Backend Implementation Priority

Completed:

1. Health check
2. Supabase connection
3. H3 grid data import
4. Single prediction
5. Batch prediction
6. ML FastAPI gateway integration
7. Heatmap
8. Basic H3 recommendations
9. Feedback
10. Prediction logging
11. Admin stats