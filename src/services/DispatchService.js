const { busRepository, bookingRepository } = require('../repositories');

class DispatchService {
  async getBuses(status) {
    return busRepository.findByStatus(status);
  }

  async getPendingBookings(filters) {
    const { date, route } = filters;

    const bookings = await bookingRepository.findPendingBookings({
      date,
      route
    });

    const grouped = {};
    for (const b of bookings) {
      const key = `${b.travel_date}_${b.schedule_id}`;
      if (!grouped[key]) {
        grouped[key] = {
          date: b.travel_date,
          schedule_id: b.schedule_id,
          route: b.route,
          departure_time: b.departure_time,
          arrival_time: b.arrival_time,
          price: b.price,
          bookings: [],
          totalPassengers: 0
        };
      }
      grouped[key].bookings.push(b);
      grouped[key].totalPassengers++;
    }

    return Object.values(grouped);
  }

  async assignBus(bus_id, schedule_id, travel_date) {
    if (
      bus_id === null ||
      bus_id === undefined ||
      bus_id === '' ||
      schedule_id === null ||
      schedule_id === undefined ||
      schedule_id === '' ||
      !travel_date
    ) {
      return { success: false, code: 400, message: '参数不完整' };
    }

    const bus = await busRepository.findById(bus_id);
    if (!bus) {
      return { success: false, code: 404, message: '车辆不存在' };
    }

    if (bus.status !== 'idle') {
      return { success: false, code: 400, message: '车辆当前不可用' };
    }

    const bookingsToDispatch = await bookingRepository.findConfirmedByScheduleAndDate(
      schedule_id,
      travel_date
    );

    if (bookingsToDispatch.length === 0) {
      return { success: false, code: 400, message: '没有需要派车的订单' };
    }

    if (bookingsToDispatch.length > bus.capacity) {
      return {
        success: false,
        code: 400,
        message: `车辆容量不足，当前有${bookingsToDispatch.length}位乘客，车辆容量${bus.capacity}`
      };
    }

    await busRepository.updateStatus(bus_id, 'dispatched');

    const bookingIds = bookingsToDispatch.map(b => b.id);
    await bookingRepository.batchUpdateBusAndStatus(bookingIds, bus_id, 'dispatched');

    return {
      success: true,
      message: `派车成功，共${bookingsToDispatch.length}位乘客已分配至车辆 ${bus.plate_number}`,
      data: {
        bus,
        passenger_count: bookingsToDispatch.length
      }
    };
  }

  async completeTrip(bus_id) {
    if (bus_id === null || bus_id === undefined || bus_id === '') {
      return { success: false, code: 400, message: '参数不完整' };
    }

    const bus = await busRepository.findById(bus_id);
    if (!bus) {
      return { success: false, code: 404, message: '车辆不存在' };
    }

    await busRepository.updateStatus(bus_id, 'idle');
    await bookingRepository.updateStatusByBusId(bus_id, 'dispatched', 'completed');

    return { success: true, message: '行程已完成，车辆已恢复空闲状态' };
  }

  async getDispatchedTrips(filters = {}) {
    const { page, pageSize } = filters;
    const hasPagination = page !== undefined && page !== null && page !== '';

    if (hasPagination) {
      return bookingRepository.getDispatchedTrips({
        page: parseInt(page) || 1,
        pageSize: parseInt(pageSize) || 20
      });
    }

    const result = await bookingRepository.getDispatchedTrips({
      page: 1,
      pageSize: 10000
    });
    return result.list;
  }
}

module.exports = new DispatchService();
