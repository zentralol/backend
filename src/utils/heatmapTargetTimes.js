const NEW_YORK_TIME_ZONE = 'America/New_York';
const DEFAULT_HORIZON_HOURS = 8;

const MANHATTAN_PARTS_FORMATTER = new Intl.DateTimeFormat('en-CA', {
    timeZone: NEW_YORK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
});

function formatManhattanNaiveIso(date) {
    const parts = Object.fromEntries(
        MANHATTAN_PARTS_FORMATTER.formatToParts(date)
            .filter(({ type }) => type !== 'literal')
            .map(({ type, value }) => [type, value])
    );

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function addHours(date, hours) {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function buildHeatmapTargetTimes(now = new Date(), horizonHours = DEFAULT_HORIZON_HOURS) {
    const safeHorizon = Math.max(0, Number(horizonHours) || 0);

    return Array.from({ length: safeHorizon + 1 }, (_, hoursAhead) =>
        formatManhattanNaiveIso(addHours(now, hoursAhead))
    );
}

function buildHeatmapRetentionCutoff(now = new Date(), retentionHours = 48) {
    const safeRetention = Math.max(1, Number(retentionHours) || 48);
    return formatManhattanNaiveIso(addHours(now, -safeRetention));
}

module.exports = {
    DEFAULT_HORIZON_HOURS,
    formatManhattanNaiveIso,
    buildHeatmapTargetTimes,
    buildHeatmapRetentionCutoff
};
