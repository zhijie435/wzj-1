const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking');
const { authMiddleware, verifyToken } = require('../middleware/auth');

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload) {
      req.adminUser = payload;
    }
  }
  next();
}

router.get('/schedules', bookingController.getSchedules);
router.post('/', bookingController.createBooking);
router.get('/', optionalAuth, bookingController.getBookings);
router.get('/:id', optionalAuth, bookingController.getBookingDetail);
router.post('/:id/cancel', optionalAuth, bookingController.cancelBooking);

module.exports = router;
