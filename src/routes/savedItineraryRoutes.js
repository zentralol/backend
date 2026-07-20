const express = require('express');
const {
    listSavedItineraries,
    createSavedItinerary,
    softDeleteSavedItinerary,
    updateSavedItineraryTitle,
    updateSavedItineraryNote,
    updateSavedItineraryTargetTime
} = require('../repositories/savedItineraryRepository');
const {
    mapSavedItineraryRow,
    parseSaveItineraryBody,
    parseTitle,
    parseNote,
    normalizeTargetTime
} = require('../utils/savedItinerary');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseItineraryId(value) {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
        return null;
    }
    return value;
}

router.get('/', async (req, res) => {
    try {
        const result = await listSavedItineraries(req.user.id);
        const itineraries = result.rows.map(mapSavedItineraryRow);
        return sendSuccess(res, 200, { itineraries }, { count: itineraries.length });
    } catch (err) {
        console.error('List saved itineraries failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Could not load saved trips');
    }
});

router.post('/', async (req, res) => {
    const parsed = parseSaveItineraryBody(req.body);
    if (parsed.error) {
        return sendError(res, 400, 'INVALID_ITINERARY', parsed.error);
    }

    try {
        const result = await createSavedItinerary(req.user.id, parsed.value);
        const row = result.rows[0];
        if (!row) {
            return sendError(res, 500, 'INTERNAL_ERROR', 'Could not save trip');
        }
        return sendSuccess(res, 201, { itinerary: mapSavedItineraryRow(row) });
    } catch (err) {
        console.error('Create saved itinerary failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Could not save trip');
    }
});

router.delete('/:itineraryId', async (req, res) => {
    const itineraryId = parseItineraryId(req.params.itineraryId);
    if (!itineraryId) {
        return sendError(res, 400, 'INVALID_ITINERARY_ID', 'Invalid trip id');
    }

    try {
        const result = await softDeleteSavedItinerary(itineraryId, req.user.id);
        if (result.rowCount === 0) {
            return sendError(res, 404, 'NOT_FOUND', 'Trip not found');
        }
        return sendSuccess(res, 200, { deleted: true });
    } catch (err) {
        console.error('Delete saved itinerary failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Could not delete trip');
    }
});

router.patch('/:itineraryId/title', async (req, res) => {
    const itineraryId = parseItineraryId(req.params.itineraryId);
    if (!itineraryId) {
        return sendError(res, 400, 'INVALID_ITINERARY_ID', 'Invalid trip id');
    }

    const titleResult = parseTitle(req.body?.title, { required: true });
    if (titleResult.error) {
        return sendError(res, 400, 'INVALID_TITLE', 'Invalid title');
    }

    try {
        const result = await updateSavedItineraryTitle(itineraryId, req.user.id, titleResult.value);
        if (result.rowCount === 0) {
            return sendError(res, 404, 'NOT_FOUND', 'Trip not found');
        }
        return sendSuccess(res, 200, { updated: true, title: titleResult.value });
    } catch (err) {
        console.error('Update saved itinerary title failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Could not update title');
    }
});

router.patch('/:itineraryId/note', async (req, res) => {
    const itineraryId = parseItineraryId(req.params.itineraryId);
    if (!itineraryId) {
        return sendError(res, 400, 'INVALID_ITINERARY_ID', 'Invalid trip id');
    }

    const noteResult = parseNote(req.body?.note);
    if (noteResult.error) {
        return sendError(res, 400, 'INVALID_NOTE', 'Invalid note');
    }

    const note = noteResult.value.length > 0 ? noteResult.value : null;

    try {
        const result = await updateSavedItineraryNote(itineraryId, req.user.id, note);
        if (result.rowCount === 0) {
            return sendError(res, 404, 'NOT_FOUND', 'Trip not found');
        }
        return sendSuccess(res, 200, { updated: true, note });
    } catch (err) {
        console.error('Update saved itinerary note failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Could not update note');
    }
});

router.patch('/:itineraryId/target-time', async (req, res) => {
    const itineraryId = parseItineraryId(req.params.itineraryId);
    if (!itineraryId) {
        return sendError(res, 400, 'INVALID_ITINERARY_ID', 'Invalid trip id');
    }

    const targetTimeResult = normalizeTargetTime(req.body?.targetTime);
    if (targetTimeResult.error) {
        return sendError(res, 400, 'INVALID_TARGET_TIME', 'Invalid target time');
    }

    try {
        const result = await updateSavedItineraryTargetTime(
            itineraryId,
            req.user.id,
            targetTimeResult.value
        );
        if (result.rowCount === 0) {
            return sendError(res, 404, 'NOT_FOUND', 'Trip not found');
        }
        return sendSuccess(res, 200, { updated: true, targetTime: targetTimeResult.value });
    } catch (err) {
        console.error('Update saved itinerary target time failed:', err.message);
        return sendError(res, 500, 'INTERNAL_ERROR', 'Could not update target time');
    }
});

module.exports = router;
