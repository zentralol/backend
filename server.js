require('dotenv').config();

const { installConsoleTimestamps } = require('./src/utils/consoleTimestamps');

installConsoleTimestamps();

const app = require('./src/app');
const { startCrowdPredictionScheduler } = require('./src/jobs/scheduler');
const { startH3GridScoreRefreshScheduler } = require('./src/jobs/h3GridScoreScheduler');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Zentra Backend Server running on http://localhost:${PORT}`);
    startCrowdPredictionScheduler();
    startH3GridScoreRefreshScheduler();
});
