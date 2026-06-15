const { scheduleRepository, bookingRepository } = require('../repositories');

class BookingService {
  async getSchedules(route, date) {
    if (date) {
      return scheduleRepository.findSchedulesWithBookingStats(route, date);
    }
    if (route) {
      return scheduleRepository.findByRoute(route);
    }
    return scheduleRepository.findAll({ orderBy: 'departure_time', order: 'ASC' });
  }

  async createBooking(bookingData) {
    const { passenger_name, passenger_phone, id_card, schedule_id, travel_date } = bookingData;

    if (!passenger_name || !passenger_phone || !schedule_id || !travel_date) {
      return { success: false, code: 400, message: '请填写完整信息' };
    }

    const schedule = await scheduleRepository.findById(schedule_id);
    if (!schedule) {
      return { success: false, code: 400, message: '班次不存在' };
    }

    const bookedCount = await bookingRepository.getBookedCount(schedule_id, travel_date);
    if (bookedCount >= schedule.total_seats) {
      return { success: false, code: 400, message: '该班次已满员，请选择其他班次' };
    }

    const seatNumber = await bookingRepository.getSeatNumber(schedule_id, travel_date);

    const bookingId = await bookingRepository.create({
      passenger_name,
      passenger_phone,
      id_card: id_card || '',
      schedule_id,
      travel_date,
      seat_number: seatNumber,
      status: 'confirmed'
    });

    const booking = await bookingRepository.findByIdWithDetail(bookingId);

    return { success: true, data: booking, message: '预定成功' };
  }

  async getBookings(filters, isAdmin) {
    const { phone, date, status, page, pageSize } = filters;

    if (!isAdmin && !phone) {
      return { success: false, code: 400, message: '请提供手机号进行查询' };
    }

    const hasPagination = page !== undefined && page !== null && page !== '';

    if (hasPagination) {
      const result = await bookingRepository.findWithDetail({
        phone,
        date,
        status,
        page: parseInt(page) || 1,
        pageSize: parseInt(pageSize) || 20
      });
      return { success: true, data: result, paginated: true };
    }

    const result = await bookingRepository.findWithDetail({
      phone,
      date,
      status,
      page: 1,
      pageSize: 10000
    });

    return { success: true, data: result.list, paginated: false };
  }

  async getBookingDetail(id, phone, isAdmin) {
    const booking = await bookingRepository.findByIdWithDetail(id);

    if (!booking) {
      return { success: false, code: 404, message: '订单不存在' };
    }

    if (!isAdmin && booking.passenger_phone !== phone) {
      return { success: false, code: 403, message: '无权查看该订单' };
    }

    return { success: true, data: booking };
  }

  async cancelBooking(id, phone, isAdmin) {
    const booking = await bookingRepository.findById(id);

    if (!booking) {
      return { success: false, code: 404, message: '订单不存在' };
    }

    if (!isAdmin && booking.passenger_phone !== phone) {
      return { success: false, code: 403, message: '无权取消该订单' };
    }

    if (booking.status === 'dispatched') {
      return { success: false, code: 400, message: '已派车订单不能取消' };
    }

    await bookingRepository.update(id, { status: 'cancelled' });

    return { success: true, message: '取消成功' };
  }
}

module.exports = new BookingService();
