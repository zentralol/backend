// Prefixes every console log/info/warn/error line with an ISO timestamp so
// container logs (docker logs) show when things happened. Installed once at
// server startup; covers all existing console call sites without touching them.

const TIMESTAMPED_METHODS = ['log', 'info', 'warn', 'error'];
const INSTALLED_MARKER = Symbol.for('zentra.consoleTimestamps');

function createTimestampedConsole(baseConsole, now = () => new Date()) {
    return TIMESTAMPED_METHODS.reduce((wrapped, method) => {
        const original = baseConsole[method].bind(baseConsole);
        return {
            ...wrapped,
            [method]: (...args) => original(`[${now().toISOString()}]`, ...args)
        };
    }, {});
}

function installConsoleTimestamps(target = console, now = () => new Date()) {
    if (target[INSTALLED_MARKER]) {
        return target;
    }

    const wrapped = createTimestampedConsole(target, now);
    for (const method of TIMESTAMPED_METHODS) {
        target[method] = wrapped[method];
    }
    target[INSTALLED_MARKER] = true;

    return target;
}

module.exports = {
    createTimestampedConsole,
    installConsoleTimestamps
};
