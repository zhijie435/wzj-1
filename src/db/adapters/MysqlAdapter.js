const mysql = require('mysql2/promise');
const BaseAdapter = require('./BaseAdapter');

class MysqlAdapter extends BaseAdapter {
  constructor() {
    super();
  }

  async init() {
    this.connection = await mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: process.env.MYSQL_PORT,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    await this.createTables();
    console.log('[DB] MySQL 数据库已连接');
  }

  async createTables() {
    const sql = `
      CREATE TABLE IF NOT EXISTS buses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plate_number VARCHAR(20) NOT NULL UNIQUE,
        capacity INT NOT NULL DEFAULT 45,
        driver_name VARCHAR(50),
        driver_phone VARCHAR(20),
        status VARCHAR(20) DEFAULT 'idle',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        route VARCHAR(100) NOT NULL,
        departure_time VARCHAR(10) NOT NULL,
        arrival_time VARCHAR(10) NOT NULL,
        price DECIMAL(10,2) NOT NULL DEFAULT 80,
        total_seats INT NOT NULL DEFAULT 45,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        passenger_name VARCHAR(50) NOT NULL,
        passenger_phone VARCHAR(20) NOT NULL,
        id_card VARCHAR(20),
        schedule_id INT NOT NULL,
        travel_date DATE NOT NULL,
        seat_number INT,
        status VARCHAR(20) DEFAULT 'pending',
        bus_id INT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (schedule_id) REFERENCES schedules(id),
        FOREIGN KEY (bus_id) REFERENCES buses(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

      CREATE INDEX idx_bookings_schedule_date ON bookings(schedule_id, travel_date);
      CREATE INDEX idx_bookings_status ON bookings(status);
      CREATE INDEX idx_bookings_phone ON bookings(passenger_phone);
      CREATE INDEX idx_bookings_bus ON bookings(bus_id);
      CREATE INDEX idx_schedules_route ON schedules(route);
      CREATE INDEX idx_buses_status ON buses(status);
    `;
    await this.connection.query(sql);
  }

  async query(sql, params = []) {
    const [rows] = await this.connection.execute(sql, params);
    return rows;
  }

  async close() {
    await this.connection.end();
  }
}

module.exports = MysqlAdapter;
