# Zentra Backend API Contract v1.0

Project: COMP47360 Team 10 - Zentra  
API version: v1  
Base path: `/api/v1`  
Last updated: 2026-07-20

## 1. Purpose

This document defines the backend API surface for Zentra. It describes the HTTP interface used by the web frontend, iOS mobile app, and trusted internal agent services.

The contract is independent of the backend's internal storage or implementation details. Clients depend on the API shape described here rather than database tables or downstream service schemas.

The backend API supports:

- Manhattan crowd prediction and future forecast;
- crowd heatmap data for map views;
- attraction discovery, nearby search, and detail views;
- quieter-area and quieter-time recommendations;
- AI chat and itinerary/recommendation agent gateway flows;
- saved itineraries for authenticated users;
- user feedback submission;
- internal statistics for evaluation and monitoring.

All non-streaming endpoints use JSON.

```http
Content-Type: application/json
Accept: application/json
```

## 2. Authentication

### Public Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness and database health check |
| `POST` | `/feedback` | Submit user feedback |

### Clerk User Endpoints

These endpoints require a Clerk session token:

```http
Authorization: Bearer <clerk_session_token>
```

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/chat/stream` | Stream AI assistant responses |
| `GET` | `/saved-itineraries` | List saved itineraries for the signed-in user |
| `POST` | `/saved-itineraries` | Save a new itinerary for the signed-in user |
| `DELETE` | `/saved-itineraries/:itineraryId` | Soft-delete a saved itinerary |
| `PATCH` | `/saved-itineraries/:itineraryId/title` | Update itinerary title |
| `PATCH` | `/saved-itineraries/:itineraryId/note` | Update itinerary note |
| `PATCH` | `/saved-itineraries/:itineraryId/target-time` | Update itinerary target time |

### User Or Internal Service Endpoints

Capability endpoints require either a Clerk session token or a trusted internal service token:

```http
Authorization: Bearer <clerk_session_token>
```

or:

```http
X-Internal-Service-Token: <internal_service_token>
```

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/predictions` | Single crowd prediction |
| `POST` | `/predictions/batch` | Batch crowd predictions |
| `GET` | `/predictions/forecast` | Future crowd forecast |
| `POST` | `/predictions/explanation` | Prediction explanation |
| `GET` | `/map/heatmap` | Crowd heatmap points |
| `POST` | `/recommendations` | Quieter nearby areas |
| `POST` | `/recommendations/quiet-times` | Quieter visit times |
| `POST` | `/recommendations/places` | Rank candidate places |
| `GET` | `/attractions` | List attractions |
| `GET` | `/attractions/nearby` | Nearby attractions |
| `GET` | `/attractions/search` | Search attractions |
| `GET` | `/attractions/:attractionId` | Attraction detail |
| `POST` | `/itinerary/plan` | Itinerary agent gateway |
| `POST` | `/recommend` | Recommendation agent gateway |

### Internal/Admin Endpoints

Admin statistics endpoints are intended for internal team use and evaluation dashboards.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/stats/predictions` | Prediction usage statistics |
| `GET` | `/admin/stats/feedback` | Feedback statistics |

## 3. Response Envelope

### Success

```json
{
  "success": true,
  "data": {},
  "meta": {
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "INVALID_QUERY",
    "message": "targetTime is not a valid date-time string"
  },
  "meta": {
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

## 4. Shared Types

### Coordinates

```json
{
  "lat": 40.758,
  "lng": -73.9855
}
```

Crowd prediction, heatmap, and recommendation APIs cover Manhattan.

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

### Place Card Item

Saved itineraries and agent place-card responses use this item shape where practical.

```json
{
  "candidateId": "place_123",
  "rank": 1,
  "name": "Central Park",
  "lat": 40.7812,
  "lng": -73.9665,
  "reason": "Predicted to be quieter than nearby alternatives.",
  "subtitle": "Park · Upper Manhattan",
  "detail": "Large urban park in Manhattan."
}
```

## 5. Endpoint Summary

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/predictions` | Predict crowd level for one coordinate and time |
| `POST` | `/predictions/batch` | Predict crowd levels for multiple coordinates |
| `GET` | `/predictions/forecast` | Return future forecast points for one coordinate |
| `POST` | `/predictions/explanation` | Explain a prediction score |
| `GET` | `/map/heatmap` | Return H3 heatmap points |
| `GET` | `/attractions` | List attractions |
| `GET` | `/attractions/nearby` | Find attractions near coordinates |
| `GET` | `/attractions/search` | Search/filter attractions |
| `GET` | `/attractions/:attractionId` | Get attraction detail |
| `POST` | `/recommendations` | Recommend quieter nearby areas |
| `POST` | `/recommendations/quiet-times` | Recommend quieter visit times |
| `POST` | `/recommendations/places` | Rank candidate places by predicted crowd level |
| `POST` | `/chat/stream` | Stream AI assistant output |
| `POST` | `/itinerary/plan` | Plan an itinerary through the itinerary agent |
| `POST` | `/recommend` | Request place recommendations through the agent |
| `GET` | `/saved-itineraries` | List saved itineraries |
| `POST` | `/saved-itineraries` | Save an itinerary |
| `DELETE` | `/saved-itineraries/:itineraryId` | Soft-delete an itinerary |
| `PATCH` | `/saved-itineraries/:itineraryId/title` | Update itinerary title |
| `PATCH` | `/saved-itineraries/:itineraryId/note` | Update itinerary note |
| `PATCH` | `/saved-itineraries/:itineraryId/target-time` | Update itinerary target time |
| `POST` | `/feedback` | Submit feedback |
| `GET` | `/admin/stats/predictions` | Prediction statistics |
| `GET` | `/admin/stats/feedback` | Feedback statistics |

## 6. Health

### GET `/health`

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
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

Response `503`:

```json
{
  "success": false,
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "Database connection failed"
  },
  "meta": {
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

## 7. Prediction APIs

### POST `/predictions`

Request:

```json
{
  "lat": 40.758,
  "lng": -73.9855,
  "targetTime": "2026-07-20T16:30:00-04:00",
  "durationMinutes": 60
}
```

Validation:

- `lat`, `lng`, and `targetTime` are required.
- `targetTime` is a valid date-time string.
- `durationMinutes` is between 15 and 240.
- Coordinates are inside Manhattan coverage.

Response `200`:

```json
{
  "success": true,
  "data": {
    "prediction": {
      "predictionId": "grid_123",
      "h3Cell": "892a100d67bffff",
      "coordinates": {
        "lat": 40.758,
        "lng": -73.9855
      },
      "matchedCoordinates": {
        "lat": 40.7581,
        "lng": -73.9854
      },
      "targetTime": "2026-07-20T16:30:00-04:00",
      "durationMinutes": 60,
      "busynessScore": 82,
      "busynessLevel": "very_busy",
      "crowdCategory": "Very Busy",
      "pedestriansPredicted": 3067.3,
      "period": "PM",
      "confidence": 0.6,
      "modelVersion": "h3-grid-v0.1",
      "cached": true,
      "source": "h3_grid_scores"
    }
  },
  "meta": {
    "modelVersion": "h3-grid-v0.1",
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

### POST `/predictions/batch`

Request:

```json
{
  "targetTime": "2026-07-20T16:30:00-04:00",
  "durationMinutes": 60,
  "coordinates": [
    {
      "clientId": "times-square-card",
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
    "targetTime": "2026-07-20T16:30:00-04:00",
    "durationMinutes": 60,
    "predictions": [
      {
        "predictionId": "grid_123",
        "clientId": "times-square-card",
        "h3Cell": "892a100d67bffff",
        "coordinates": {
          "lat": 40.758,
          "lng": -73.9855
        },
        "busynessScore": 82,
        "busynessLevel": "very_busy",
        "period": "PM",
        "confidence": 0.6,
        "modelVersion": "h3-grid-v0.1",
        "cached": true,
        "source": "h3_grid_scores"
      }
    ],
    "warnings": []
  },
  "meta": {
    "count": 1,
    "warningCount": 0,
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

### GET `/predictions/forecast`

Query parameters:

| Name | Required | Default | Notes |
|---|---:|---|---|
| `lat` | yes | - | Latitude |
| `lng` | yes | - | Longitude |
| `startTime` | yes | - | Valid date-time string |
| `endTime` | yes | - | Valid future date-time string after `startTime` |
| `limit` | no | 6 | Max 24 |

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
    "startTime": "2026-07-20T12:00:00-04:00",
    "endTime": "2026-07-20T18:00:00-04:00",
    "forecast": [
      {
        "timestamp": "2026-07-20T13:00:00-04:00",
        "period": "PM",
        "busynessScore": 54,
        "busynessLevel": "moderate",
        "pedestriansPredicted": 1450.2,
        "source": "h3_grid_scores"
      }
    ]
  },
  "meta": {
    "count": 1,
    "source": "h3_grid_scores",
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

### POST `/predictions/explanation`

Request:

```json
{
  "lat": 40.758,
  "lng": -73.9855,
  "targetTime": "2026-07-20T16:30:00-04:00",
  "busynessScore": 82,
  "period": "PM"
}
```

Response `200`:

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
  "meta": {
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

## 8. Heatmap API

### GET `/map/heatmap`

Query parameters:

| Name | Required | Default | Notes |
|---|---:|---|---|
| `targetTime` | no | Current server time | Valid date-time string |
| `limit` | no | 100 | Max 524 |
| `source` | no | `auto` | `auto`, `ml`, or `database` |

Response `200`:

```json
{
  "success": true,
  "data": {
    "targetTime": "2026-07-20T16:30:00-04:00",
    "source": "heatmap_predictions",
    "points": [
      {
        "h3Cell": "892a1008807ffff",
        "coordinates": {
          "lat": 40.7952379433945,
          "lng": -73.9725090299033
        },
        "period": "PM",
        "queryTimestamp": "2026-07-20T16:30:00-04:00",
        "crowdScore": 53,
        "crowdLevel": "moderate",
        "crowdCategory": "Moderate",
        "pedestriansPredicted": 3399.1,
        "source": "heatmap_predictions"
      }
    ]
  },
  "meta": {
    "count": 1,
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

## 9. Attraction APIs

Attraction responses may include a `crowd` object when recent prediction data is available.

### GET `/attractions`

Query parameters:

| Name | Required | Default | Notes |
|---|---:|---|---|
| `limit` | no | 524 | Max 524 |

Response `200`:

```json
{
  "success": true,
  "data": {
    "attractions": [
      {
        "id": 1,
        "name": "Central Park",
        "category": "Park",
        "neighborhood": "Upper Manhattan",
        "description": "Large urban park in Manhattan.",
        "lat": 40.7812,
        "lng": -73.9665,
        "crowd": {
          "score": 32,
          "level": "quiet",
          "predictedFor": "2026-07-20T16:30:00-04:00"
        }
      }
    ]
  },
  "meta": {
    "count": 1,
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

### GET `/attractions/nearby`

Query parameters:

| Name | Required | Default | Notes |
|---|---:|---|---|
| `lat` | yes | - | Latitude |
| `lng` | yes | - | Longitude |
| `limit` | no | 20 | Max 50 |

Response `200`:

```json
{
  "success": true,
  "data": {
    "attractions": [
      {
        "id": 1,
        "name": "Central Park",
        "category": "Park",
        "neighborhood": "Upper Manhattan",
        "description": "Large urban park in Manhattan.",
        "lat": 40.7812,
        "lng": -73.9665,
        "distanceMeters": 520
      }
    ]
  },
  "meta": {
    "count": 1,
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

### GET `/attractions/search`

Query parameters:

| Name | Required | Default | Notes |
|---|---:|---|---|
| `q` | no | - | Search text matched against name, description, or neighborhood |
| `category` | no | - | Category filter |
| `lat` | no | - | Optional latitude for distance sorting |
| `lng` | no | - | Optional longitude for distance sorting |
| `limit` | no | 20 | Max 50 |

Response `200`:

```json
{
  "success": true,
  "data": {
    "attractions": [
      {
        "id": 1,
        "name": "Central Park",
        "category": "Park",
        "neighborhood": "Upper Manhattan",
        "description": "Large urban park in Manhattan.",
        "lat": 40.7812,
        "lng": -73.9665,
        "distanceMeters": 520
      }
    ]
  },
  "meta": {
    "count": 1,
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

### GET `/attractions/:attractionId`

Response `200`:

```json
{
  "success": true,
  "data": {
    "attraction": {
      "id": 1,
      "name": "Central Park",
      "category": "Park",
      "neighborhood": "Upper Manhattan",
      "description": "Large urban park in Manhattan.",
      "lat": 40.7812,
      "lng": -73.9665,
      "crowd": {
        "score": 32,
        "level": "quiet",
        "predictedFor": "2026-07-20T16:30:00-04:00"
      }
    }
  },
  "meta": {
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

## 10. Recommendation APIs

### POST `/recommendations`

Request:

```json
{
  "lat": 40.758,
  "lng": -73.9855,
  "targetTime": "2026-07-20T16:30:00-04:00",
  "limit": 5
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "targetTime": "2026-07-20T16:30:00-04:00",
    "recommendations": [
      {
        "type": "quieter_area",
        "h3Cell": "892a100d6d3ffff",
        "coordinates": {
          "lat": 40.7714011091155,
          "lng": -73.9737226811384
        },
        "busynessScore": 38,
        "busynessLevel": "quiet",
        "pedestriansPredicted": 920.4,
        "period": "PM",
        "reason": "This nearby grid cell has a lower predicted crowd score."
      }
    ]
  },
  "meta": {
    "count": 1,
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

### POST `/recommendations/quiet-times`

Request:

```json
{
  "lat": 40.758,
  "lng": -73.9855,
  "targetTime": "2026-07-20T16:30:00-04:00",
  "startTime": "2026-07-20T09:00:00-04:00",
  "endTime": "2026-07-20T21:00:00-04:00",
  "limit": 3
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "original": {
      "targetTime": "2026-07-20T16:30:00-04:00",
      "busynessScore": 86,
      "busynessLevel": "very_busy"
    },
    "quietTimes": [
      {
        "targetTime": "2026-07-20T10:00:00-04:00",
        "busynessScore": 42,
        "busynessLevel": "moderate",
        "confidence": 0.6,
        "reason": "Predicted crowd score is lower than the selected time."
      }
    ]
  },
  "meta": {
    "count": 1,
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

### POST `/recommendations/places`

Request:

```json
{
  "currentLocation": {
    "lat": 40.758,
    "lng": -73.9855
  },
  "targetTime": "2026-07-20T16:30:00-04:00",
  "candidatePlaces": [
    {
      "placeId": "poi_1",
      "name": "Central Park",
      "category": "park",
      "coordinates": {
        "lat": 40.7812,
        "lng": -73.9665
      },
      "source": "frontend_place_provider"
    }
  ],
  "limit": 5
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "targetTime": "2026-07-20T16:30:00-04:00",
    "recommendations": [
      {
        "type": "candidate_place",
        "rank": 1,
        "place": {
          "placeId": "poi_1",
          "name": "Central Park",
          "category": "park",
          "coordinates": {
            "lat": 40.7812,
            "lng": -73.9665
          },
          "source": "frontend_place_provider"
        },
        "prediction": {
          "h3Cell": "892a10089abffff",
          "targetTime": "2026-07-20T16:30:00-04:00",
          "busynessScore": 44,
          "busynessLevel": "moderate",
          "confidence": 0.6,
          "source": "h3_grid_scores"
        },
        "distanceMeters": 2400,
        "reason": "This candidate place is ranked using its predicted crowd score and distance from the current location."
      }
    ],
    "warnings": []
  },
  "meta": {
    "count": 1,
    "warningCount": 0,
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

## 11. Agent Gateway APIs

### POST `/chat/stream`

Authentication: Clerk user token only.

Request:

```json
{
  "message": "Plan a quieter afternoon near Central Park.",
  "clientType": "web",
  "conversationId": "conv_123",
  "requestId": "req_123",
  "lat": 40.7812,
  "lng": -73.9665
}
```

Response `200`:

```http
Content-Type: text/event-stream
```

The response body is a Server-Sent Events stream.

### POST `/itinerary/plan`

Request:

```json
{
  "user_id": "user_123",
  "anchor_place": "Central Park",
  "anchor_time": "2026-07-20T10:00:00",
  "duration_hours": 8,
  "additional_context": "We have a stroller and prefer quieter places."
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "itinerary": {}
  },
  "meta": {
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

### POST `/recommend`

Request:

```json
{
  "user_id": "user_123",
  "query": "Find quieter attractions near Central Park",
  "lat": 40.7812,
  "lng": -73.9665,
  "target_time": "2026-07-20T14:00:00"
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "recommendations": []
  },
  "meta": {
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

## 12. Saved Itinerary APIs

Saved itinerary APIs are scoped to the authenticated Clerk user. Ownership is derived from the verified Clerk user id on the request; clients do not send or control the owner user id.

### GET `/saved-itineraries`

Response `200`:

```json
{
  "success": true,
  "data": {
    "itineraries": [
      {
        "id": "uuid",
        "title": "Quiet afternoon in Central Park",
        "source": "itinerary",
        "items": [
          {
            "candidateId": "place_123",
            "rank": 1,
            "name": "Central Park",
            "lat": 40.7812,
            "lng": -73.9665,
            "reason": "Lower predicted crowd level in this time window.",
            "subtitle": "Park · Upper Manhattan",
            "detail": "Large urban park in Manhattan."
          }
        ],
        "description": "A calmer route around Central Park.",
        "note": null,
        "targetTime": "2026-07-20T14:00:00",
        "conversationId": "conv_123",
        "createdAt": "2026-07-20T12:00:00.000Z"
      }
    ]
  },
  "meta": {
    "count": 1,
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

### POST `/saved-itineraries`

Request:

```json
{
  "source": "itinerary",
  "items": [
    {
      "candidateId": "place_123",
      "rank": 1,
      "name": "Central Park",
      "lat": 40.7812,
      "lng": -73.9665,
      "reason": "Lower predicted crowd level in this time window.",
      "subtitle": "Park · Upper Manhattan",
      "detail": "Large urban park in Manhattan."
    }
  ],
  "description": "A calmer route around Central Park.",
  "title": "Quiet afternoon in Central Park",
  "conversationId": "conv_123",
  "targetTime": "2026-07-20T14:00"
}
```

Validation:

- `source` is one of `nearby`, `attractions`, `recommend`, `itinerary`, or `mixed`.
- `items` contains 1 to 50 place-card items.
- `title` is optional and is at most 120 characters.
- `description` is optional and should be truncated or rejected above 1000 characters.
- `targetTime` may be `null` or a valid date-time string.

Response `201`:

```json
{
  "success": true,
  "data": {
    "itinerary": {
      "id": "uuid",
      "title": "Quiet afternoon in Central Park",
      "source": "itinerary",
      "items": [],
      "description": "A calmer route around Central Park.",
      "note": null,
      "targetTime": "2026-07-20T14:00:00",
      "conversationId": "conv_123",
      "createdAt": "2026-07-20T12:00:00.000Z"
    }
  },
  "meta": {
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

### DELETE `/saved-itineraries/:itineraryId`

Response `200`:

```json
{
  "success": true,
  "data": {
    "deleted": true
  },
  "meta": {
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

### PATCH `/saved-itineraries/:itineraryId/title`

Request:

```json
{
  "title": "Updated itinerary title"
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "updated": true,
    "title": "Updated itinerary title"
  },
  "meta": {
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

### PATCH `/saved-itineraries/:itineraryId/note`

Request:

```json
{
  "note": "Bring water."
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "updated": true,
    "note": "Bring water."
  },
  "meta": {
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

### PATCH `/saved-itineraries/:itineraryId/target-time`

Request:

```json
{
  "targetTime": "2026-07-20T15:30"
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "updated": true,
    "targetTime": "2026-07-20T15:30:00"
  },
  "meta": {
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

Saved itinerary errors:

| HTTP | Code |
|---:|---|
| 400 | `INVALID_ITINERARY` |
| 401 | `UNAUTHORIZED` |
| 404 | `NOT_FOUND` |
| 500 | `INTERNAL_ERROR` |

## 13. Feedback API

### POST `/feedback`

Request:

```json
{
  "userId": "optional_user_id",
  "h3Cell": "892a100d67bffff",
  "rating": 5,
  "wasUseful": true,
  "comment": "The prediction was useful."
}
```

Validation:

- `rating` is an integer from 1 to 5.
- `userId`, `h3Cell`, `wasUseful`, and `comment` are optional.

Response `201`:

```json
{
  "success": true,
  "data": {
    "feedback": {
      "id": 1,
      "userId": "optional_user_id",
      "h3Cell": "892a100d67bffff",
      "rating": 5,
      "wasUseful": true,
      "comment": "The prediction was useful.",
      "createdAt": "2026-07-20T12:00:00.000Z"
    }
  },
  "meta": {
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

## 14. Admin Statistics APIs

### GET `/admin/stats/predictions`

Query parameters:

| Name | Required | Default | Notes |
|---|---:|---|---|
| `startDate` | no | all time | Valid date-time string |
| `endDate` | no | all time | Valid date-time string |

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
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

### GET `/admin/stats/feedback`

Query parameters:

| Name | Required | Default | Notes |
|---|---:|---|---|
| `startDate` | no | all time | Valid date-time string |
| `endDate` | no | all time | Valid date-time string |

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
        "createdAt": "2026-07-20T12:00:00.000Z"
      }
    ]
  },
  "meta": {
    "startDate": null,
    "endDate": null,
    "generatedAt": "2026-07-20T12:00:00.000Z"
  }
}
```

## 15. Error Codes

| Code | HTTP | Meaning |
|---|---:|---|
| `UNAUTHORIZED` | 401 | Authentication is missing or invalid |
| `DATABASE_UNAVAILABLE` | 503 | Database connection failed |
| `INVALID_QUERY` | 400/422 | Missing or invalid request fields |
| `INVALID_COORDINATES` | 422 | Latitude/longitude invalid |
| `LOCATION_OUT_OF_COVERAGE` | 422 | Coordinate outside Manhattan coverage |
| `PREDICTION_UNAVAILABLE` | 503 | Prediction, forecast, or recommendation data is unavailable |
| `ML_API_UNAVAILABLE` | 503 | ML service is unavailable |
| `INVALID_RATING` | 422 | Feedback rating is outside 1-5 |
| `ATTRACTION_NOT_FOUND` | 404 | Attraction id was not found |
| `INVALID_ITINERARY` | 400 | Saved itinerary payload is invalid |
| `NOT_FOUND` | 404 | Owned resource was not found |
| `AGENT_UNAVAILABLE` | 503 | Agent service is not configured |
| `AGENT_TIMEOUT` | 504 | Agent did not respond before timeout |
| `AGENT_ERROR` | 502 | Agent request failed |
| `INTERNAL_ERROR` | 500 | Unexpected server failure |

