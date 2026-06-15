const db = require('../db');

class DispatchController {
  async getBuses(req, res) {
    try {
      const { status } = req.query;
      let sql = 'SELECT * FROM buses WHERE 1=1';
      const params = [];
      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }
      sql += ' ORDER BY id';
      const buses = await db.query(sql, params);
      res.json({ code: 0, data: buses });
    } catch (error) {
      console.error('[Dispatch] 获取车辆列表失败:', error);
      res.json({ code: 500, message: '获取车辆列表失败' });
    }
  }

  async getPendingBookings(req, res) {
    try {
      const { date, route } = req.query;
      let sql = `SELECT b.*, s.route, s.departure_time, s.arrival_time, s.price
                 FROM bookings b
                 LEFT JOIN schedules s ON b.schedule_id = s.id
                 WHERE b.status = 'confirmed' AND b.bus_id IS NULL`;
      const params = [];

      if (date) {
        sql += ' AND b.travel_date = ?';
        params.push(date);
      }
      if (route) {
        sql += ' AND s.route = ?';
        params.push(route);
      }

      sql += ' ORDER BY b.travel_date, s.departure_time';
      const bookings = await db.query(sql, params);

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

      res.json({ code: 0, data: Object.values(grouped) });
    } catch (error) {
      console.error('[Dispatch] 获取待派车订单失败:', error);
      res.json({ code: 500, message: '获取待派车订单失败' });
    }
  }

  async assignBus(req, res) {
    try {
      const { bus_id, schedule_id, travel_date } = req.body;

      if (!bus_id || !schedule_id || !travel_date) {
        return res.json({ code: 400, message: '参数不完整' });
      }

      const bus = await db.query('SELECT * FROM buses WHERE id = ?', [bus_id]);
      if (bus.length === 0) {
        return res.json({ code: 404, message: '车辆不存在' });
      }

      if (bus[0].status !== 'idle') {
        return res.json({ code: 400, message: '车辆当前不可用' });
      }

      const bookingsToDispatch = await db.query(
        `SELECT * FROM bookings
         WHERE schedule_id = ? AND travel_date = ? AND status = 'confirmed' AND bus_id IS NULL`,
        [schedule_id, travel_date]
      );

      if (bookingsToDispatch.length === 0) {
        return res.json({ code: 400, message: '没有需要派车的订单' });
      }

      if (bookingsToDispatch.length > bus[0].capacity) {
        return res.json({ code: 400, message: `车辆容量不足，当前有${bookingsToDispatch.length}位乘客，车辆容量${bus[0].capacity}` });
      }

      await db.query('UPDATE buses SET status = ? WHERE id = ?', ['dispatched', bus_id]);

      for (const b of bookingsToDispatch) {
        await db.query(
          'UPDATE bookings SET bus_id = ?, status = ? WHERE id = ?',
          [bus_id, 'dispatched', b.id]
        );
      }

      res.json({
        code: 0,
        message: `派车成功，共${bookingsToDispatch.length}位乘客已分配至车辆 ${bus[0].plate_number}`,
        data: {
          bus: bus[0],
          passenger_count: bookingsToDispatch.length
        }
      });
    } catch (error) {
      console.error('[Dispatch] 派车失败:', error);
      res.json({ code: 500, message: '派车失败' });
    }
  }

  async completeTrip(req, res) {
    try {
      const { bus_id } = req.body;

      if (!bus_id) {
        return res.json({ code: 400, message: '参数不完整' });
      }

      const bus = await db.query('SELECT * FROM buses WHERE id = ?', [bus_id]);
      if (bus.length === 0) {
        return res.json({ code: 404, message: '车辆不存在' });
      }

      await db.query('UPDATE buses SET status = ? WHERE id = ?', ['idle', bus_id]);

      await db.query(
        `UPDATE bookings SET status = ? WHERE bus_id = ? AND status = 'dispatched'`,
        ['completed', bus_id]
      );

      res.json({ code: 0, message: '行程已完成，车辆已恢复空闲状态' });
    } catch (error) {
      console.error('[Dispatch] 完成行程失败:', error);
      res.json({ code: 500, message: '操作失败' });
    }
  }

  async getDispatchedTrips(req, res) {
    try {
      const sql = `
        SELECT DISTINCT
          b.bus_id,
          bu.plate_number,
          bu.driver_name,
          bu.driver_phone,
          b.travel_date,
          s.route,
          s.departure_time,
          s.arrival_time,
          COUNT(b.id) as passenger_count,
          b.status
        FROM bookings b
        LEFT JOIN buses bu ON b.bus_id = bu.id
        LEFT JOIN schedules s ON b.schedule_id = s.id
        WHERE b.bus_id IS NOT NULL
        GROUP BY b.bus_id, b.travel_date, b.schedule_id
        ORDER BY b.travel_date DESC, s.departure_time
      `;
      const trips = await db.query(sql);
      res.json({ code: 0, data: trips });
    } catch (error) {
      console.error('[Dispatch] 获取派车记录失败:', error);
      res.json({ code: 500, message: '获取派车记录失败' });
    }
  }
}

module.exports = new DispatchController();
