// Runs fn over items with at most `limit` calls in flight at once.
// Results keep the input order; each entry is
// { status: 'fulfilled', value } or { status: 'rejected', reason },
// so one failing item never aborts the rest.
async function mapWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;

            try {
                results[index] = { status: 'fulfilled', value: await fn(items[index], index) };
            } catch (reason) {
                results[index] = { status: 'rejected', reason };
            }
        }
    }

    const workerCount = Math.max(1, Math.min(limit, items.length));
    await Promise.all(Array.from({ length: workerCount }, worker));

    return results;
}

module.exports = {
    mapWithConcurrency
};
