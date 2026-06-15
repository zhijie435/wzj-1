const { dispatchService } = require('../services');

class DispatchController {
  async getBuses(req, res) {
    try {
      const { status } = req.query;
      const buses = await dispatchService.getBuses(status);
      res.json({ code: 0, data: buses });
    } catch (error) {
      console.error('[Dispatch] 获取车辆列表失败:', error);
      res.json({ code: 500, message: '获取车辆列表失败' });
    }
  }

  async getPendingBookings(req, res) {
    try {
      const result = await dispatchService.getPendingBookings(req.query);
      res.json({ code: 0, data: result });
    } catch (error) {
      console.error('[Dispatch] 获取待派车订单失败:', error);
      res.json({ code: 500, message: '获取待派车订单失败' });
    }
  }

  async assignBus(req, res) {
    try {
      const { bus_id, schedule_id, travel_date } = req.body;
      const result = await dispatchService.assignBus(bus_id, schedule_id, travel_date);
      if (!result.success) {
        return res.json({ code: result.code, message: result.message });
      }
      res.json({
        code: 0,
        message: result.message,
        data: result.data
      });
    } catch (error) {
      console.error('[Dispatch] 派车失败:', error);
      res.json({ code: 500, message: '派车失败' });
    }
  }

  async completeTrip(req, res) {
    try {
      const { bus_id } = req.body;
      const result = await dispatchService.completeTrip(bus_id);
      if (!result.success) {
        return res.json({ code: result.code, message: result.message });
      }
      res.json({ code: 0, message: result.message });
    } catch (error) {
      console.error('[Dispatch] 完成行程失败:', error);
      res.json({ code: 500, message: '操作失败' });
    }
  }

  async getDispatchedTrips(req, res) {
    try {
      const { page, pageSize } = req.query;
      const filters = {};
      if (page !== undefined && page !== null && page !== '') {
        filters.page = page;
        filters.pageSize = pageSize;
      }
      const result = await dispatchService.getDispatchedTrips(filters);
      res.json({ code: 0, data: result });
    } catch (error) {
      console.error('[Dispatch] 获取派车记录失败:', error);
      res.json({ code: 500, message: '获取派车记录失败' });
    }
  }
}

module.exports = new DispatchController();
