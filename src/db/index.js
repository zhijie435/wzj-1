const Database = require('better-sqlite3');
const mysql = require('mysql2/promise');

class DB {
  constructor() {
    this.type = process.env.DB_TYPE || 'sqlite';
    this.connection = null;
  }

  async init() {
    if (this.type === 'sqlite') {
      this.connection = new Database(':memory:');
      this.connection.pragma('journal_mode = WAL');
      await this.createTablesSQLite();
      await this.seedData();
      console.log('[DB] SQLite 内存数据库已初始化');
    } else if (this.type === 'mysql') {
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
      await this.createTablesMySQL();
      await this.seedData();
      console.log('[DB] MySQL 数据库已连接');
    }
  }

  async createTablesSQLite() {
    const sql = `
      CREATE TABLE IF NOT EXISTS buses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate_number TEXT NOT NULL UNIQUE,
        capacity INTEGER NOT NULL DEFAULT 45,
        driver_name TEXT,
        driver_phone TEXT,
        status TEXT DEFAULT 'idle',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route TEXT NOT NULL,
        departure_time TEXT NOT NULL,
        arrival_time TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 80,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        passenger_name TEXT NOT NULL,
        passenger_phone TEXT NOT NULL,
        id_card TEXT,
        schedule_id INTEGER NOT NULL,
        travel_date TEXT NOT NULL,
        seat_number INTEGER,
        status TEXT DEFAULT 'pending',
        bus_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (schedule_id) REFERENCES schedules(id),
        FOREIGN KEY (bus_id) REFERENCES buses(id)
      );
    `;
    this.connection.exec(sql);
  }

  async createTablesMySQL() {
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
    `;
    await this.connection.query(sql);
  }

  async seedData() {
    const scheduleCount = await this.query('SELECT COUNT(*) as count FROM schedules');
    if (scheduleCount[0].count === 0) {
      const schedules = [
        { route: '北京→张家口', departure_time: '07:00', arrival_time: '10:30', price: 80 },
        { route: '北京→张家口', departure_time: '09:00', arrival_time: '12:30', price: 80 },
        { route: '北京→张家口', departure_time: '11:00', arrival_time: '14:30', price: 80 },
        { route: '北京→张家口', departure_time: '14:00', arrival_time: '17:30', price: 80 },
        { route: '北京→张家口', departure_time: '17:00', arrival_time: '20:30', price: 80 },
        { route: '张家口→北京', departure_time: '07:00', arrival_time: '10:30', price: 80 },
        { route: '张家口→北京', departure_time: '09:00', arrival_time: '12:30', price: 80 },
        { route: '张家口→北京', departure_time: '14:00', arrival_time: '17:30', price: 80 },
      ];
      for (const s of schedules) {
        await this.query(
          'INSERT INTO schedules (route, departure_time, arrival_time, price) VALUES (?, ?, ?, ?)',
          [s.route, s.departure_time, s.arrival_time, s.price]
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
    if (this.type === 'sqlite') {
      const stmt = this.connection.prepare(sql);
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return stmt.all(...params);
      } else {
        const result = stmt.run(...params);
        return [{ insertId: result.lastInsertRowid, affectedRows: result.changes }];
      }
    } else if (this.type === 'mysql') {
      const [rows] = await this.connection.execute(sql, params);
      return rows;
    }
  }

  async close() {
    if (this.type === 'sqlite') {
      this.connection.close();
    } else if (this.type === 'mysql') {
      await this.connection.end();
    }
  }
}

module.exports = new DB();
