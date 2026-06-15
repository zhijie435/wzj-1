const Database = require('better-sqlite3');
const BaseAdapter = require('./BaseAdapter');

class SqliteAdapter extends BaseAdapter {
  constructor() {
    super();
  }

  async init() {
    this.connection = new Database(':memory:');
    this.connection.pragma('journal_mode = WAL');
    await this.createTables();
    console.log('[DB] SQLite 内存数据库已初始化');
  }

  async createTables() {
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
        total_seats INTEGER NOT NULL DEFAULT 45,
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

      CREATE INDEX IF NOT EXISTS idx_bookings_schedule_date ON bookings(schedule_id, travel_date);
      CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
      CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(passenger_phone);
      CREATE INDEX IF NOT EXISTS idx_bookings_bus ON bookings(bus_id);
      CREATE INDEX IF NOT EXISTS idx_schedules_route ON schedules(route);
      CREATE INDEX IF NOT EXISTS idx_buses_status ON buses(status);
    `;
    this.connection.exec(sql);
  }

  async query(sql, params = []) {
    const stmt = this.connection.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return stmt.all(...params);
    } else {
      const result = stmt.run(...params);
      return [{ insertId: result.lastInsertRowid, affectedRows: result.changes }];
    }
  }

  async close() {
    this.connection.close();
  }
}

module.exports = SqliteAdapter;
