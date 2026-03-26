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

app.get('/', (req, res) => {
  res.send('🚗 Honda WhatsApp Booking Bot is Live! Use /webhook for the WhatsApp API.');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Honda WhatsApp Booking Bot',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use('/webhook', webhookRoutes);
// Provide a fallback for the path the user is trying to use in 11za
app.use('/api/webhook/whatsapp', webhookRoutes);
app.use('/admin', adminRoutes);

app.use(errorHandler);

module.exports = app;
