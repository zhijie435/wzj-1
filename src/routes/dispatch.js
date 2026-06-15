const express = require('express');
const router = express.Router();
const dispatchController = require('../controllers/dispatch');
const { authMiddleware } = require('../middleware/auth');

router.get('/buses', authMiddleware, dispatchController.getBuses);
router.get('/pending', authMiddleware, dispatchController.getPendingBookings);
router.post('/assign', authMiddleware, dispatchController.assignBus);
router.post('/complete', authMiddleware, dispatchController.completeTrip);
router.get('/trips', authMiddleware, dispatchController.getDispatchedTrips);

module.exports = router;
