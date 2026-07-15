const express = require('express');
const { getH3GridCells, getHeatmapScores } = require('../repositories/h3Repository');
const { getCachedHeatmapPredictions } = require('../repositories/heatmapRepository');
const { callMlPrediction, isMlConfigured } = require('../services/mlClient');
const { busynessLevel, normalizeScore } = require('../utils/busyness');
const { isValidDateTime, parseLimit } = require('../utils/validation');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();

function mapCachedHeatmapPoint(row) {
    const score = normalizeScore(row.crowd_score);

    return {
        h3Cell: row.h3_cell,
        coordinates: {
            lat: row.lat,
            lng: row.lon
        },
        period: row.period,
        queryTimestamp: row.target_time,
        crowdScore: score,
        crowdLevel: row.crowd_level || busynessLevel(score),
        crowdCategory: row.crowd_category,
        pedestriansPredicted: row.pedestrians_pred,
        source: row.source || 'heatmap_predictions'
    };
}

function mapH3HeatmapPoint(row) {
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
}

async function buildMlHeatmapPoints(targetTime, limit) {
    const cells = await getH3GridCells(limit);
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

    return points;
}

router.get('/heatmap', async (req, res) => {
    const targetTime = (req.query.targetTime || new Date().toISOString()).trim();
    const limit = parseLimit(req.query.limit, 100, 524);
    const source = (req.query.source || 'auto').trim();

    if (!isValidDateTime(targetTime)) {
        return sendError(res, 400, 'INVALID_QUERY', 'targetTime must be a valid date-time string');
    }

    try {
        if (source !== 'ml') {
            const cachedResult = await getCachedHeatmapPredictions(targetTime, limit);

            if (cachedResult.rowCount > 0) {
                const points = cachedResult.rows.map(mapCachedHeatmapPoint);

                return sendSuccess(res, 200, {
                    targetTime,
                    source: 'heatmap_predictions',
                    points
                }, { count: cachedResult.rowCount });
            }
        }

        if (source !== 'database' && isMlConfigured()) {
            try {
                const points = await buildMlHeatmapPoints(targetTime, limit);

                if (points.length > 0) {
                    return sendSuccess(res, 200, {
                        targetTime,
                        source: 'ml_fastapi',
                        points
                    }, { count: points.length });
                }

                if (source === 'ml') {
                    return sendError(res, 503, 'ML_API_UNAVAILABLE', 'ML heatmap data is unavailable');
                }
            } catch (mlError) {
                console.warn('ML heatmap unavailable, falling back to Supabase:', mlError.message);
            }
        }

        const result = await getHeatmapScores(targetTime, limit);
        const points = result.rows.map(mapH3HeatmapPoint);

        return sendSuccess(res, 200, {
            targetTime,
            source: 'h3_grid_scores',
            points
        }, { count: result.rowCount });
    } catch (err) {
        console.error('Heatmap Query Failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Heatmap data query failed');
    }
});

module.exports = router;
