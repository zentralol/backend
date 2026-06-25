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
// Start the server
app.listen(PORT, () => {
    console.log(`Zentra Backend Server running on http://localhost:${PORT}`);
});