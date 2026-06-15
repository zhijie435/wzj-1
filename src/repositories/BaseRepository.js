const db = require('../db');

class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
    this.db = db;
  }

  async findById(id) {
    const rows = await this.db.query(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  async findAll(options = {}) {
    const { where = [], params = [], orderBy = 'id', order = 'ASC' } = options;
    let sql = `SELECT * FROM ${this.tableName}`;
    if (where.length > 0) {
      sql += ' WHERE ' + where.join(' AND ');
    }
    sql += ` ORDER BY ${orderBy} ${order}`;
    return this.db.query(sql, params);
  }

  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
    const result = await this.db.query(sql, values);
    return result[0].insertId;
  }

  async update(id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    return this.db.query(sql, [...values, id]);
  }

  async delete(id) {
    return this.db.query(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
  }

  async count(where = [], params = []) {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    if (where.length > 0) {
      sql += ' WHERE ' + where.join(' AND ');
    }
    const rows = await this.db.query(sql, params);
    return rows[0].count;
  }
}

module.exports = BaseRepository;
