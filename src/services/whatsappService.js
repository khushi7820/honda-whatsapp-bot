// src/services/whatsappService.js
const axios = require('axios');
const logger = require('../utils/logger');

const WA_BASE = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v19.0'}`;
const PHONE_ID = () => process.env.WHATSAPP_PHONE_NUMBER_ID;
const TOKEN = () => process.env.WHATSAPP_ACCESS_TOKEN;

function headers() {
  return {
    Authorization: `Bearer ${TOKEN()}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Send a plain text message to a WhatsApp number.
 */
async function sendTextMessage(to, text) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text },
    };

    const res = await axios.post(
      `${WA_BASE}/${PHONE_ID()}/messages`,
      payload,
      { headers: headers() }
    );

    logger.debug(`Message sent to ${to}: ${res.data.messages?.[0]?.id}`);
    return res.data;
  } catch (error) {
    const errData = error.response?.data || error.message;
    logger.error(`Failed to send WA message to ${to}:`, errData);
    throw error;
  }
}

/**
 * Send an interactive list message (for slot/model selection).
 */
async function sendListMessage(to, headerText, bodyText, buttonText, sections) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: { type: 'text', text: headerText },
        body: { text: bodyText },
        action: {
          button: buttonText,
          sections,
        },
      },
    };

    const res = await axios.post(
      `${WA_BASE}/${PHONE_ID()}/messages`,
      payload,
      { headers: headers() }
    );

    logger.debug(`List message sent to ${to}`);
    return res.data;
  } catch (error) {
    logger.error('Failed to send list message:', error.response?.data || error.message);
    // Fallback to text
    const text = sections
      .flatMap((s) => s.rows.map((r) => `• ${r.title}`))
      .join('\n');
    return sendTextMessage(to, `${bodyText}\n\n${text}`);
  }
}

/**
 * Send interactive button message (Yes/No confirmations, etc.)
 */
async function sendButtonMessage(to, bodyText, buttons) {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.map((b, i) => ({
            type: 'reply',
            reply: { id: b.id || `btn_${i}`, title: b.title },
          })),
        },
      },
    };

    const res = await axios.post(
      `${WA_BASE}/${PHONE_ID()}/messages`,
      payload,
      { headers: headers() }
    );

    return res.data;
  } catch (error) {
    logger.error('Failed to send button message:', error.response?.data || error.message);
    // Fallback to text
    const opts = buttons.map((b) => `• ${b.title}`).join('\n');
    return sendTextMessage(to, `${bodyText}\n\n${opts}`);
  }
}

/**
 * Mark an incoming message as read.
 */
async function markMessageRead(messageId) {
  try {
    await axios.post(
      `${WA_BASE}/${PHONE_ID()}/messages`,
      {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      },
      { headers: headers() }
    );
  } catch (error) {
    logger.warn('Could not mark message as read:', error.message);
  }
}

/**
 * Parse incoming webhook payload and extract message details.
 */
function parseIncomingWebhook(body) {
  try {
    // 1. Standard Meta Cloud API Format
    if (body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const value = body.entry[0].changes[0].value;
      const msg = value.messages[0];
      const contact = value.contacts?.[0];

      return {
        messageId: msg.id,
        from: msg.from,
        senderName: contact?.profile?.name || 'Customer',
        timestamp: msg.timestamp,
        type: msg.type,
        text: msg.text?.body || null,
        interactiveId: msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || null,
        interactiveTitle: msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || null,
      };
    }

    // 2. Simple format (Common for some BSPs/11za)
    if (body?.from && (body?.text || body?.body)) {
      return {
        messageId: body.id || `msg_${Date.now()}`,
        from: body.from,
        senderName: body.senderName || body.name || 'Customer',
        timestamp: body.timestamp || Math.floor(Date.now() / 1000),
        type: body.type || 'text',
        text: body.text || body.body || null,
        interactiveId: body.interactiveId || null,
        interactiveTitle: body.interactiveTitle || null,
      };
    }

    return null;
  } catch (e) {
    logger.error('Failed to parse webhook body:', e);
    return null;
  }
}

module.exports = {
  sendTextMessage,
  sendListMessage,
  sendButtonMessage,
  markMessageRead,
  parseIncomingWebhook,
};
