function busynessLevel(score) {
    if (score <= 20) return 'very_quiet';
    if (score <= 40) return 'quiet';
    if (score <= 60) return 'moderate';
    if (score <= 80) return 'busy';
    return 'very_busy';
}

function normalizeScore(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;

    const score = n <= 1 ? n * 100 : n;
    return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = {
    busynessLevel,
    normalizeScore
};
