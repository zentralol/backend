const INSERT_PREDICTION_REQUEST = `
    INSERT INTO prediction_requests
        (lat, lng, requested_time, matched_h3_cell, response_crowd_score, source)
    VALUES
        ($1, $2, $3, $4, $5, $6)
`;

module.exports = {
    INSERT_PREDICTION_REQUEST
};
