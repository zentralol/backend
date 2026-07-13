const express = require('express');
const cors = require('cors');
const { createClerkAuthMiddleware } = require('./middleware/clerkAuth');
const { requireAuthenticatedUser } = require('./middleware/auth');
const { serviceOrUserAuth } = require('./middleware/serviceAuth');
const { requestLogger } = require('./middleware/requestLogger');

const healthRoutes = require('./routes/healthRoutes');
const heatmapRoutes = require('./routes/heatmapRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const itineraryRoutes = require('./routes/itineraryRoutes');
const placeRecommendRoutes = require('./routes/placeRecommendRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const adminRoutes = require('./routes/adminRoutes');
const chatRoutes = require('./routes/chatRoutes');
const attractionRoutes = require('./routes/attractionRoutes');

const app = express();
const clerkAuth = createClerkAuthMiddleware();

app.use(cors());
app.use(clerkAuth);
app.use(express.json());
app.use(requestLogger);

// Capability endpoints accept either a Clerk user (browser) or the internal
// service token (the AI agent calling server-to-server).
app.use('/api/v1', healthRoutes);
app.use('/api/v1/map', serviceOrUserAuth, heatmapRoutes);
app.use('/api/v1/predictions', serviceOrUserAuth, predictionRoutes);
app.use('/api/v1/recommendations', serviceOrUserAuth, recommendationRoutes);
app.use('/api/v1/itinerary', serviceOrUserAuth, itineraryRoutes);
app.use('/api/v1/recommend', serviceOrUserAuth, placeRecommendRoutes);
app.use('/api/v1/attractions', serviceOrUserAuth, attractionRoutes);
app.use('/api/v1/feedback', feedbackRoutes);
app.use('/api/v1/admin', adminRoutes);
// Chat is the public user entry point: Clerk session only, never the service token.
app.use('/api/v1/chat', requireAuthenticatedUser, chatRoutes);

module.exports = app;
