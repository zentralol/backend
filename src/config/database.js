const { Pool } = require('pg');
const { positiveNumberOrDefault } = require('../utils/numbers');

const DEFAULT_QUERY_TIMEOUT_MS = 30000;
const DEFAULT_CONNECT_TIMEOUT_MS = 10000;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    // pg has no default query/connect timeout and no TCP keepalive, so a
    // half-open connection leaves queries pending forever — which would also
    // wedge the crowd-prediction job's run lock permanently. Bounding them
    // turns a hang into a catchable error.
    query_timeout: positiveNumberOrDefault(process.env.DB_QUERY_TIMEOUT_MS, DEFAULT_QUERY_TIMEOUT_MS),
    connectionTimeoutMillis: positiveNumberOrDefault(process.env.DB_CONNECT_TIMEOUT_MS, DEFAULT_CONNECT_TIMEOUT_MS),
    keepAlive: true
});

// Without a listener, an error on an idle pooled client (dropped connection,
// server-side idle timeout) is an unhandled 'error' event and kills the
// process. The failure still surfaces on the next query.
pool.on('error', (err) => {
    console.error('Unexpected error on idle database client:', err.message);
});

module.exports = pool;
