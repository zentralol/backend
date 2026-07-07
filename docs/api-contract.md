# Zentra Backend API Contract v1.0

Project: COMP47360 Team 10 - Zentra  
Backend scope: Express.js API gateway, Supabase PostgreSQL data access, FastAPI ML integration, H3 grid prediction service, recommendation support, feedback logging, and admin statistics  
Clients: Web frontend and SwiftUI mobile app  
Last updated: 2026-07-07

## 1. Purpose

This document defines the API surface owned by the Zentra backend.

The backend is responsible for:

- validating prediction, recommendation, feedback, and admin requests;
- calling the FastAPI ML service when available;
- reading fallback prediction data from Supabase PostgreSQL;
- mapping coordinates to H3 grid prediction data;
- returning crowd predictions, heatmap data, recommendations, feedback responses, and admin statistics;
- logging prediction requests for later analysis.

Frontend and mobile clients resolve user-facing app flows and place search/geocoding before calling the backend with coordinates and time values.

## 2. Architecture

```text
Web Frontend / Mobile App
        |
        v
Express Backend API
        |---------------------> FastAPI ML Service
        |
        v
Supabase PostgreSQL
```

Express is the public API gateway. Frontend and mobile clients should call Express, not FastAPI or Supabase directly.

## 3. Base URL

```text
Local API: http://localhost:3000/api/v1
```

All request and response bodies use JSON.

```http
Content-Type: application/json
Accept: application/json
```

Optional request headers:

```http
X-Request-Id: req_client_generated_uuid
Accept-Language: en
```

## 4. Shared Models

### Coordinates

```json
{
  "lat": 40.758,
  "lng": -73.9855
}
```

Current coverage area: Manhattan.

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

### Common Success Response

```json
{
  "success": true,
  "data": {},
  "meta": {
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

### Common Error Response

```json
{
  "success": false,
  "error": {
    "code": "INVALID_QUERY",
    "message": "targetTime must be a valid date-time string"
  },
  "meta": {
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

## 5. Endpoint Summary

| # | Method | Path | State | Purpose |
|---:|---|---|---|---|
| 1 | GET | `/health` | `IMPLEMENTED` | Service and database health |
| 2 | POST | `/predictions` | `IMPLEMENTED` | Single coordinate crowd prediction |
| 3 | POST | `/predictions/batch` | `IMPLEMENTED` | Batch coordinate crowd predictions |
| 4 | GET | `/predictions/forecast` | `IMPLEMENTED` | Crowd forecast for one coordinate |
| 5 | GET | `/map/heatmap` | `IMPLEMENTED` | H3 heatmap points for map display |
| 6 | POST | `/recommendations` | `IMPLEMENTED` | Quieter nearby H3 area recommendations |
| 7 | POST | `/predictions/explanation` | `PLANNED_MVP` | Backend-generated explanation for one prediction |
| 8 | POST | `/recommendations/quiet-times` | `PLANNED_MVP` | Quieter time recommendations for one coordinate |
| 9 | POST | `/recommendations/places` | `PLANNED_AFTER_POI_SOURCE` | Rank candidate places using POI and crowd prediction data |
| 10 | GET | `/poi/search` | `PLANNED_AFTER_POI_SOURCE` | Search POIs from the selected backend POI source/catalog |
| 11 | GET | `/poi/{poiId}` | `PLANNED_AFTER_POI_SOURCE` | Get normalized POI details |
| 12 | GET | `/poi/nearby` | `PLANNED_AFTER_POI_SOURCE` | Find nearby POIs around coordinates |
| 13 | POST | `/itineraries` | `PLANNED_AFTER_POI_SOURCE` | Build a crowd-aware itinerary from candidate POIs |
| 14 | POST | `/routes/crowd-aware` | `PLANNED_AFTER_MVP` | Route-level crowd scoring for frontend-provided route segments |
| 15 | POST | `/events/impact` | `PLANNED_AFTER_MVP` | Estimate event impact on crowd predictions |
| 16 | GET | `/alerts/crowd` | `PLANNED_AFTER_MVP` | Return crowd/event alerts for an area and time window |
| 17 | POST | `/feedback` | `IMPLEMENTED` | Store user feedback about prediction usefulness |
| 18 | GET | `/admin/stats/predictions` | `IMPLEMENTED` | Prediction request statistics |
| 19 | GET | `/admin/stats/feedback` | `PLANNED_MVP` | Feedback analytics |

## 6. Implemented Endpoints

### 6.1 Health Check

`GET /health`

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
    "generatedAt": "2026-07-07T12:00:00Z"
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
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

### 6.2 Single Crowd Prediction

`POST /predictions`

Request:

```json
{
  "lat": 40.758,
  "lng": -73.9855,
  "targetTime": "2026-07-01T16:30:00-04:00",
  "durationMinutes": 60
}
```

Validation:

- `lat`, `lng`, and `targetTime` are required.
- `targetTime` must be a valid date-time string.
- `durationMinutes` must be between 15 and 240 when provided.
- Coordinates must be inside the supported Manhattan coverage area.

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
      "targetTime": "2026-07-01T16:30:00-04:00",
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
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

Backend behavior:

- Try FastAPI ML first when `ML_API_BASE_URL` is configured.
- Fall back to Supabase `h3_grid_scores` when ML is unavailable.
- Save the request to `prediction_requests`.

### 6.3 Batch Crowd Prediction

`POST /predictions/batch`

Request:

```json
{
  "targetTime": "2026-07-01T16:30:00-04:00",
  "durationMinutes": 60,
  "coordinates": [
    {
      "clientId": "times-square-card",
      "lat": 40.758,
      "lng": -73.9855
    },
    {
      "clientId": "union-square-card",
      "lat": 40.7359,
      "lng": -73.9911
    }
  ]
}
```

Validation:

- `coordinates` must contain 1 to 100 items.
- Each item must include valid `lat` and `lng`.
- `clientId` is optional and is echoed back when provided.

Response `200`:

```json
{
  "success": true,
  "data": {
    "targetTime": "2026-07-01T16:30:00-04:00",
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
        "matchedCoordinates": {
          "lat": 40.7581,
          "lng": -73.9854
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
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

### 6.4 Coordinate Forecast

`GET /predictions/forecast?lat={lat}&lng={lng}&startTime={iso}&endTime={iso}&limit={limit}`

Query parameters:

| Name | Required | Default | Notes |
|---|---:|---|---|
| `lat` | yes | - | Latitude |
| `lng` | yes | - | Longitude |
| `startTime` | yes | - | Valid date-time string |
| `endTime` | yes | - | Valid date-time string |
| `limit` | no | 24 | Max 100 |

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
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

### 6.5 Map Heatmap

`GET /map/heatmap?targetTime={iso}&limit={limit}&source={source}`

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
    "source": "h3_grid_scores",
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
        "poiTotal": 42,
        "source": "h3_grid_scores"
      }
    ]
  },
  "meta": {
    "count": 1,
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

### 6.6 Quieter Area Recommendations

`POST /recommendations`

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
        "reason": "This nearby H3 area has a lower predicted crowd score."
      }
    ]
  },
  "meta": {
    "count": 1,
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

### 6.7 Submit Feedback

`POST /feedback`

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

- `rating` must be an integer from 1 to 5.
- `userId`, `h3Cell`, `wasUseful`, and `comment` are optional.

Response `201`:

```json
{
  "success": true,
  "data": {
    "feedback": {
      "id": "1",
      "userId": "optional_user_id",
      "h3Cell": "892a100d67bffff",
      "rating": 5,
      "wasUseful": true,
      "comment": "The prediction was useful.",
      "createdAt": "2026-07-07T12:00:00Z"
    }
  },
  "meta": {
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

### 6.8 Admin Prediction Statistics

`GET /admin/stats/predictions?startDate={iso}&endDate={iso}`

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
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

## 7. Planned Backend Endpoints

### 7.1 Quieter Time Recommendations

`POST /recommendations/quiet-times`

Purpose: recommend lower-crowd times for the same coordinate within a client-provided time window.

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
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

### 7.2 Candidate Place Recommendations

`POST /recommendations/places`

Purpose: rank candidate places that the frontend has already resolved through its own place search or geocoding provider.

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
    "targetTime": "2026-07-01T16:30:00-04:00",
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
          "busynessScore": 44,
          "busynessLevel": "moderate",
          "confidence": 0.7,
          "source": "ml_fastapi"
        },
        "distanceMeters": 2400,
        "reason": "This place is predicted to be less crowded than the current area."
      }
    ],
    "warnings": []
  },
  "meta": {
    "count": 1,
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

### 7.3 Admin Feedback Statistics

`GET /admin/stats/feedback?startDate={iso}&endDate={iso}`

Purpose: summarize feedback quality and usefulness by time range and H3 cell.

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
        "createdAt": "2026-07-07T12:00:00Z"
      }
    ]
  },
  "meta": {
    "startDate": null,
    "endDate": null,
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

### 7.4 Crowd-Aware Route Scoring

`POST /routes/crowd-aware`

Purpose: score route segments supplied by the frontend or routing provider. The backend does not generate the route geometry.

Request:

```json
{
  "targetTime": "2026-07-01T16:30:00-04:00",
  "routes": [
    {
      "routeId": "route_1",
      "transportMode": "walk",
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
          }
        }
      ]
    }
  ]
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
        "overallCrowdScore": 58,
        "overallCrowdLevel": "moderate",
        "segments": [
          {
            "order": 1,
            "crowdScore": 72,
            "crowdLevel": "busy",
            "h3Cells": ["892a100d67bffff"]
          }
        ],
        "reason": "This route crosses some busy H3 areas."
      }
    ]
  },
  "meta": {
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

### 7.5 Prediction Explanation

`POST /predictions/explanation`

Purpose: generate structured explanation text for one prediction result that clients may display in their own UI.

Request:

```json
{
  "lat": 40.758,
  "lng": -73.9855,
  "targetTime": "2026-07-01T16:30:00-04:00",
  "h3Cell": "892a100d67bffff",
  "busynessScore": 82,
  "busynessLevel": "very_busy",
  "period": "PM",
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
        "Nearby transit, visitor activity, or POI density may increase foot traffic."
      ],
      "suggestedAction": "Consider a quieter nearby area or a different time.",
      "disclaimer": "This is a model prediction, not a live crowd count."
    }
  },
  "meta": {
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

### 7.6 POI Search

`GET /poi/search?q={query}&category={category}&lat={lat}&lng={lng}&limit={limit}`

Purpose: search POIs from the selected backend POI source or cached POI catalog once that source is confirmed.

Response `200`:

```json
{
  "success": true,
  "data": {
    "query": "museum",
    "pois": [
      {
        "poiId": "poi_1",
        "name": "Museum of Modern Art",
        "category": "museum",
        "coordinates": {
          "lat": 40.7614,
          "lng": -73.9776
        },
        "source": "poi_provider",
        "address": "11 W 53rd St, New York, NY"
      }
    ]
  },
  "meta": {
    "count": 1,
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

### 7.7 POI Detail

`GET /poi/{poiId}`

Purpose: return normalized POI details from the selected POI source or cached POI catalog.

Response `200`:

```json
{
  "success": true,
  "data": {
    "poi": {
      "poiId": "poi_1",
      "name": "Museum of Modern Art",
      "category": "museum",
      "coordinates": {
        "lat": 40.7614,
        "lng": -73.9776
      },
      "source": "poi_provider",
      "address": "11 W 53rd St, New York, NY",
      "openingHours": null,
      "accessibility": null
    }
  },
  "meta": {
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

### 7.8 Nearby POIs

`GET /poi/nearby?lat={lat}&lng={lng}&radiusMeters={radiusMeters}&category={category}&limit={limit}`

Purpose: return POIs near a coordinate after the backend POI source is available.

Response `200`:

```json
{
  "success": true,
  "data": {
    "origin": {
      "lat": 40.758,
      "lng": -73.9855
    },
    "pois": [
      {
        "poiId": "poi_1",
        "name": "Bryant Park",
        "category": "park",
        "coordinates": {
          "lat": 40.7536,
          "lng": -73.9832
        },
        "distanceMeters": 520,
        "source": "poi_provider"
      }
    ]
  },
  "meta": {
    "count": 1,
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

### 7.9 Crowd-Aware Itinerary

`POST /itineraries`

Purpose: build a timed itinerary from candidate places, crowd predictions, travel-time assumptions, and user-selected constraints supplied by the client.

Request:

```json
{
  "startLocation": {
    "lat": 40.758,
    "lng": -73.9855
  },
  "startTime": "2026-07-01T10:00:00-04:00",
  "endTime": "2026-07-01T16:00:00-04:00",
  "candidatePlaces": [
    {
      "poiId": "poi_1",
      "name": "Museum of Modern Art",
      "category": "museum",
      "coordinates": {
        "lat": 40.7614,
        "lng": -73.9776
      }
    }
  ],
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
      "itineraryId": "itin_123",
      "summary": "A crowd-aware Manhattan plan for the selected time window.",
      "stops": [
        {
          "order": 1,
          "arrivalTime": "2026-07-01T10:00:00-04:00",
          "departureTime": "2026-07-01T11:30:00-04:00",
          "place": {
            "poiId": "poi_1",
            "name": "Museum of Modern Art"
          },
          "prediction": {
            "busynessScore": 48,
            "busynessLevel": "moderate",
            "h3Cell": "892a100d2d7ffff"
          },
          "reason": "This stop is predicted to be less crowded during the selected window."
        }
      ],
      "warnings": []
    }
  },
  "meta": {
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

### 7.10 Event Impact

`POST /events/impact`

Purpose: estimate how known events may affect crowd prediction for an area and time.

Request:

```json
{
  "lat": 40.758,
  "lng": -73.9855,
  "targetTime": "2026-07-01T16:30:00-04:00",
  "radiusMeters": 1000
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "impact": {
      "level": "medium",
      "scoreAdjustment": 8,
      "events": [
        {
          "eventId": "event_1",
          "name": "Concert near Times Square",
          "startTime": "2026-07-01T18:00:00-04:00",
          "distanceMeters": 650
        }
      ],
      "reason": "Nearby events may increase foot traffic around the selected time."
    }
  },
  "meta": {
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```

### 7.11 Crowd Alerts

`GET /alerts/crowd?lat={lat}&lng={lng}&startTime={iso}&endTime={iso}&radiusMeters={radiusMeters}`

Purpose: return crowd and event alerts for a user-selected area and time window.

Response `200`:

```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "alertId": "alert_1",
        "type": "high_crowd_prediction",
        "severity": "warning",
        "title": "Very busy period expected",
        "message": "This area is predicted to be very busy during the selected time window.",
        "h3Cell": "892a100d67bffff",
        "startTime": "2026-07-01T16:00:00-04:00",
        "endTime": "2026-07-01T18:00:00-04:00"
      }
    ]
  },
  "meta": {
    "count": 1,
    "generatedAt": "2026-07-07T12:00:00Z"
  }
}
```
## 8. Internal ML Integration

Frontend and mobile clients do not call FastAPI directly.

Express uses this environment variable to call the ML service:

```text
ML_API_BASE_URL=http://localhost:8000
```

Current ML endpoints consumed by Express:

```text
POST /predict/crowd
POST /predict/future
GET  /predict/crowd-score
```

Expected ML prediction fields:

```json
{
  "h3_cell": "892a100d67bffff",
  "lat": 40.758,
  "lon": -73.9855,
  "timestamp": "2026-07-01T16:30:00-04:00",
  "period": "PM",
  "crowd_score": 0.82,
  "crowd_category": "Very Busy",
  "pedestrians": 3067.3
}
```

## 9. Supabase PostgreSQL Usage

The backend uses Supabase as a hosted PostgreSQL database through the `pg` driver and `DATABASE_URL` connection string.

Current backend-owned tables:

| Table | Backend usage |
|---|---|
| `h3_grid_scores` | Read prediction fallback, forecast, heatmap, and recommendation data |
| `h3_grid_cells` | Read H3 cell centroids for ML heatmap requests |
| `prediction_requests` | Insert prediction request logs and read admin prediction statistics |
| `feedback` | Insert user feedback and read feedback statistics |

Supabase is used as database infrastructure only. The backend does not expose Supabase keys to frontend or mobile clients.

## 10. Error Codes

| Code | HTTP | Meaning |
|---|---:|---|
| `DATABASE_UNAVAILABLE` | 503 | Database connection failed |
| `INVALID_QUERY` | 400/422 | Missing or invalid request fields |
| `INVALID_COORDINATES` | 422 | Latitude/longitude invalid |
| `LOCATION_OUT_OF_COVERAGE` | 422 | Coordinate outside Manhattan coverage |
| `PREDICTION_UNAVAILABLE` | 503 | No ML or fallback prediction available |
| `ML_API_UNAVAILABLE` | 503 | FastAPI ML service unavailable |
| `INVALID_RATING` | 422 | Feedback rating must be 1-5 |
| `INTERNAL_ERROR` | 500 | Unexpected server failure |




