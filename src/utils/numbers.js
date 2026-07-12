// Parses env-style values where anything that is not a positive number must
// fall back: a zero or negative timeout/interval would silently disable the
// protection it was meant to provide (setInterval clamps <=0 to ~1ms; pg
// treats a 0 timeout as "wait forever").
function positiveNumberOrDefault(value, defaultValue) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

module.exports = {
    positiveNumberOrDefault
};
