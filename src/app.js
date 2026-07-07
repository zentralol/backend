const express = require('express');
const cors = require('cors');

const healthRoutes = require('./routes/healthRoutes');
const heatmapRoutes = require('./routes/heatmapRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/v1', healthRoutes);
app.use('/api/v1/map', heatmapRoutes);
app.use('/api/v1/predictions', predictionRoutes);
app.use('/api/v1/recommendations', recommendationRoutes);
app.use('/api/v1/feedback', feedbackRoutes);
app.use('/api/v1/admin', adminRoutes);

module.exports = app;
