require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/bookings', require('./routes/booking'));
app.use('/api/dispatch', require('./routes/dispatch'));
app.use('/api/auth', require('./routes/auth'));

app.get('/api/health', (req, res) => {
  res.json({ code: 0, message: 'ok', env: process.env.NODE_ENV, db: process.env.DB_TYPE });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

async function start() {
  try {
    await db.init();
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║             北京-张家口 班车预定系统                     ║
╠══════════════════════════════════════════════════════════╣
║  服务地址: http://localhost:${PORT}                        ║
║  环境: ${process.env.NODE_ENV || 'development'}                              ║
║  数据库: ${process.env.DB_TYPE || 'sqlite'}                              ║
║  用户端: http://localhost:${PORT}                        ║
║  管理端: http://localhost:${PORT}/admin                  ║
╚══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

start();
