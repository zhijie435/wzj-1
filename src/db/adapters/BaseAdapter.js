class BaseAdapter {
  constructor() {
    this.connection = null;
  }

  async init() {
    throw new Error('init() must be implemented by subclass');
  }

  async query(sql, params = []) {
    throw new Error('query() must be implemented by subclass');
  }

  async close() {
    throw new Error('close() must be implemented by subclass');
  }

  async createTables() {
    throw new Error('createTables() must be implemented by subclass');
  }
}

module.exports = BaseAdapter;
