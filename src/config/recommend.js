// Configuration for the zentra-recommend itinerary/recommendation service.
//
// The Express gateway proxies AI place recommendations and day itineraries to
// this upstream FastAPI service. Values are read from the environment on each
// access so tests and deployments can point at different hosts.

function baseUrl() {
    return (process.env.RECOMMEND_API_BASE_URL || '').replace(/\/$/, '');
}

function timeoutMs() {
    return Number(process.env.RECOMMEND_API_TIMEOUT_MS) || 60000;
}

module.exports = {
    baseUrl,
    timeoutMs
};
