const express = require('express');
const cors = require('cors');
const { createClerkAuthMiddleware } = require('./middleware/clerkAuth');
const { requireAuthenticatedUser } = require('./middleware/auth');
const { requestLogger } = require('./middleware/requestLogger');

const healthRoutes = require('./routes/healthRoutes');
const heatmapRoutes = require('./routes/heatmapRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const clerkAuth = createClerkAuthMiddleware();

app.use(cors());
app.use(clerkAuth);
app.use(express.json());
app.use(requestLogger);

app.use('/api/v1', healthRoutes);
app.use('/api/v1/map', requireAuthenticatedUser, heatmapRoutes);
app.use('/api/v1/predictions', requireAuthenticatedUser, predictionRoutes);
app.use('/api/v1/recommendations', requireAuthenticatedUser, recommendationRoutes);
app.use('/api/v1/feedback', feedbackRoutes);
app.use('/api/v1/admin', adminRoutes);

module.exports = app;
