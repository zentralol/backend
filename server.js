require('dotenv').config();

// Check if DATABASE_URL is successfully loaded from .env
console.log("Environment variables loaded successfully?", process.env.DATABASE_URL !== undefined);

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Configure DB connection pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for cloud databases
});

// Convert database rows to the API contract shape
function mapLocation(row) {
    return {
        id: String(row.osm_id),
        externalId: `osm_${row.osm_id}`,
        name: row.name,
        type: row.category,
        coordinates: {
            lat: row.lat,
            lng: row.lon
        },
        zoneId: row.zone_id
    };
}
function busynessLevel(score) {
    if (score <= 20) return 'very_quiet';
    if (score <= 40) return 'quiet';
    if (score <= 60) return 'moderate';
    if (score <= 80) return 'busy';
    return 'very_busy';
}

function normalizeScore(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;

    const score = n <= 1 ? n * 100 : n;
    return Math.max(0, Math.min(100, Math.round(score)));
}


const ML_API_BASE_URL = process.env.ML_API_BASE_URL;
const ML_API_TIMEOUT_MS = Number(process.env.ML_API_TIMEOUT_MS) || 5000;

// Check whether the requested time is in the future
function isFutureTime(value) {
    return new Date(value).getTime() > Date.now();
}

// Save prediction request history
async function savePredictionRequest(lat, lng, targetTime, h3Cell, score, source) {
    try {
        await pool.query(
            `
            INSERT INTO prediction_requests
                (lat, lng, requested_time, matched_h3_cell, response_crowd_score, source)
            VALUES
                ($1, $2, $3, $4, $5, $6)
            `,
            [lat, lng, targetTime, h3Cell, score, source]
        );
    } catch (err) {
        console.error('Prediction Request Logging Failed:', err.message);
    }
}

// Call ML FastAPI if available
async function callMlPrediction(lat, lng, targetTime) {
    if (!ML_API_BASE_URL) return null;

    const endpoint = isFutureTime(targetTime) ? '/predict/future' : '/predict/crowd';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ML_API_TIMEOUT_MS);

    try {
        const response = await fetch(`${ML_API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lat,
                lon: lng,
                when: targetTime
            }),
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`ML API returned ${response.status}`);
        }

        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

// Health check endpoint
app.get('/api/v1/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');

        res.status(200).json({
            success: true,
            data: {
                status: 'ok',
                apiVersion: 'v1',
                database: 'connected',
                uptimeSeconds: process.uptime()
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error("Health Check DB Error:", error.message);

        res.status(503).json({
            success: false,
            error: {
                code: 'DATABASE_UNAVAILABLE',
                message: 'Database connection failed'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }
});

// Search locations by name and optional category
app.get('/api/v1/locations/search', async (req, res) => {
    const q = (req.query.q || '').trim();
    const type = (req.query.type || '').trim();
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    try {
        const result = await pool.query(
            `
            SELECT osm_id, name, category, lat, lon, zone_id
            FROM locations
            WHERE
                ($1 = '' OR name ILIKE '%' || $1 || '%')
                AND ($2 = '' OR category = $2)
            ORDER BY name ASC
            LIMIT $3
            `,
            [q, type, limit]
        );

        res.status(200).json({
            success: true,
            data: {
                query: q,
                results: result.rows.map(mapLocation)
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error("Location Search Failed:", err.message);

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Location search failed'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }
});

// Get one location by OSM ID
app.get('/api/v1/locations/:locationId', async (req, res) => {
    const { locationId } = req.params;

    try {
        const result = await pool.query(
            `
            SELECT osm_id, name, category, lat, lon, zone_id
            FROM locations
            WHERE osm_id = $1
            LIMIT 1
            `,
            [locationId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'LOCATION_NOT_FOUND',
                    message: 'Location not found'
                },
                meta: {
                    generatedAt: new Date().toISOString()
                }
            });
        }

        res.status(200).json({
            success: true,
            data: {
                location: mapLocation(result.rows[0])
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error("Location Detail Failed:", err.message);

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Location detail failed'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }
});

// Get heatmap points from H3 grid scores
app.get('/api/v1/map/heatmap', async (req, res) => {
    const period = (req.query.period || '').trim();
    const targetTime = (req.query.targetTime || '').trim();
    const limit = Math.min(Number(req.query.limit) || 1000, 5000);

    if (targetTime && Number.isNaN(Date.parse(targetTime))) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_QUERY',
                message: 'targetTime must be a valid date-time string'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }

    try {
        // Pick one best score per H3 cell for the requested period or time
        const result = await pool.query(
            `
            WITH ranked_scores AS (
                SELECT
                    h3_cell,
                    lat,
                    lon,
                    period,
                    query_timestamp,
                    crowd_score,
                    pedestrians_pred,
                    poi_total,
                    ROW_NUMBER() OVER (
                        PARTITION BY h3_cell
                        ORDER BY
                            CASE
                                WHEN $2 = '' THEN 0
                                ELSE ABS(EXTRACT(EPOCH FROM (query_timestamp - $2::timestamptz)))
                            END ASC,
                            query_timestamp DESC NULLS LAST
                    ) AS row_rank
                FROM h3_grid_scores
                WHERE
                    crowd_score IS NOT NULL
                    AND ($1 = '' OR period = $1)
            )
            SELECT
                h3_cell,
                lat,
                lon,
                period,
                query_timestamp,
                crowd_score,
                pedestrians_pred,
                poi_total
            FROM ranked_scores
            WHERE row_rank = 1
            ORDER BY crowd_score DESC
            LIMIT $3
            `,
            [period, targetTime, limit]
        );

        res.status(200).json({
            success: true,
            data: {
                period: period || null,
                targetTime: targetTime || null,
                points: result.rows.map((row) => {
                    const score = normalizeScore(row.crowd_score);

                    return {
                        h3Cell: row.h3_cell,
                        coordinates: {
                            lat: row.lat,
                            lng: row.lon
                        },
                        period: row.period,
                        queryTimestamp: row.query_timestamp,
                        crowdScore: score,
                        crowdLevel: busynessLevel(score),
                        pedestriansPredicted: row.pedestrians_pred,
                        poiTotal: row.poi_total
                    };
                })
            },
            meta: {
                count: result.rowCount,
                generatedAt: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('Heatmap Query Failed:', err.message);

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Heatmap data query failed'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }
});

// Predict crowd level from latitude, longitude, and target time
app.post('/api/v1/predictions', async (req, res) => {
    const { lat, lng, targetTime, durationMinutes = 60 } = req.body || {};

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    const parsedDuration = Number(durationMinutes);

    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng) || !targetTime) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_QUERY',
                message: 'lat, lng, and targetTime are required'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }

    if (Number.isNaN(Date.parse(targetTime))) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_QUERY',
                message: 'targetTime must be a valid date-time string'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }

    if (parsedLat < 40.679 || parsedLat > 40.882 || parsedLng < -74.020 || parsedLng > -73.907) {
        return res.status(422).json({
            success: false,
            error: {
                code: 'LOCATION_OUT_OF_COVERAGE',
                message: 'Prediction is currently available for Manhattan only'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }

    if (!Number.isFinite(parsedDuration) || parsedDuration < 15 || parsedDuration > 240) {
        return res.status(422).json({
            success: false,
            error: {
                code: 'INVALID_QUERY',
                message: 'durationMinutes must be between 15 and 240'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }

    try {
        try {
            const mlResult = await callMlPrediction(parsedLat, parsedLng, targetTime);

            if (mlResult) {
                const score = normalizeScore(mlResult.crowd_score);

                await savePredictionRequest(
                    parsedLat,
                    parsedLng,
                    targetTime,
                    mlResult.h3_cell,
                    score,
                    'ml_fastapi'
                );

                return res.status(200).json({
                    success: true,
                    data: {
                        prediction: {
                            predictionId: `ml_${mlResult.h3_cell}_${Date.now()}`,
                            h3Cell: mlResult.h3_cell,
                            coordinates: {
                                lat: parsedLat,
                                lng: parsedLng
                            },
                            matchedCoordinates: {
                                lat: mlResult.lat,
                                lng: mlResult.lon
                            },
                            targetTime: mlResult.timestamp || targetTime,
                            durationMinutes: parsedDuration,
                            busynessScore: score,
                            busynessLevel: busynessLevel(score),
                            crowdCategory: mlResult.crowd_category,
                            pedestriansPredicted: mlResult.pedestrians,
                            period: mlResult.period,
                            confidence: isFutureTime(targetTime) ? 0.65 : 0.8,
                            modelVersion: 'ml-fastapi-v1.0',
                            cached: false,
                            source: 'ml_fastapi'
                        }
                    },
                    meta: {
                        modelVersion: 'ml-fastapi-v1.0',
                        generatedAt: new Date().toISOString()
                    }
                });
            }
        } catch (mlError) {
            console.warn('ML API unavailable, falling back to Supabase:', mlError.message);
        }

        const result = await pool.query(
            `
            SELECT
                id,
                h3_cell,
                lat,
                lon,
                period,
                query_timestamp,
                crowd_score,
                pedestrians_pred,
                ensemble_log_pred,
                poi_total,
                poi_density_score,
                tlc_trip_count,
                mta_ridership_total,
                citibike_trip_count,
                created_at
            FROM h3_grid_scores
            WHERE crowd_score IS NOT NULL
            ORDER BY
                ((lat - $1) * (lat - $1) + (lon - $2) * (lon - $2)) ASC,
                ABS(EXTRACT(EPOCH FROM (query_timestamp - $3::timestamptz))) ASC NULLS LAST
            LIMIT 1
            `,
            [parsedLat, parsedLng, targetTime]
        );

        if (result.rowCount === 0) {
            return res.status(503).json({
                success: false,
                error: {
                    code: 'PREDICTION_UNAVAILABLE',
                    message: 'Prediction is not available for this coordinate and time'
                },
                meta: {
                    generatedAt: new Date().toISOString()
                }
            });
        }

        const row = result.rows[0];
        const score = normalizeScore(row.crowd_score);

        await savePredictionRequest(
            parsedLat,
            parsedLng,
            targetTime,
            row.h3_cell,
            score,
            'h3_grid_scores'
        );

        res.status(200).json({
            success: true,
            data: {
                prediction: {
                    predictionId: `grid_${row.id}`,
                    h3Cell: row.h3_cell,
                    coordinates: {
                        lat: parsedLat,
                        lng: parsedLng
                    },
                    matchedCoordinates: {
                        lat: row.lat,
                        lng: row.lon
                    },
                    targetTime,
                    durationMinutes: parsedDuration,
                    busynessScore: score,
                    busynessLevel: busynessLevel(score),
                    pedestriansPredicted: row.pedestrians_pred,
                    period: row.period,
                    confidence: 0.6,
                    modelVersion: 'h3-grid-v0.1',
                    cached: true,
                    source: 'h3_grid_scores',
                    dataFreshness: {
                        lastUpdated: row.created_at,
                        sources: ['poi', 'taxi', 'mta', 'citibike', 'historical_patterns']
                    }
                }
            },
            meta: {
                modelVersion: 'h3-grid-v0.1',
                generatedAt: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('Prediction Failed:', err.message);

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Prediction failed'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Zentra Backend Server running on http://localhost:${PORT}`);
});