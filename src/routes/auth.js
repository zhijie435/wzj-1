const express = require('express');
const router = express.Router();
const { generateToken } = require('../middleware/auth');

const ADMIN_USERS = [
  { username: process.env.ADMIN_USER || 'admin', password: process.env.ADMIN_PASS || 'admin123' }
];

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ code: 400, message: '请输入用户名和密码' });
  }

  const user = ADMIN_USERS.find(
    u => u.username === username && u.password === password
  );

  if (!user) {
    return res.json({ code: 401, message: '用户名或密码错误' });
  }

  const token = generateToken(user.username);
  res.json({
    code: 0,
    message: '登录成功',
    data: { token, username: user.username }
  });
});

module.exports = router;
