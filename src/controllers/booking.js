const { bookingService } = require('../services');

class BookingController {
  async getSchedules(req, res) {
    try {
      const { route, date } = req.query;
      const schedules = await bookingService.getSchedules(route, date);
      res.json({ code: 0, data: schedules });
    } catch (error) {
      console.error('[Booking] 获取班次失败:', error);
      res.json({ code: 500, message: '获取班次失败' });
    }
  }

  async createBooking(req, res) {
    try {
      const result = await bookingService.createBooking(req.body);
      if (!result.success) {
        return res.json({ code: result.code, message: result.message });
      }
      res.json({ code: 0, data: result.data, message: result.message });
    } catch (error) {
      console.error('[Booking] 创建预定失败:', error);
      res.json({ code: 500, message: '预定失败' });
    }
  }

  async getBookings(req, res) {
    try {
      const isAdmin = !!req.adminUser;
      const result = await bookingService.getBookings(req.query, isAdmin);
      if (!result.success) {
        return res.json({ code: result.code, message: result.message });
      }
      res.json({ code: 0, data: result.data });
    } catch (error) {
      console.error('[Booking] 获取预定列表失败:', error);
      res.json({ code: 500, message: '获取预定列表失败' });
    }
  }

  async getBookingDetail(req, res) {
    try {
      const { id } = req.params;
      const { phone } = req.query;
      const isAdmin = !!req.adminUser;

      const result = await bookingService.getBookingDetail(id, phone, isAdmin);
      if (!result.success) {
        return res.json({ code: result.code, message: result.message });
      }
      res.json({ code: 0, data: result.data });
    } catch (error) {
      console.error('[Booking] 获取订单详情失败:', error);
      res.json({ code: 500, message: '获取订单详情失败' });
    }
  }

  async cancelBooking(req, res) {
    try {
      const { id } = req.params;
      const { phone } = req.body;
      const isAdmin = !!req.adminUser;

      const result = await bookingService.cancelBooking(id, phone, isAdmin);
      if (!result.success) {
        return res.json({ code: result.code, message: result.message });
      }
      res.json({ code: 0, message: result.message });
    } catch (error) {
      console.error('[Booking] 取消订单失败:', error);
      res.json({ code: 500, message: '取消失败' });
    }
  }
}

module.exports = new BookingController();
