// src/routes/admin.js
const express = require('express');
const router = express.Router();
const bookingService = require('../services/bookingService');

const requireAdmin = (req, res, next) => {
  const token = req.headers['x-admin-key'];
  if (token && token === process.env.ADMIN_SECRET_KEY) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};

router.use(requireAdmin);

router.get('/stats', async (req, res, next) => {
  try {
    const stats = {
      note: 'Supabase stats are simple right now',
    };
    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
});

router.get('/slots', async (req, res, next) => {
  try {
    const date = req.query.date;
    if (!date) return res.status(400).json({ error: 'Date is required' });
    
    const slots = await bookingService.getAvailableSlots(date);
    res.json({ success: true, date, slots });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
