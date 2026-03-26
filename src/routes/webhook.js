// src/routes/webhook.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/conversationController');
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');

// Webhook Verification (GET to /webhook)
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      logger.info('Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    // If not fb, just acknowledge
    res.sendStatus(200);
  }
});

// Incoming Message (POST to /webhook)
router.post('/', async (req, res) => {
  try {
    logger.info('Incoming Webhook Body: ' + JSON.stringify(req.body));
    const data = whatsappService.parseIncomingWebhook(req.body);
    
    // Always return 200 immediately to Meta
    res.status(200).send('EVENT_RECEIVED');

    if (data) {
      // Async process the message
      await controller.handleIncomingMessage(data);
    }
  } catch (err) {
    logger.error('Failed to handle incoming webhook', err);
  }
});

module.exports = router;
