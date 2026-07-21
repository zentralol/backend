const pool = require('../config/database');
const {
    SELECT_SAVED_ITINERARIES_FOR_USER,
    SELECT_OWNED_SAVED_ITINERARY,
    INSERT_SAVED_ITINERARY,
    SOFT_DELETE_SAVED_ITINERARY,
    UPDATE_SAVED_ITINERARY_TITLE,
    UPDATE_SAVED_ITINERARY_NOTE,
    UPDATE_SAVED_ITINERARY_TARGET_TIME
} = require('./sql/savedItineraryQueries');

function listSavedItineraries(userId) {
    return pool.query(SELECT_SAVED_ITINERARIES_FOR_USER, [userId]);
}

function findOwnedSavedItinerary(itineraryId, userId) {
    return pool.query(SELECT_OWNED_SAVED_ITINERARY, [itineraryId, userId]);
}

function createSavedItinerary(userId, payload) {
    return pool.query(INSERT_SAVED_ITINERARY, [
        userId,
        payload.conversationId,
        payload.title,
        payload.source,
        JSON.stringify(payload.items),
        payload.description,
        payload.targetTime
    ]);
}

function softDeleteSavedItinerary(itineraryId, userId) {
    return pool.query(SOFT_DELETE_SAVED_ITINERARY, [itineraryId, userId]);
}

function updateSavedItineraryTitle(itineraryId, userId, title) {
    return pool.query(UPDATE_SAVED_ITINERARY_TITLE, [itineraryId, userId, title]);
}

function updateSavedItineraryNote(itineraryId, userId, note) {
    return pool.query(UPDATE_SAVED_ITINERARY_NOTE, [itineraryId, userId, note]);
}

function updateSavedItineraryTargetTime(itineraryId, userId, targetTime) {
    return pool.query(UPDATE_SAVED_ITINERARY_TARGET_TIME, [itineraryId, userId, targetTime]);
}

module.exports = {
    listSavedItineraries,
    findOwnedSavedItinerary,
    createSavedItinerary,
    softDeleteSavedItinerary,
    updateSavedItineraryTitle,
    updateSavedItineraryNote,
    updateSavedItineraryTargetTime
};
