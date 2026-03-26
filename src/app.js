const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const webhookRoutes = require('./routes/webhook');
const adminRoutes = require('./routes/admin');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());

// Webhook routes need raw body for verification, but json is fine for Meta
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Honda WhatsApp Booking Bot',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use('/webhook', webhookRoutes);
app.use('/admin', adminRoutes);

app.use(errorHandler);

module.exports = app;
