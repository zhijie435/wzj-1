const BaseRepository = require('./BaseRepository');

class ScheduleRepository extends BaseRepository {
  constructor() {
    super('schedules');
  }

  async findByRoute(route) {
    return this.findAll({
      where: ['route = ?'],
      params: [route],
      orderBy: 'departure_time',
      order: 'ASC'
    });
  }

  async findSchedulesWithBookingStats(route, date) {
    const where = [];
    const params = [];

    if (route) {
      where.push('s.route = ?');
      params.push(route);
    }

    let joinCondition = '1=0';
    if (date) {
      joinCondition = 'b.schedule_id = s.id';
      params.unshift(date);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const sql = `
      SELECT 
        s.*,
        COALESCE(b.booked_count, 0) as booked_count,
        (s.total_seats - COALESCE(b.booked_count, 0)) as remaining_seats,
        (COALESCE(b.booked_count, 0) >= s.total_seats) as is_full
      FROM schedules s
      LEFT JOIN (
        SELECT schedule_id, COUNT(*) as booked_count
        FROM bookings
        WHERE travel_date = ? AND status != 'cancelled'
        GROUP BY schedule_id
      ) b ON ${date ? 'b.schedule_id = s.id' : '1=0'}
      ${whereClause}
      ORDER BY s.departure_time ASC
    `;

    return this.db.query(sql, params);
  }
}

module.exports = ScheduleRepository;
