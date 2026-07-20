const ITINERARY_SOURCES = new Set([
    'nearby',
    'attractions',
    'recommend',
    'itinerary',
    'mixed'
]);

const MAX_ITEMS = 50;
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_NOTE_LENGTH = 2000;
const TARGET_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

function mapSavedItineraryRow(row) {
    return {
        id: row.id,
        title: row.title,
        source: row.source,
        items: Array.isArray(row.items) ? row.items : [],
        description: row.description ?? null,
        note: row.note ?? null,
        targetTime: row.target_time ?? null,
        conversationId: row.conversation_id ?? null,
        createdAt: row.created_at instanceof Date
            ? row.created_at.toISOString()
            : row.created_at
    };
}

function deriveItineraryTitle(items) {
    const first = items[0]?.name?.trim();
    if (!first) {
        return 'Saved trip';
    }
    if (items.length === 1) {
        return first;
    }
    return `${first} + ${items.length - 1} more`;
}

function asPlainObject(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return null;
    }
    return input;
}

function requireFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parsePlaceCardItem(value) {
    const object = asPlainObject(value);
    if (!object) {
        return null;
    }

    const candidateId = typeof object.candidateId === 'string'
        ? object.candidateId.trim()
        : '';
    const name = typeof object.name === 'string' ? object.name.trim() : '';
    const lat = requireFiniteNumber(object.lat);
    const lng = requireFiniteNumber(object.lng);
    const rank = object.rank;

    if (
        !candidateId
        || !name
        || lat === null
        || lng === null
        || typeof rank !== 'number'
        || !Number.isInteger(rank)
        || rank < 1
    ) {
        return null;
    }

    return {
        candidateId,
        rank,
        name,
        lat,
        lng,
        reason: typeof object.reason === 'string' ? object.reason : '',
        subtitle: typeof object.subtitle === 'string' ? object.subtitle : '',
        detail: typeof object.detail === 'string' ? object.detail : ''
    };
}

function normalizeTargetTime(value) {
    if (value === undefined || value === null) {
        return { value: null };
    }
    if (typeof value !== 'string') {
        return { error: true };
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return { value: null };
    }
    if (!TARGET_TIME_PATTERN.test(trimmed)) {
        return { error: true };
    }
    return {
        value: trimmed.length === 16 ? `${trimmed}:00` : trimmed
    };
}

function parseTitle(value, { required = false } = {}) {
    if (value === undefined || value === null) {
        return required ? { error: true } : { value: undefined };
    }
    if (typeof value !== 'string') {
        return { error: true };
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return required ? { error: true } : { value: undefined };
    }
    if (trimmed.length > MAX_TITLE_LENGTH) {
        return { error: true };
    }
    return { value: trimmed };
}

function parseNote(value) {
    if (value === undefined || value === null) {
        return { value: '' };
    }
    if (typeof value !== 'string' || value.length > MAX_NOTE_LENGTH) {
        return { error: true };
    }
    return { value };
}

function parseSaveItineraryBody(body) {
    const object = asPlainObject(body);
    if (!object) {
        return { error: 'Invalid itinerary' };
    }

    const source = object.source;
    if (typeof source !== 'string' || !ITINERARY_SOURCES.has(source)) {
        return { error: 'Invalid itinerary' };
    }

    if (!Array.isArray(object.items) || object.items.length === 0 || object.items.length > MAX_ITEMS) {
        return { error: 'Invalid itinerary' };
    }

    const items = [];
    for (const rawItem of object.items) {
        const item = parsePlaceCardItem(rawItem);
        if (!item) {
            return { error: 'Invalid itinerary' };
        }
        items.push(item);
    }

    const conversationId = typeof object.conversationId === 'string'
        ? object.conversationId
        : null;

    let description = null;
    if (object.description !== undefined && object.description !== null) {
        if (typeof object.description !== 'string') {
            return { error: 'Invalid itinerary' };
        }
        const trimmed = object.description.trim();
        if (trimmed) {
            description = trimmed.slice(0, MAX_DESCRIPTION_LENGTH);
        }
    }

    const titleResult = parseTitle(object.title);
    if (titleResult.error) {
        return { error: 'Invalid itinerary' };
    }

    const targetTimeResult = normalizeTargetTime(object.targetTime);
    if (targetTimeResult.error) {
        return { error: 'Invalid itinerary' };
    }

    const title = titleResult.value || deriveItineraryTitle(items);

    return {
        value: {
            source,
            items,
            description,
            title,
            conversationId,
            targetTime: targetTimeResult.value
        }
    };
}

module.exports = {
    mapSavedItineraryRow,
    parseSaveItineraryBody,
    parseTitle,
    parseNote,
    normalizeTargetTime,
    deriveItineraryTitle
};
