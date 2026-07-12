require('dotenv').config();

const app = require('./src/app');
const { startCrowdPredictionScheduler } = require('./src/jobs/scheduler');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Zentra Backend Server running on http://localhost:${PORT}`);
    startCrowdPredictionScheduler();
});
