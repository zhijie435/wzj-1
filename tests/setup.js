process.env.DB_TYPE = 'sqlite';
process.env.NODE_ENV = 'test';

const db = require('../src/db');

beforeAll(async () => {
  await db.init();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.query('DELETE FROM bookings');
  await db.query('DELETE FROM buses');
  await db.query('DELETE FROM schedules');
  await db.query("DELETE FROM sqlite_sequence WHERE name IN ('bookings', 'buses', 'schedules')");
  await db.seedData();
});
