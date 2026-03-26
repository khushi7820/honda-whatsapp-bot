// src/services/sessionService.js
const supabase = require('../config/database');
const { CONVERSATION_STATES } = require('../config/constants');
const logger = require('../utils/logger');

async function getOrCreateSession(phoneNumber) {
  let { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('phoneNumber', phoneNumber)
    .single();

  if (error && error.code !== 'PGRST116') { // not found
    logger.error('Error fetching session:', error);
  }

  if (!session) {
    const { data: newSession, error: createError } = await supabase
      .from('sessions')
      .insert([{
        phoneNumber,
        state: CONVERSATION_STATES.INIT,
        data: {},
        conversationHistory: []
      }])
      .select()
      .single();
      
    if (createError) throw createError;
    return newSession;
  }

  return session;
}

async function updateSession(phoneNumber, updates) {
  // Translate flat updates with dot-notation to nested json update if needed
  // Since supabase allows updating jsonb, we first get current session
  let { data: session } = await supabase
    .from('sessions')
    .select('data')
    .eq('phoneNumber', phoneNumber)
    .single();

  const updatePayload = {};
  if (updates.state) updatePayload.state = updates.state;
  
  if (session && session.data) {
    let newData = { ...session.data };
    for (const key in updates) {
      if (key.startsWith('data.')) {
        const field = key.split('.')[1];
        newData[field] = updates[key];
      }
    }
    updatePayload.data = newData;
  }

  const { data, error } = await supabase
    .from('sessions')
    .update(updatePayload)
    .eq('phoneNumber', phoneNumber)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function resetSession(phoneNumber) {
  const { data, error } = await supabase
    .from('sessions')
    .update({ state: CONVERSATION_STATES.INIT, data: {}, conversationHistory: [], completedBookingId: null })
    .eq('phoneNumber', phoneNumber)
    .select()
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function completeSession(phoneNumber, bookingId) {
  const { data, error } = await supabase
    .from('sessions')
    .update({ state: CONVERSATION_STATES.COMPLETED, completedBookingId: bookingId })
    .eq('phoneNumber', phoneNumber)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function appendToHistory(phoneNumber, role, content) {
  let { data: session } = await supabase
    .from('sessions')
    .select('conversationHistory')
    .eq('phoneNumber', phoneNumber)
    .single();

  if (!session) return;

  const history = session.conversationHistory || [];
  history.push({ role, content });
  
  // Keep last 20
  if (history.length > 20) history.splice(0, history.length - 20);

  const { error } = await supabase
    .from('sessions')
    .update({ conversationHistory: history })
    .eq('phoneNumber', phoneNumber);

  if (error) throw error;
}

module.exports = {
  getOrCreateSession,
  updateSession,
  resetSession,
  completeSession,
  appendToHistory
};
