const pool = require('../config/database');
const { CHECK_DATABASE_CONNECTION } = require('./sql/healthQueries');

function checkDatabaseConnection() {
    return pool.query(CHECK_DATABASE_CONNECTION);
}

module.exports = {
    checkDatabaseConnection
};
