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


const ML_API_BASE_URL = (process.env.ML_API_BASE_URL || '').replace(/\/$/, '');
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

// Get heatmap points from ML service or fallback database scores
app.get('/api/v1/map/heatmap', async (req, res) => {
    const targetTime = (req.query.targetTime || new Date().toISOString()).trim();
    const limit = Math.min(Number(req.query.limit) || 100, 524);
    const source = (req.query.source || 'auto').trim(); // auto, ml, database

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
        if (source !== 'database' && ML_API_BASE_URL) {
            try {
                // Use H3 grid cell centroids as ML prediction points
                const cells = await pool.query(
                    `
                    SELECT h3_cell, lat, lon
                    FROM h3_grid_cells
                    ORDER BY h3_cell ASC
                    LIMIT $1
                    `,
                    [limit]
                );

                const points = [];

                for (const cell of cells.rows) {
                    try {
                        const mlResult = await callMlPrediction(cell.lat, cell.lon, targetTime);
                        const score = normalizeScore(mlResult.crowd_score);

                        points.push({
                            h3Cell: mlResult.h3_cell || cell.h3_cell,
                            coordinates: {
                                lat: cell.lat,
                                lng: cell.lon
                            },
                            period: mlResult.period,
                            queryTimestamp: mlResult.timestamp || targetTime,
                            crowdScore: score,
                            crowdLevel: busynessLevel(score),
                            crowdCategory: mlResult.crowd_category,
                            pedestriansPredicted: mlResult.pedestrians,
                            source: 'ml_fastapi'
                        });
                    } catch (pointError) {
                        console.warn('ML heatmap point failed:', pointError.message);
                    }
                }

                if (points.length > 0) {
                    return res.status(200).json({
                        success: true,
                        data: {
                            targetTime,
                            source: 'ml_fastapi',
                            points
                        },
                        meta: {
                            count: points.length,
                            generatedAt: new Date().toISOString()
                        }
                    });
                }

                if (source === 'ml') {
                    return res.status(503).json({
                        success: false,
                        error: {
                            code: 'ML_API_UNAVAILABLE',
                            message: 'ML heatmap data is unavailable'
                        },
                        meta: {
                            generatedAt: new Date().toISOString()
                        }
                    });
                }
            } catch (mlError) {
                console.warn('ML heatmap unavailable, falling back to Supabase:', mlError.message);
            }
        }

        // Fallback to precomputed H3 grid scores in Supabase
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
                            ABS(EXTRACT(EPOCH FROM (query_timestamp - $1::timestamptz))) ASC,
                            query_timestamp DESC NULLS LAST
                    ) AS row_rank
                FROM h3_grid_scores
                WHERE crowd_score IS NOT NULL
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
            LIMIT $2
            `,
            [targetTime, limit]
        );

        res.status(200).json({
            success: true,
            data: {
                targetTime,
                source: 'h3_grid_scores',
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
                        poiTotal: row.poi_total,
                        source: 'h3_grid_scores'
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

// Batch predict crowd levels for multiple coordinates
app.post('/api/v1/predictions/batch', async (req, res) => {
    const { locations, targetTime, durationMinutes = 60 } = req.body || {};
    const parsedDuration = Number(durationMinutes);

    if (!Array.isArray(locations) || locations.length === 0 || locations.length > 100 || !targetTime) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_QUERY',
                message: 'locations must contain 1 to 100 items, and targetTime is required'
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

    const predictions = [];
    const warnings = [];

    for (const item of locations) {
        const parsedLat = Number(item.lat);
        const parsedLng = Number(item.lng);
        const locationId = item.locationId || null;

        if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
            warnings.push({
                locationId,
                code: 'INVALID_COORDINATES',
                message: 'lat and lng must be valid numbers'
            });
            continue;
        }

        if (parsedLat < 40.679 || parsedLat > 40.882 || parsedLng < -74.020 || parsedLng > -73.907) {
            warnings.push({
                locationId,
                code: 'LOCATION_OUT_OF_COVERAGE',
                message: 'Prediction is currently available for Manhattan only'
            });
            continue;
        }

        try {
            let prediction = null;

            try {
                // Try ML FastAPI first
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

                    prediction = {
                        predictionId: `ml_${mlResult.h3_cell}_${Date.now()}`,
                        locationId,
                        h3Cell: mlResult.h3_cell,
                        coordinates: {
                            lat: parsedLat,
                            lng: parsedLng
                        },
                        busynessScore: score,
                        busynessLevel: busynessLevel(score),
                        crowdCategory: mlResult.crowd_category,
                        pedestriansPredicted: mlResult.pedestrians,
                        period: mlResult.period,
                        confidence: isFutureTime(targetTime) ? 0.65 : 0.8,
                        modelVersion: 'ml-fastapi-v1.0',
                        cached: false,
                        source: 'ml_fastapi'
                    };
                }
            } catch (mlError) {
                console.warn('Batch ML API unavailable, falling back to Supabase:', mlError.message);
            }

            if (!prediction) {
                // Fallback to the closest precomputed H3 grid score
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
                        pedestrians_pred
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
                    warnings.push({
                        locationId,
                        code: 'PREDICTION_UNAVAILABLE',
                        message: 'Prediction is not available for this coordinate and time'
                    });
                    continue;
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

                prediction = {
                    predictionId: `grid_${row.id}`,
                    locationId,
                    h3Cell: row.h3_cell,
                    coordinates: {
                        lat: parsedLat,
                        lng: parsedLng
                    },
                    matchedCoordinates: {
                        lat: row.lat,
                        lng: row.lon
                    },
                    busynessScore: score,
                    busynessLevel: busynessLevel(score),
                    pedestriansPredicted: row.pedestrians_pred,
                    period: row.period,
                    confidence: 0.6,
                    modelVersion: 'h3-grid-v0.1',
                    cached: true,
                    source: 'h3_grid_scores'
                };
            }

            predictions.push(prediction);
        } catch (err) {
            console.error('Batch Prediction Failed:', err.message);

            warnings.push({
                locationId,
                code: 'INTERNAL_ERROR',
                message: 'Prediction failed for this location'
            });
        }
    }

    res.status(200).json({
        success: true,
        data: {
            targetTime,
            durationMinutes: parsedDuration,
            predictions,
            warnings
        },
        meta: {
            count: predictions.length,
            warningCount: warnings.length,
            generatedAt: new Date().toISOString()
        }
    });
});

// Get prediction request statistics
app.get('/api/v1/admin/stats/predictions', async (req, res) => {
    const startDate = (req.query.startDate || '').trim();
    const endDate = (req.query.endDate || '').trim();

    if (startDate && Number.isNaN(Date.parse(startDate))) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_QUERY',
                message: 'startDate must be a valid date string'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }

    if (endDate && Number.isNaN(Date.parse(endDate))) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_QUERY',
                message: 'endDate must be a valid date string'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }

    try {
        const result = await pool.query(
            `
            WITH filtered_requests AS (
                SELECT *
                FROM prediction_requests
                WHERE
                    ($1 = '' OR created_at >= $1::timestamptz)
                    AND ($2 = '' OR created_at <= $2::timestamptz)
            )
            SELECT
                COUNT(*)::int AS total_requests,
                AVG(response_crowd_score) AS average_crowd_score,
                COUNT(*) FILTER (WHERE source = 'ml_fastapi')::int AS ml_requests,
                COUNT(*) FILTER (WHERE source = 'h3_grid_scores')::int AS cached_requests,
                COUNT(DISTINCT matched_h3_cell)::int AS unique_h3_cells
            FROM filtered_requests
            `,
            [startDate, endDate]
        );

        const topCells = await pool.query(
            `
            SELECT
                matched_h3_cell,
                COUNT(*)::int AS request_count,
                AVG(response_crowd_score) AS average_crowd_score
            FROM prediction_requests
            WHERE
                matched_h3_cell IS NOT NULL
                AND ($1 = '' OR created_at >= $1::timestamptz)
                AND ($2 = '' OR created_at <= $2::timestamptz)
            GROUP BY matched_h3_cell
            ORDER BY request_count DESC
            LIMIT 10
            `,
            [startDate, endDate]
        );

        const stats = result.rows[0];
        const totalRequests = Number(stats.total_requests) || 0;
        const cachedRequests = Number(stats.cached_requests) || 0;

        res.status(200).json({
            success: true,
            data: {
                totalPredictionRequests: totalRequests,
                averageCrowdScore: stats.average_crowd_score === null
                    ? null
                    : Number(stats.average_crowd_score),
                mlRequests: Number(stats.ml_requests) || 0,
                cachedRequests,
                cacheHitRate: totalRequests === 0 ? 0 : cachedRequests / totalRequests,
                uniqueH3Cells: Number(stats.unique_h3_cells) || 0,
                mostRequestedH3Cells: topCells.rows.map((row) => ({
                    h3Cell: row.matched_h3_cell,
                    count: row.request_count,
                    averageCrowdScore: row.average_crowd_score === null
                        ? null
                        : Number(row.average_crowd_score)
                }))
            },
            meta: {
                startDate: startDate || null,
                endDate: endDate || null,
                generatedAt: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('Prediction Stats Failed:', err.message);

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Prediction statistics query failed'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }
});

// Get crowd forecast for one coordinate
app.get('/api/v1/predictions/forecast', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const startTime = (req.query.startTime || '').trim();
    const endTime = (req.query.endTime || '').trim();
    const limit = Math.min(Number(req.query.limit) || 24, 100);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !startTime || !endTime) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_QUERY',
                message: 'lat, lng, startTime, and endTime are required'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }

    if (Number.isNaN(Date.parse(startTime)) || Number.isNaN(Date.parse(endTime))) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_QUERY',
                message: 'startTime and endTime must be valid date-time strings'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }

    try {
        // Find the nearest H3 cell first
        const nearestCell = await pool.query(
            `
            SELECT h3_cell
            FROM h3_grid_scores
            WHERE crowd_score IS NOT NULL
            ORDER BY ((lat - $1) * (lat - $1) + (lon - $2) * (lon - $2)) ASC
            LIMIT 1
            `,
            [lat, lng]
        );

        if (nearestCell.rowCount === 0) {
            return res.status(503).json({
                success: false,
                error: {
                    code: 'PREDICTION_UNAVAILABLE',
                    message: 'Forecast data is not available for this coordinate'
                },
                meta: {
                    generatedAt: new Date().toISOString()
                }
            });
        }

        const h3Cell = nearestCell.rows[0].h3_cell;

        const result = await pool.query(
            `
            SELECT
                h3_cell,
                lat,
                lon,
                period,
                query_timestamp,
                crowd_score,
                pedestrians_pred
            FROM h3_grid_scores
            WHERE
                h3_cell = $1
                AND crowd_score IS NOT NULL
                AND query_timestamp >= $2::timestamptz
                AND query_timestamp <= $3::timestamptz
            ORDER BY query_timestamp ASC
            LIMIT $4
            `,
            [h3Cell, startTime, endTime, limit]
        );

        res.status(200).json({
            success: true,
            data: {
                h3Cell,
                coordinates: {
                    lat,
                    lng
                },
                startTime,
                endTime,
                forecast: result.rows.map((row) => {
                    const score = normalizeScore(row.crowd_score);

                    return {
                        timestamp: row.query_timestamp,
                        period: row.period,
                        busynessScore: score,
                        busynessLevel: busynessLevel(score),
                        pedestriansPredicted: row.pedestrians_pred
                    };
                })
            },
            meta: {
                count: result.rowCount,
                generatedAt: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('Forecast Query Failed:', err.message);

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Forecast query failed'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }
});

// Recommend quieter nearby H3 cells
app.post('/api/v1/recommendations', async (req, res) => {
    const { lat, lng, targetTime, limit = 5 } = req.body || {};

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    const parsedLimit = Math.min(Number(limit) || 5, 20);

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

    try {
        // Rank nearby grid cells by lower crowd score and distance
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
                    ((lat - $1) * (lat - $1) + (lon - $2) * (lon - $2)) AS distance_score,
                    ROW_NUMBER() OVER (
                        PARTITION BY h3_cell
                        ORDER BY ABS(EXTRACT(EPOCH FROM (query_timestamp - $3::timestamptz))) ASC
                    ) AS row_rank
                FROM h3_grid_scores
                WHERE crowd_score IS NOT NULL
            )
            SELECT
                h3_cell,
                lat,
                lon,
                period,
                query_timestamp,
                crowd_score,
                pedestrians_pred,
                distance_score
            FROM ranked_scores
            WHERE row_rank = 1
            ORDER BY crowd_score ASC, distance_score ASC
            LIMIT $4
            `,
            [parsedLat, parsedLng, targetTime, parsedLimit]
        );

        res.status(200).json({
            success: true,
            data: {
                targetTime,
                recommendations: result.rows.map((row) => {
                    const score = normalizeScore(row.crowd_score);

                    return {
                        type: 'quieter_place',
                        h3Cell: row.h3_cell,
                        coordinates: {
                            lat: row.lat,
                            lng: row.lon
                        },
                        busynessScore: score,
                        busynessLevel: busynessLevel(score),
                        pedestriansPredicted: row.pedestrians_pred,
                        period: row.period,
                        reason: 'This nearby grid cell has a lower predicted crowd score.'
                    };
                })
            },
            meta: {
                count: result.rowCount,
                generatedAt: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('Recommendations Failed:', err.message);

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Recommendation query failed'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }
});

// Submit user feedback for a prediction
app.post('/api/v1/feedback', async (req, res) => {
    const { userId = null, h3Cell = null, rating, wasUseful = null, comment = null } = req.body || {};
    const parsedRating = Number(rating);

    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return res.status(422).json({
            success: false,
            error: {
                code: 'INVALID_RATING',
                message: 'rating must be an integer between 1 and 5'
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    }

    try {
        const result = await pool.query(
            `
            INSERT INTO feedback
                (user_id, h3_cell, rating, was_useful, comment)
            VALUES
                ($1, $2, $3, $4, $5)
            RETURNING
                id,
                user_id,
                h3_cell,
                rating,
                was_useful,
                comment,
                created_at
            `,
            [userId, h3Cell, parsedRating, wasUseful, comment]
        );

        const row = result.rows[0];

        res.status(201).json({
            success: true,
            data: {
                feedback: {
                    id: row.id,
                    userId: row.user_id,
                    h3Cell: row.h3_cell,
                    rating: row.rating,
                    wasUseful: row.was_useful,
                    comment: row.comment,
                    createdAt: row.created_at
                }
            },
            meta: {
                generatedAt: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('Feedback Submission Failed:', err.message);

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Feedback submission failed'
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