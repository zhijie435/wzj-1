const db = require('../../src/db');
const { bookingRepository, busRepository, scheduleRepository } = require('../../src/repositories');

const TEST_DATE = '2026-06-20';
const TEST_DATE_2 = '2026-06-21';

class TestHelper {
  static get testDate() {
    return TEST_DATE;
  }

  static get testDate2() {
    return TEST_DATE_2;
  }

  static async getSchedules() {
    return scheduleRepository.findAll();
  }

  static async getBuses() {
    return busRepository.findAll();
  }

  static async createBus(overrides = {}) {
    const defaultBus = {
      plate_number: '京B' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      capacity: 45,
      driver_name: '测试司机',
      driver_phone: '13900000000',
      status: 'idle'
    };
    const busData = { ...defaultBus, ...overrides };
    const id = await busRepository.create(busData);
    return busRepository.findById(id);
  }

  static async createBooking(scheduleId, travelDate, overrides = {}) {
    const defaultBooking = {
      passenger_name: '测试乘客',
      passenger_phone: '13800000000',
      id_card: '110101199001010000',
      schedule_id: scheduleId,
      travel_date: travelDate,
      status: 'confirmed',
      bus_id: null
    };
    const bookingData = { ...defaultBooking, ...overrides };
    const id = await bookingRepository.create(bookingData);
    return bookingRepository.findById(id);
  }

  static async createMultipleBookings(scheduleId, travelDate, count, status = 'confirmed') {
    const bookings = [];
    for (let i = 0; i < count; i++) {
      const booking = await this.createBooking(scheduleId, travelDate, {
        passenger_name: `乘客${i + 1}`,
        passenger_phone: `138000${String(i + 1).padStart(5, '0')}`,
        status
      });
      bookings.push(booking);
    }
    return bookings;
  }

  static async createPendingBooking(scheduleId, travelDate) {
    return this.createBooking(scheduleId, travelDate, { status: 'pending' });
  }

  static async createCancelledBooking(scheduleId, travelDate) {
    return this.createBooking(scheduleId, travelDate, { status: 'cancelled' });
  }

  static async createDispatchedBooking(scheduleId, travelDate, busId) {
    return this.createBooking(scheduleId, travelDate, {
      status: 'dispatched',
      bus_id: busId
    });
  }

  static async getBusById(id) {
    return busRepository.findById(id);
  }

  static async getBookingById(id) {
    return bookingRepository.findById(id);
  }

  static async updateBusStatus(id, status) {
    return busRepository.updateStatus(id, status);
  }

  static async getBookingsByScheduleAndDate(scheduleId, travelDate) {
    return bookingRepository.findConfirmedByScheduleAndDate(scheduleId, travelDate);
  }

  static async getPendingBookings(filters = {}) {
    return bookingRepository.findPendingBookings(filters);
  }

  static async resetDatabase() {
    await db.query('DELETE FROM bookings');
    await db.query('DELETE FROM buses');
    await db.query('DELETE FROM schedules');
    await db.query("DELETE FROM sqlite_sequence WHERE name IN ('bookings', 'buses', 'schedules')");
    await db.seedData();
  }

  static generateUniquePlate() {
    return '京B' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  static generatePhone() {
    return '138' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  }
}

module.exports = TestHelper;
