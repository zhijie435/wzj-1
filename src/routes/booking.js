const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking');

router.get('/schedules', bookingController.getSchedules);
router.post('/', bookingController.createBooking);
router.get('/', bookingController.getBookings);
router.get('/:id', bookingController.getBookingDetail);
router.post('/:id/cancel', bookingController.cancelBooking);

module.exports = router;
