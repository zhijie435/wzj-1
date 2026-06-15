const BaseRepository = require('./BaseRepository');

class BookingRepository extends BaseRepository {
  constructor() {
    super('bookings');
  }

  async getBookedCount(scheduleId, travelDate) {
    const rows = await this.db.query(
      `SELECT COUNT(*) as count FROM bookings 
       WHERE schedule_id = ? AND travel_date = ? AND status != 'cancelled'`,
      [scheduleId, travelDate]
    );
    return rows[0].count;
  }

  async getSeatNumber(scheduleId, travelDate) {
    const rows = await this.db.query(
      'SELECT COUNT(*) as count FROM bookings WHERE schedule_id = ? AND travel_date = ?',
      [scheduleId, travelDate]
    );
    return rows[0].count + 1;
  }

  async findByIdWithDetail(id) {
    const rows = await this.db.query(
      `SELECT b.*, s.route, s.departure_time, s.arrival_time, s.price,
              bu.plate_number, bu.driver_name, bu.driver_phone
       FROM bookings b
       LEFT JOIN schedules s ON b.schedule_id = s.id
       LEFT JOIN buses bu ON b.bus_id = bu.id
       WHERE b.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  async findWithDetail(filters = {}) {
    const { phone, date, status, page = 1, pageSize = 20 } = filters;
    const where = [];
    const params = [];

    if (phone) {
      where.push('b.passenger_phone = ?');
      params.push(phone);
    }
    if (date) {
      where.push('b.travel_date = ?');
      params.push(date);
    }
    if (status) {
      where.push('b.status = ?');
      params.push(status);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const countSql = `
      SELECT COUNT(*) as count
      FROM bookings b
      LEFT JOIN schedules s ON b.schedule_id = s.id
      ${whereClause}
    `;
    const countResult = await this.db.query(countSql, params);
    const total = countResult[0].count;

    const offset = (page - 1) * pageSize;
    const listSql = `
      SELECT b.*, s.route, s.departure_time, s.arrival_time, s.price,
             bu.plate_number, bu.driver_name, bu.driver_phone
      FROM bookings b
      LEFT JOIN schedules s ON b.schedule_id = s.id
      LEFT JOIN buses bu ON b.bus_id = bu.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const list = await this.db.query(listSql, [...params, pageSize, offset]);

    return {
      list,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async findPendingBookings(filters = {}) {
    const { date, route, page = 1, pageSize = 20 } = filters;
    const where = ["b.status = 'confirmed'", 'b.bus_id IS NULL'];
    const params = [];

    if (date) {
      where.push('b.travel_date = ?');
      params.push(date);
    }
    if (route) {
      where.push('s.route = ?');
      params.push(route);
    }

    const whereClause = 'WHERE ' + where.join(' AND ');

    const sql = `
      SELECT b.*, s.route, s.departure_time, s.arrival_time, s.price
      FROM bookings b
      LEFT JOIN schedules s ON b.schedule_id = s.id
      ${whereClause}
      ORDER BY b.travel_date, s.departure_time
    `;

    return this.db.query(sql, params);
  }

  async findConfirmedByScheduleAndDate(scheduleId, travelDate) {
    return this.db.query(
      `SELECT * FROM bookings
       WHERE schedule_id = ? AND travel_date = ? AND status = 'confirmed' AND bus_id IS NULL`,
      [scheduleId, travelDate]
    );
  }

  async batchUpdateBusAndStatus(bookingIds, busId, status) {
    if (bookingIds.length === 0) return;

    const placeholders = bookingIds.map(() => '?').join(', ');
    const sql = `
      UPDATE bookings 
      SET bus_id = ?, status = ? 
      WHERE id IN (${placeholders})
    `;
    return this.db.query(sql, [busId, status, ...bookingIds]);
  }

  async updateStatusByBusId(busId, fromStatus, toStatus) {
    return this.db.query(
      `UPDATE bookings SET status = ? WHERE bus_id = ? AND status = ?`,
      [toStatus, busId, fromStatus]
    );
  }

  async getDispatchedTrips(filters = {}) {
    const { page = 1, pageSize = 20 } = filters;

    const countSql = `
      SELECT COUNT(*) as count
      FROM (
        SELECT 1
        FROM bookings b
        WHERE b.bus_id IS NOT NULL
        GROUP BY b.bus_id, b.travel_date, b.schedule_id
      ) as t
    `;
    const countResult = await this.db.query(countSql, []);
    const total = countResult[0].count;

    const offset = (page - 1) * pageSize;
    const sql = `
      SELECT 
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
      LIMIT ? OFFSET ?
    `;
    const list = await this.db.query(sql, [pageSize, offset]);

    return {
      list,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(total / pageSize)
    };
  }
}

module.exports = BookingRepository;
