const INSERT_FEEDBACK = `
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
`;

module.exports = {
    INSERT_FEEDBACK
};
