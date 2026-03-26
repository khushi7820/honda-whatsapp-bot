// src/middleware/errorHandler.js
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('Global Error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
}

module.exports = errorHandler;
