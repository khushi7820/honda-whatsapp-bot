// src/utils/messageTemplates.js
module.exports = {
  greeting: (name) => `🚗 Welcome to Honda India! I'm your Honda Assistant.\n${name ? `Nice to see you, ${name}!` : ''}\nMay I know your full name?`,
  askCity: () => `Which city are you located in?`,
  askCarModel: () => `Which Honda model would you like to test drive?\n\n1️⃣ Honda City\n2️⃣ Honda Amaze\n3️⃣ Honda Elevate`,
  askDate: () => `Which date would you prefer for the test drive? (e.g., Today, Tomorrow, or Friday)`,
  invalidDate: (err) => `📅 Please provide a valid date.\nNote: ${err}`,
  allSlotsFull: (dateStr, nextDates) => `😔 All slots for ${dateStr} are fully booked.\n\nNext available dates are: ${nextDates.join(', ')}`,
  showAvailableSlots: (slots, dateStr) => `📅 Available slots for ${dateStr}:\n\n` + slots.filter(s => s.available).map((s, i) => `${i + 1}. ⏰ ${s.display} (${s.spotsLeft} spots left)`).join('\n') + `\n\nPlease select a slot number or type the time.`,
  slotFullSuggestAlternative: (reqSlot, alts) => `Oh no! The slot ${reqSlot} is no longer available. How about one of these?\n\n` + alts.map((s, i) => `${i + 1}. ⏰ ${s.display}`).join('\n'),
  confirmationPrompt: (data) => `✅ Please confirm your booking details:\n\n👤 Name: ${data.name}\n🏙️ City: ${data.city}\n🚗 Model: ${data.carModel}\n📅 Date: ${data.testDriveDateDisplay}\n⏰ Time: ${data.timeSlotDisplay}`,
  bookingCancelled: () => `❌ Your booking process has been cancelled. Type 'Hi' whenever you are ready to start again.`,
  bookingConfirmed: (booking) => `🎉 Test Drive Booked Successfully!\n\n🔖 Booking ID: ${booking.bookingId}\n👤 Name: ${booking.customerName}\n🏙️ City: ${booking.city}\n🚗 Model: ${booking.carModel}\n📅 Date: ${booking.testDriveDate}\n⏰ Time: ${booking.timeSlot}\n\nOur dealership will contact you soon!`,
  alreadyBooked: (id) => `You have a recently confirmed booking (ID: ${id}). Would you like to start a 'new' booking?`,
  fallbackError: () => `Oops! Something went wrong on my end. Need help? Try typing 'reset' or ask a question.`
};
