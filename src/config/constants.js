const CONVERSATION_STATES = {
  INIT: 'INIT',
  COLLECTING_NAME: 'COLLECTING_NAME',
  COLLECTING_CITY: 'COLLECTING_CITY',
  COLLECTING_MODEL: 'COLLECTING_MODEL',
  COLLECTING_DATE: 'COLLECTING_DATE',
  COLLECTING_SLOT: 'COLLECTING_SLOT',
  CONFIRMING: 'CONFIRMING',
  COMPLETED: 'COMPLETED'
};

const HONDA_MODELS = ['Honda City', 'Honda Amaze', 'Honda Elevate'];

const TIME_SLOTS = [
  { id: '10:00', display: '10:00 AM - 11:00 AM' },
  { id: '11:00', display: '11:00 AM - 12:00 PM' },
  { id: '12:00', display: '12:00 PM - 01:00 PM' },
  { id: '14:00', display: '02:00 PM - 03:00 PM' },
  { id: '15:00', display: '03:00 PM - 04:00 PM' },
  { id: '16:00', display: '04:00 PM - 05:00 PM' },
  { id: '17:00', display: '05:00 PM - 06:00 PM' }
];

module.exports = {
  CONVERSATION_STATES,
  HONDA_MODELS,
  TIME_SLOTS
};
