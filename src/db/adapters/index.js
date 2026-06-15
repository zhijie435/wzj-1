const SqliteAdapter = require('./SqliteAdapter');
const MysqlAdapter = require('./MysqlAdapter');

class DatabaseAdapterFactory {
  static create(type) {
    switch (type) {
      case 'sqlite':
        return new SqliteAdapter();
      case 'mysql':
        return new MysqlAdapter();
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }
}

module.exports = DatabaseAdapterFactory;
