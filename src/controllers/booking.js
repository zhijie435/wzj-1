const db = require('../db');

class BookingController {
  async getSchedules(req, res) {
    try {
      const { route, date } = req.query;
      let sql = 'SELECT * FROM schedules WHERE 1=1';
      const params = [];
      if (route) {
        sql += ' AND route = ?';
        params.push(route);
      }
      sql += ' ORDER BY departure_time';
      const schedules = await db.query(sql, params);

      if (date) {
        for (const s of schedules) {
          const booked = await db.query(
            `SELECT COUNT(*) as count FROM bookings 
             WHERE schedule_id = ? AND travel_date = ? AND status != 'cancelled'`,
            [s.id, date]
          );
          const bookedCount = booked[0].count;
          s.booked_count = bookedCount;
          s.remaining_seats = Math.max(0, s.total_seats - bookedCount);
          s.is_full = bookedCount >= s.total_seats;
        }
      }

      res.json({ code: 0, data: schedules });
    } catch (error) {
      console.error('[Booking] 获取班次失败:', error);
      res.json({ code: 500, message: '获取班次失败' });
    }
  }

  async createBooking(req, res) {
    try {
      const { passenger_name, passenger_phone, id_card, schedule_id, travel_date } = req.body;

      if (!passenger_name || !passenger_phone || !schedule_id || !travel_date) {
        return res.json({ code: 400, message: '请填写完整信息' });
      }

      const schedule = await db.query('SELECT * FROM schedules WHERE id = ?', [schedule_id]);
      if (schedule.length === 0) {
        return res.json({ code: 400, message: '班次不存在' });
      }

      const bookedCount = await db.query(
        `SELECT COUNT(*) as count FROM bookings 
         WHERE schedule_id = ? AND travel_date = ? AND status != 'cancelled'`,
        [schedule_id, travel_date]
      );
      if (bookedCount[0].count >= schedule[0].total_seats) {
        return res.json({ code: 400, message: '该班次已满员，请选择其他班次' });
      }

      const existingBookings = await db.query(
        'SELECT COUNT(*) as count FROM bookings WHERE schedule_id = ? AND travel_date = ?',
        [schedule_id, travel_date]
      );

      const seatNumber = existingBookings[0].count + 1;

      const result = await db.query(
        `INSERT INTO bookings (passenger_name, passenger_phone, id_card, schedule_id, travel_date, seat_number, status)
         VALUES (?, ?, ?, ?, ?, ?, 'confirmed')`,
        [passenger_name, passenger_phone, id_card || '', schedule_id, travel_date, seatNumber]
      );

      const bookingId = result[0].insertId;
      const booking = await db.query(
        `SELECT b.*, s.route, s.departure_time, s.arrival_time, s.price
         FROM bookings b LEFT JOIN schedules s ON b.schedule_id = s.id
         WHERE b.id = ?`,
        [bookingId]
      );

      res.json({ code: 0, data: booking[0], message: '预定成功' });
    } catch (error) {
      console.error('[Booking] 创建预定失败:', error);
      res.json({ code: 500, message: '预定失败' });
    }
  }

  async getBookings(req, res) {
    try {
      const { phone, date, status } = req.query;
      const isAdmin = !!req.adminUser;

      if (!isAdmin && !phone) {
        return res.json({ code: 400, message: '请提供手机号进行查询' });
      }

      let sql = `SELECT b.*, s.route, s.departure_time, s.arrival_time, s.price,
                        bu.plate_number, bu.driver_name, bu.driver_phone
                 FROM bookings b
                 LEFT JOIN schedules s ON b.schedule_id = s.id
                 LEFT JOIN buses bu ON b.bus_id = bu.id
                 WHERE 1=1`;
      const params = [];

      if (phone) {
        sql += ' AND b.passenger_phone = ?';
        params.push(phone);
      }
      if (date) {
        sql += ' AND b.travel_date = ?';
        params.push(date);
      }
      if (status) {
        sql += ' AND b.status = ?';
        params.push(status);
      }

      sql += ' ORDER BY b.created_at DESC';
      const bookings = await db.query(sql, params);
      res.json({ code: 0, data: bookings });
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

      const booking = await db.query(
        `SELECT b.*, s.route, s.departure_time, s.arrival_time, s.price,
                bu.plate_number, bu.driver_name, bu.driver_phone
         FROM bookings b
         LEFT JOIN schedules s ON b.schedule_id = s.id
         LEFT JOIN buses bu ON b.bus_id = bu.id
         WHERE b.id = ?`,
        [id]
      );

      if (booking.length === 0) {
        return res.json({ code: 404, message: '订单不存在' });
      }

      if (!isAdmin && booking[0].passenger_phone !== phone) {
        return res.json({ code: 403, message: '无权查看该订单' });
      }

      res.json({ code: 0, data: booking[0] });
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

      const booking = await db.query('SELECT * FROM bookings WHERE id = ?', [id]);

      if (booking.length === 0) {
        return res.json({ code: 404, message: '订单不存在' });
      }

      if (!isAdmin && booking[0].passenger_phone !== phone) {
        return res.json({ code: 403, message: '无权取消该订单' });
      }

      if (booking[0].status === 'dispatched') {
        return res.json({ code: 400, message: '已派车订单不能取消' });
      }

      await db.query('UPDATE bookings SET status = ? WHERE id = ?', ['cancelled', id]);
      res.json({ code: 0, message: '取消成功' });
    } catch (error) {
      console.error('[Booking] 取消订单失败:', error);
      res.json({ code: 500, message: '取消失败' });
    }
  }
}

module.exports = new BookingController();
