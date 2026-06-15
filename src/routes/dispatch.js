const express = require('express');
const router = express.Router();
const dispatchController = require('../controllers/dispatch');

router.get('/buses', dispatchController.getBuses);
router.get('/pending', dispatchController.getPendingBookings);
router.post('/assign', dispatchController.assignBus);
router.post('/complete', dispatchController.completeTrip);
router.get('/trips', dispatchController.getDispatchedTrips);

module.exports = router;
