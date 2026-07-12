const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Without a listener, an error on an idle pooled client (dropped connection,
// server-side idle timeout) is an unhandled 'error' event and kills the
// process. The failure still surfaces on the next query.
pool.on('error', (err) => {
    console.error('Unexpected error on idle database client:', err.message);
});

module.exports = pool;
