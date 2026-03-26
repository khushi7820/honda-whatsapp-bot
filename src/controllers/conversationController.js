// src/controllers/conversationController.js
const sessionService = require('../services/sessionService');
const bookingService = require('../services/bookingService');
const groqService = require('../services/groqService');
const whatsappService = require('../services/whatsappService');
const templates = require('../utils/messageTemplates');
const { parseNaturalDate, validateBookingDate, formatDateDisplay, formatDateISO } = require('../utils/dateUtils');
const { CONVERSATION_STATES, HONDA_MODELS, TIME_SLOTS } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Main entry point for processing an incoming WhatsApp message.
 */
async function handleIncomingMessage(messageData) {
  const { from, text, interactiveId, interactiveTitle, messageId, senderName } = messageData;

  // Use interactive reply title if text is not available (button/list reply)
  const userInput = text || interactiveTitle || '';

  logger.info(`📩 Message from ${from}: "${userInput}" [interactive: ${interactiveId || 'none'}]`);

  try {
    // Mark message as read (async, don't block)
    whatsappService.markMessageRead(messageId).catch(() => {});

    const session = await sessionService.getOrCreateSession(from);

    // Check for global reset commands
    const normalized = userInput.toLowerCase().trim();
    if (['restart', 'reset', 'start over', 'new', 'hi', 'hello', 'start', 'hey'].includes(normalized)) {
      await sessionService.resetSession(from);
      const response = templates.greeting(senderName !== from ? senderName : null);
      await whatsappService.sendTextMessage(from, response);
      await sessionService.updateSession(from, { state: CONVERSATION_STATES.COLLECTING_NAME });
      return;
    }

    // Route to correct handler based on current state
    switch (session.state) {
      case CONVERSATION_STATES.INIT:
      case CONVERSATION_STATES.COLLECTING_NAME:
        await handleNameCollection(from, userInput, session);
        break;

      case CONVERSATION_STATES.COLLECTING_CITY:
        await handleCityCollection(from, userInput, session);
        break;

      case CONVERSATION_STATES.COLLECTING_MODEL:
        await handleModelCollection(from, userInput, session, interactiveId);
        break;

      case CONVERSATION_STATES.COLLECTING_DATE:
        await handleDateCollection(from, userInput, session);
        break;

      case CONVERSATION_STATES.COLLECTING_SLOT:
        await handleSlotCollection(from, userInput, session, interactiveId);
        break;

      case CONVERSATION_STATES.CONFIRMING:
        await handleConfirmation(from, userInput, session, interactiveId);
        break;

      case CONVERSATION_STATES.COMPLETED:
        // Session completed — offer restart or new booking
        const existingId = session.completedBookingId;
        await whatsappService.sendTextMessage(from, templates.alreadyBooked(existingId));
        break;

      default:
        await sessionService.resetSession(from);
        await whatsappService.sendTextMessage(from, templates.greeting());
        await sessionService.updateSession(from, { state: CONVERSATION_STATES.COLLECTING_NAME });
    }

    // Append to conversation history
    await sessionService.appendToHistory(from, 'user', userInput);

  } catch (error) {
    logger.error(`Error handling message from ${from}:`, error);
    await whatsappService.sendTextMessage(from, templates.fallbackError()).catch(() => {});
  }
}

// ============================================================
// STATE HANDLERS
// ============================================================

async function handleNameCollection(from, input, session) {
  if (!input || input.trim().length < 2) {
    await whatsappService.sendTextMessage(from, '👋 Hi! Welcome to Honda India.\n\nPlease share your *full name* to get started.');
    await sessionService.updateSession(from, { state: CONVERSATION_STATES.COLLECTING_NAME });
    return;
  }

  // Use Groq to extract name from potentially complex input
  const intentData = await groqService.extractIntent(input, {}, session.conversationHistory);
  const extractedName = intentData.extracted?.name || cleanName(input);

  if (!extractedName || extractedName.length < 2) {
    await whatsappService.sendTextMessage(from, '🤔 I didn\'t catch your name. Could you please share your *full name*?');
    return;
  }

  await sessionService.updateSession(from, {
    state: CONVERSATION_STATES.COLLECTING_CITY,
    'data.name': extractedName,
  });

  const response = `Nice to meet you, *${extractedName}*! 😊\n\n${templates.askCity()}`;
  await whatsappService.sendTextMessage(from, response);
}

async function handleCityCollection(from, input, session) {
  if (!input || input.trim().length < 2) {
    await whatsappService.sendTextMessage(from, templates.askCity());
    return;
  }

  const intentData = await groqService.extractIntent(input, session.data, session.conversationHistory);
  const city = intentData.extracted?.city || capitalizeWords(input.trim());

  await sessionService.updateSession(from, {
    state: CONVERSATION_STATES.COLLECTING_MODEL,
    'data.city': city,
  });

  await whatsappService.sendTextMessage(from, `📍 *${city}* — noted!\n\n${templates.askCarModel()}`);
}

async function handleModelCollection(from, input, session, interactiveId) {
  const intentData = await groqService.extractIntent(input, session.data, session.conversationHistory);
  const rawModel = intentData.extracted?.carModel || input;

  const model = resolveCarModel(rawModel);
  if (!model) {
    await whatsappService.sendTextMessage(from, `🤔 I didn't recognize that model. Please choose one:\n\n1️⃣ Honda City\n2️⃣ Honda Amaze\n3️⃣ Honda Elevate`);
    return;
  }

  await sessionService.updateSession(from, {
    state: CONVERSATION_STATES.COLLECTING_DATE,
    'data.carModel': model,
  });

  await whatsappService.sendTextMessage(from, `🚗 *${model}* — excellent choice!\n\n${templates.askDate()}`);
}

async function handleDateCollection(from, input, session) {
  const intentData = await groqService.extractIntent(input, session.data, session.conversationHistory);
  const dateRaw = intentData.extracted?.dateRaw || input;

  const parsedDate = parseNaturalDate(dateRaw);
  const validation = validateBookingDate(parsedDate);

  if (!validation.valid) {
    await whatsappService.sendTextMessage(from, templates.invalidDate(validation.error));
    return;
  }

  const dateISO = formatDateISO(validation.date);
  const dateDisplay = formatDateDisplay(validation.date);

  // Get available slots for this date
  const slots = await bookingService.getAvailableSlots(dateISO);
  const availableSlots = slots.filter((s) => s.available);

  if (availableSlots.length === 0) {
    await whatsappService.sendTextMessage(from, templates.allSlotsFull(dateDisplay, getNextAvailableDates()));
    return;
  }

  await sessionService.updateSession(from, {
    state: CONVERSATION_STATES.COLLECTING_SLOT,
    'data.testDriveDate': dateISO,
    'data.testDriveDateDisplay': dateDisplay,
  });

  await whatsappService.sendTextMessage(from, templates.showAvailableSlots(slots, dateDisplay));
}

async function handleSlotCollection(from, input, session, interactiveId) {
  const intentData = await groqService.extractIntent(input, session.data, session.conversationHistory);
  const timeRaw = intentData.extracted?.timeRaw || input;

  let resolvedSlotIds = [];

  // Try number selection first ("1", "2", etc.)
  const numMatch = input.trim().match(/^(\d)$/);
  if (numMatch) {
    const idx = parseInt(numMatch[1]) - 1;
    const slots = await bookingService.getAvailableSlots(session.data.testDriveDate);
    const available = slots.filter((s) => s.available);
    if (available[idx]) resolvedSlotIds = [available[idx].id];
  }

  // Try NLP time resolution
  if (resolvedSlotIds.length === 0) {
    resolvedSlotIds = await groqService.parseTimeExpression(timeRaw);
  }

  if (resolvedSlotIds.length === 0) {
    // Couldn't resolve — re-show available slots
    const slots = await bookingService.getAvailableSlots(session.data.testDriveDate);
    await whatsappService.sendTextMessage(from, `🤔 I couldn't understand that time slot.\n\n${templates.showAvailableSlots(slots, session.data.testDriveDateDisplay)}`);
    return;
  }

  // Find first available resolved slot
  const allSlots = await bookingService.getAvailableSlots(session.data.testDriveDate);
  let chosenSlot = null;

  for (const slotId of resolvedSlotIds) {
    const s = allSlots.find((x) => x.id === slotId && x.available);
    if (s) { chosenSlot = s; break; }
  }

  if (!chosenSlot) {
    const availableAlts = allSlots.filter((s) => s.available);
    const requestedSlotLabel = TIME_SLOTS.find((s) => s.id === resolvedSlotIds[0])?.display || timeRaw;
    if (availableAlts.length === 0) {
      await whatsappService.sendTextMessage(from, `😔 All slots on ${session.data.testDriveDateDisplay} are now full. Please choose another date.`);
      await sessionService.updateSession(from, { state: CONVERSATION_STATES.COLLECTING_DATE });
    } else {
      await whatsappService.sendTextMessage(from, templates.slotFullSuggestAlternative(requestedSlotLabel, availableAlts));
    }
    return;
  }

  await sessionService.updateSession(from, {
    state: CONVERSATION_STATES.CONFIRMING,
    'data.timeSlot': chosenSlot.id,
    'data.timeSlotDisplay': chosenSlot.display,
  });

  // Get fresh session data for confirmation
  const updatedSession = await sessionService.getOrCreateSession(from);
  await whatsappService.sendButtonMessage(
    from,
    templates.confirmationPrompt(updatedSession.data),
    [
      { id: 'confirm_yes', title: '✅ Confirm' },
      { id: 'confirm_no', title: '❌ Cancel' },
    ]
  );
}

async function handleConfirmation(from, input, session, interactiveId) {
  const isConfirm = interactiveId === 'confirm_yes' ||
    /\b(yes|confirm|haan|ha|theek|ok|sure|bilkul|proceed)\b/i.test(input);

  const isCancel = interactiveId === 'confirm_no' ||
    /\b(no|nahi|cancel|nope|dont|don't|nahin)\b/i.test(input);

  if (isCancel) {
    await sessionService.resetSession(from);
    await whatsappService.sendTextMessage(from, templates.bookingCancelled());
    return;
  }

  if (!isConfirm) {
    await whatsappService.sendButtonMessage(
      from,
      'Please confirm your booking:\n\nType *YES* to confirm or *NO* to cancel.',
      [{ id: 'confirm_yes', title: '✅ Yes, Confirm' }, { id: 'confirm_no', title: '❌ No, Cancel' }]
    );
    return;
  }

  // Create booking
  try {
    const { name, city, carModel, testDriveDate, timeSlot } = session.data;

    const booking = await bookingService.createBooking({
      customerPhone: from,
      customerName: name,
      city,
      carModel,
      testDriveDate,
      timeSlot,
    });

    await sessionService.completeSession(from, booking.bookingId);
    await sessionService.appendToHistory(from, 'assistant', `Booking confirmed: ${booking.bookingId}`);
    await whatsappService.sendTextMessage(from, templates.bookingConfirmed(booking));

  } catch (error) {
    if (error.message === 'SLOT_FULL') {
      const slots = await bookingService.getAvailableSlots(session.data.testDriveDate);
      const alts = slots.filter((s) => s.available && s.id !== session.data.timeSlot);
      await sessionService.updateSession(from, { state: CONVERSATION_STATES.COLLECTING_SLOT });
      await whatsappService.sendTextMessage(
        from,
        `😔 Oh no! That slot just got booked. Here are remaining available slots:\n\n${templates.showAvailableSlots(slots, session.data.testDriveDateDisplay)}`
      );
    } else {
      logger.error('Booking creation error:', error);
      await whatsappService.sendTextMessage(from, templates.fallbackError());
    }
  }
}

// ============================================================
// HELPERS
// ============================================================

function cleanName(input) {
  // Remove common prefixes and clean up
  return input
    .replace(/^(my name is|i am|i'm|mera naam|naam hai)\s*/i, '')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function capitalizeWords(str) {
  return str.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function resolveCarModel(input) {
  const lower = (input || '').toLowerCase().trim();
  if (/city|सिटी/.test(lower) || lower === '1') return 'Honda City';
  if (/amaze|अमेज/.test(lower) || lower === '2') return 'Honda Amaze';
  if (/elevate|एलिवेट/.test(lower) || lower === '3') return 'Honda Elevate';
  return null;
}

function getNextAvailableDates() {
  const dates = [];
  const today = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }));
  }
  return dates;
}

module.exports = { handleIncomingMessage };
