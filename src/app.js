const express = require('express');
const cors = require('cors');
const { createClerkAuthMiddleware } = require('./middleware/clerkAuth');
const { requireAdmin, requireAuthenticatedUser } = require('./middleware/auth');

const healthRoutes = require('./routes/healthRoutes');
const heatmapRoutes = require('./routes/heatmapRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const clerkAuth = createClerkAuthMiddleware();

app.use(cors());
app.use(express.json());

app.use('/api/v1', healthRoutes);
app.use('/api/v1/map', clerkAuth, requireAuthenticatedUser, heatmapRoutes);
app.use('/api/v1/predictions', clerkAuth, requireAuthenticatedUser, predictionRoutes);
app.use('/api/v1/recommendations', clerkAuth, requireAuthenticatedUser, recommendationRoutes);
app.use('/api/v1/feedback', clerkAuth, requireAuthenticatedUser, feedbackRoutes);
app.use('/api/v1/admin', clerkAuth, requireAdmin, adminRoutes);

module.exports = app;
