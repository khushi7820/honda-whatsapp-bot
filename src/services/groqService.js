// src/services/groqService.js
const Groq = require('groq-sdk');
const logger = require('../utils/logger');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = 'mistral-saba-24b'; // Mistral on Groq

// Max history turns to keep per session (to manage token limits)
const MAX_HISTORY_TURNS = 10;

/**
 * The system prompt that shapes Mistral's behavior as a Honda booking assistant.
 */
function buildSystemPrompt(sessionData) {
  const { HONDA_MODELS, SUPPORTED_CITIES } = require('../config/constants');
  const models = HONDA_MODELS.join(', ');
  const cities = (SUPPORTED_CITIES || []).join(', ');

  return `You are "Honda Assistant" — a friendly, professional AI chatbot for Honda India helping customers book test drives.

## Your Personality
- Warm, helpful, and professional
- Understands both English and Hinglish (Hindi-English mix)
- Always responds in the same language the user uses
- Keep responses concise (2–4 sentences max for WhatsApp)

## Available Honda Models
${models}

## Available Cities
${cities}

## Current Booking Data Collected
${JSON.stringify(sessionData || {}, null, 2)}

## Core Rules
1. Extract structured data (name, city, car model, date, time) from natural language
2. Always validate dates: no past dates, max 7 days ahead
3. When user says time like "sham mein" (evening) → map to 4 PM–6 PM slots
4. When user says "kal" → tomorrow, "parso" → day after tomorrow
5. Never make up slot availability — the backend checks real data
6. If user asks something off-topic, politely redirect to booking
7. Be empathetic if slots are full — offer alternatives
8. Confirm all details before finalizing

## Response Format
- Always respond in plain text (no markdown, no HTML)
- Use line breaks sparingly for readability
- End confirmations with 🎉`;
}

/**
 * Extract structured intent from a raw user message using Mistral.
 * Returns parsed JSON: { intent, extractedData }
 */
async function extractIntent(userMessage, sessionData, conversationHistory) {
  const extractionPrompt = `You are a data extractor for a Honda test drive booking system.

From this message, extract any booking-related data and return ONLY valid JSON.

User message: "${userMessage}"

Current session data: ${JSON.stringify(sessionData)}

Return JSON with this exact structure:
{
  "intent": "greeting|provide_name|provide_city|provide_model|provide_date|provide_time|confirm|cancel|restart|other",
  "extracted": {
    "name": null or string,
    "city": null or string,
    "carModel": null or "Honda City"|"Honda Amaze"|"Honda Elevate",
    "dateRaw": null or string (original date phrase),
    "timeRaw": null or string (original time phrase),
    "isConfirm": null or boolean,
    "isCancel": null or boolean
  },
  "language": "english|hinglish|hindi"
}

Rules:
- Extract model even if user says just "City" or "amaze" or "elevate"
- Extract city even if mixed with other text
- dateRaw should preserve the original phrase like "kal", "tomorrow", "25 march"
- timeRaw should preserve the original phrase like "sham mein", "morning", "3 baje"
- If user says "yes", "haan", "confirm", "theek hai" → isConfirm: true
- If user says "no", "nahi", "cancel" → isCancel: true`;

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: extractionPrompt }],
      max_tokens: 400,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0].message.content;
    return JSON.parse(raw);
  } catch (error) {
    logger.error('Groq extractIntent error:', error.message);
    return {
      intent: 'other',
      extracted: {},
      language: 'english',
    };
  }
}

/**
 * Generate a natural conversational response using Mistral.
 */
async function generateResponse(prompt, sessionData, conversationHistory = []) {
  const systemPrompt = buildSystemPrompt(sessionData);

  // Trim history to avoid token overflow
  const trimmedHistory = conversationHistory.slice(-MAX_HISTORY_TURNS * 2);

  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...trimmedHistory,
        { role: 'user', content: prompt },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    logger.error('Groq generateResponse error:', error.message);
    throw error;
  }
}

/**
 * Translate a time expression (NLP) to time slot IDs.
 */
async function parseTimeExpression(timeRaw) {
  const { TIME_NLP_MAP, TIME_SLOTS } = require('../config/constants');

  const lower = timeRaw.toLowerCase();

  // Try direct NLP map first
  for (const [expr, slots] of Object.entries(TIME_NLP_MAP)) {
    if (lower.includes(expr)) return slots;
  }

  // Try to extract numeric time like "3 baje", "3 PM", "15:00"
  const hourMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje|bajke)?/);
  if (hourMatch) {
    let hour = parseInt(hourMatch[1]);
    const meridiem = hourMatch[3];
    if (meridiem === 'pm' && hour !== 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;

    // Find closest slot
    const slotId = `${String(hour).padStart(2, '0')}:00`;
    const exists = TIME_SLOTS.find((s) => s.id === slotId);
    if (exists) return [slotId];

    // Find nearest available slot
    const nearest = TIME_SLOTS.reduce((prev, curr) => {
      const prevHour = parseInt(prev.id.split(':')[0]);
      const currHour = parseInt(curr.id.split(':')[0]);
      return Math.abs(currHour - hour) < Math.abs(prevHour - hour) ? curr : prev;
    });
    return [nearest.id];
  }

  return [];
}

module.exports = {
  extractIntent,
  generateResponse,
  parseTimeExpression,
};
