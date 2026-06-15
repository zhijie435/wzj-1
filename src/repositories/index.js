const ScheduleRepository = require('./ScheduleRepository');
const BookingRepository = require('./BookingRepository');
const BusRepository = require('./BusRepository');

const scheduleRepository = new ScheduleRepository();
const bookingRepository = new BookingRepository();
const busRepository = new BusRepository();

module.exports = {
  scheduleRepository,
  bookingRepository,
  busRepository
};
