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

// GET Endpoint: Fetch locations
app.get('/api/v1/locations', async (req, res) => {
    try {
        const result = await pool.query('SELECT osm_id, name, category, lat, lon, zone_id FROM locations LIMIT 10');
        
        res.json({
            status: 'success',
            results: result.rowCount,
            data: result.rows
        });
    } catch (err) {
        console.error("DB Query Failed:", err.message);
        res.status(500).json({ status: 'error', message: 'Database connection or query failed' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Zentra Backend Server running on http://localhost:${PORT}`);
});