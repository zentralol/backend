const SELECT_SAVED_ITINERARIES_FOR_USER = `
    SELECT
        id,
        user_id,
        conversation_id,
        title,
        source,
        items,
        description,
        note,
        target_time,
        created_at,
        deleted_at
    FROM public.saved_itineraries
    WHERE user_id = $1
      AND deleted_at IS NULL
    ORDER BY created_at DESC
`;

const SELECT_OWNED_SAVED_ITINERARY = `
    SELECT id
    FROM public.saved_itineraries
    WHERE id = $1
      AND user_id = $2
      AND deleted_at IS NULL
`;

const INSERT_SAVED_ITINERARY = `
    INSERT INTO public.saved_itineraries
        (user_id, conversation_id, title, source, items, description, target_time)
    VALUES
        ($1, $2, $3, $4, $5::jsonb, $6, $7)
    RETURNING
        id,
        user_id,
        conversation_id,
        title,
        source,
        items,
        description,
        note,
        target_time,
        created_at,
        deleted_at
`;

const SOFT_DELETE_SAVED_ITINERARY = `
    UPDATE public.saved_itineraries
    SET deleted_at = NOW()
    WHERE id = $1
      AND user_id = $2
      AND deleted_at IS NULL
    RETURNING id
`;

const UPDATE_SAVED_ITINERARY_TITLE = `
    UPDATE public.saved_itineraries
    SET title = $3
    WHERE id = $1
      AND user_id = $2
      AND deleted_at IS NULL
    RETURNING id
`;

const UPDATE_SAVED_ITINERARY_NOTE = `
    UPDATE public.saved_itineraries
    SET note = $3
    WHERE id = $1
      AND user_id = $2
      AND deleted_at IS NULL
    RETURNING id
`;

const UPDATE_SAVED_ITINERARY_TARGET_TIME = `
    UPDATE public.saved_itineraries
    SET target_time = $3
    WHERE id = $1
      AND user_id = $2
      AND deleted_at IS NULL
    RETURNING id
`;

module.exports = {
    SELECT_SAVED_ITINERARIES_FOR_USER,
    SELECT_OWNED_SAVED_ITINERARY,
    INSERT_SAVED_ITINERARY,
    SOFT_DELETE_SAVED_ITINERARY,
    UPDATE_SAVED_ITINERARY_TITLE,
    UPDATE_SAVED_ITINERARY_NOTE,
    UPDATE_SAVED_ITINERARY_TARGET_TIME
};
