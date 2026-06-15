const DatabaseAdapterFactory = require('./adapters');

class DB {
  constructor() {
    this.type = process.env.DB_TYPE || 'sqlite';
    this.adapter = DatabaseAdapterFactory.create(this.type);
  }

  get connection() {
    return this.adapter.connection;
  }

  async init() {
    await this.adapter.init();
    await this.seedData();
  }

  async seedData() {
    const scheduleCount = await this.query('SELECT COUNT(*) as count FROM schedules');
    if (scheduleCount[0].count === 0) {
      const schedules = [
        { route: '北京→张家口', departure_time: '07:00', arrival_time: '10:30', price: 80, total_seats: 45 },
        { route: '北京→张家口', departure_time: '09:00', arrival_time: '12:30', price: 80, total_seats: 45 },
        { route: '北京→张家口', departure_time: '11:00', arrival_time: '14:30', price: 80, total_seats: 35 },
        { route: '北京→张家口', departure_time: '14:00', arrival_time: '17:30', price: 80, total_seats: 45 },
        { route: '北京→张家口', departure_time: '17:00', arrival_time: '20:30', price: 80, total_seats: 35 },
        { route: '张家口→北京', departure_time: '07:00', arrival_time: '10:30', price: 80, total_seats: 45 },
        { route: '张家口→北京', departure_time: '09:00', arrival_time: '12:30', price: 80, total_seats: 45 },
        { route: '张家口→北京', departure_time: '14:00', arrival_time: '17:30', price: 80, total_seats: 35 },
      ];
      for (const s of schedules) {
        await this.query(
          'INSERT INTO schedules (route, departure_time, arrival_time, price, total_seats) VALUES (?, ?, ?, ?, ?)',
          [s.route, s.departure_time, s.arrival_time, s.price, s.total_seats]
        );
      }
    }

    const busCount = await this.query('SELECT COUNT(*) as count FROM buses');
    if (busCount[0].count === 0) {
      const buses = [
        { plate_number: '京A12345', capacity: 45, driver_name: '张师傅', driver_phone: '13800138001' },
        { plate_number: '京A12346', capacity: 45, driver_name: '李师傅', driver_phone: '13800138002' },
        { plate_number: '京A12347', capacity: 45, driver_name: '王师傅', driver_phone: '13800138003' },
      ];
      for (const b of buses) {
        await this.query(
          'INSERT INTO buses (plate_number, capacity, driver_name, driver_phone) VALUES (?, ?, ?, ?)',
          [b.plate_number, b.capacity, b.driver_name, b.driver_phone]
        );
      }
    }
  }

  async query(sql, params = []) {
    return this.adapter.query(sql, params);
  }

  async close() {
    return this.adapter.close();
  }
}

module.exports = new DB();
