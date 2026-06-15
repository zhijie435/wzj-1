const BaseRepository = require('./BaseRepository');

class BusRepository extends BaseRepository {
  constructor() {
    super('buses');
  }

  async findByStatus(status) {
    if (!status) {
      return this.findAll({ orderBy: 'id', order: 'ASC' });
    }
    return this.findAll({
      where: ['status = ?'],
      params: [status],
      orderBy: 'id',
      order: 'ASC'
    });
  }

  async updateStatus(id, status) {
    return this.update(id, { status });
  }
}

module.exports = BusRepository;
