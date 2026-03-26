// src/utils/dateUtils.js
function parseNaturalDate(input) {
  const lower = (input || '').toLowerCase().trim();
  const today = new Date();
  
  if (/today|aaj/.test(lower)) return today;
  if (/tomorrow|kal/.test(lower)) {
    const tmr = new Date(today);
    tmr.setDate(tmr.getDate() + 1);
    return tmr;
  }
  if (/day after|parso/.test(lower)) {
    const da = new Date(today);
    da.setDate(da.getDate() + 2);
    return da;
  }
  
  // Try to parse direct date string
  const d = new Date(input);
  if (!isNaN(d.getTime())) return d;
  
  // Fallback to null
  return null;
}

function validateBookingDate(dateObj) {
  if (!dateObj) {
    return { valid: false, error: 'Could not understand the date. Please provide a clear date like "Tomorrow" or "YYYY-MM-DD".' };
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const testDate = new Date(dateObj);
  testDate.setHours(0, 0, 0, 0);
  
  if (testDate < today) {
    return { valid: false, error: 'Cannot book for a past date.' };
  }
  
  const maxDays = parseInt(process.env.MAX_BOOKING_DAYS_AHEAD || '7');
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + maxDays);
  
  if (testDate > maxDate) {
    return { valid: false, error: `You can only book up to ${maxDays} days in advance.` };
  }
  
  return { valid: true, date: testDate };
}

function formatDateISO(dateObj) {
  return dateObj.toISOString().split('T')[0];
}

function formatDateDisplay(dateObj) {
  return dateObj.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

module.exports = {
  parseNaturalDate,
  validateBookingDate,
  formatDateISO,
  formatDateDisplay
};
