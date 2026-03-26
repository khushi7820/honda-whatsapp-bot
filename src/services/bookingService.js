// src/services/bookingService.js
const supabase = require('../config/database');
const { TIME_SLOTS } = require('../config/constants');
const logger = require('../utils/logger');

const SLOT_CAPACITY = () => parseInt(process.env.SLOT_CAPACITY || '3');

function generateBookingId() {
  return 'HB-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

/**
 * Get available slots for a given date.
 */
async function getAvailableSlots(dateISO) {
  try {
    const { data: existingBookings, error } = await supabase
      .from('bookings')
      .select('timeSlot')
      .eq('testDriveDate', dateISO)
      .eq('status', 'confirmed');

    if (error) throw error;

    const slotCounts = {};
    existingBookings.forEach((b) => {
      slotCounts[b.timeSlot] = (slotCounts[b.timeSlot] || 0) + 1;
    });

    const capacity = SLOT_CAPACITY();

    return TIME_SLOTS.map((slot) => ({
      ...slot,
      booked: slotCounts[slot.id] || 0,
      capacity,
      available: (slotCounts[slot.id] || 0) < capacity,
      spotsLeft: capacity - (slotCounts[slot.id] || 0),
    }));
  } catch (error) {
    logger.error('getAvailableSlots error:', error);
    throw error;
  }
}

/**
 * Create a new booking in the database.
 */
async function createBooking({ customerPhone, customerName, city, carModel, testDriveDate, timeSlot }) {
  const { count, error: countError } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('testDriveDate', testDriveDate)
    .eq('timeSlot', timeSlot)
    .eq('status', 'confirmed');

  if (countError) throw countError;

  if (count >= SLOT_CAPACITY()) {
    throw new Error('SLOT_FULL');
  }

  const bookingId = generateBookingId();

  const { data, error } = await supabase
    .from('bookings')
    .insert([
      {
        bookingId,
        customerPhone,
        customerName,
        city,
        carModel,
        testDriveDate,
        timeSlot,
        status: 'confirmed'
      }
    ])
    .select()
    .single();

  if (error) throw error;

  logger.info(`New booking created: ${bookingId} for ${customerName} (${customerPhone})`);
  return data;
}

module.exports = {
  getAvailableSlots,
  createBooking
};
