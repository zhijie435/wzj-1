# 班车预定系统 - 安全漏洞分析与优化方案

> 版本：v1.0.0  
> 更新日期：2026-06-16  
> 严重等级说明：🔴 严重 | 🟠 高危 | 🟡 中危 | 🔵 低危

---

## 目录

1. [安全漏洞总览](#1-安全漏洞总览)
2. [🔴 严重漏洞及修复方案](#2-严重漏洞及修复方案)
3. [🟠 高危漏洞及修复方案](#3-高危漏洞及修复方案)
4. [🟡 中危漏洞及修复方案](#4-中危漏洞及修复方案)
5. [🔵 低危漏洞与安全加固建议](#5-低危漏洞与安全加固建议)
6. [安全配置最佳实践](#6-安全配置最佳实践)
7. [生产环境安全Checklist](#7-生产环境安全checklist)

---

## 1. 安全漏洞总览

经过对系统源码的全面审查，共发现 **15项** 安全隐患，按严重等级分布如下：

| 等级 | 数量 | 典型问题 |
|------|------|----------|
| 🔴 严重 | 3 | 默认弱口令、硬编码密钥、内存数据库生产风险 |
| 🟠 高危 | 4 | 无速率限制、超卖竞态、CORS过宽、XSS风险 |
| 🟡 中危 | 5 | 敏感数据明文、Token不可撤销、无审计、无HTTPS强制、输入验证不足 |
| 🔵 低危 | 3 | 缺少安全头、错误信息暴露、无日志分级 |

---

## 2. 🔴 严重漏洞及修复方案

### 2.1 默认管理员弱口令（硬编码）

**风险位置**：[src/routes/auth.js#L5-L7](file:///Users/wuzhijie/Documents/xiaohongshu/biaozhu/wzj/1/src/routes/auth.js#L5-L7)

**问题描述**：
```javascript
const ADMIN_USERS = [
  { username: process.env.ADMIN_USER || 'admin', password: process.env.ADMIN_PASS || 'admin123' }
];
```
- 默认账号 `admin / admin123` 极易被自动化扫描工具爆破
- 即使配了环境变量，生产环境若遗漏配置仍会落入默认值
- 密码明文硬编码在源码中，有泄露风险

**攻击场景**：
攻击者使用常见弱口令字典扫描 `/api/auth/login`，几秒钟即可获取管理员权限，进而接管整个派车系统，查看所有乘客身份证、手机号等隐私数据。

**修复方案**：

**第一步：强制要求环境变量配置，移除默认值**
```javascript
// src/routes/auth.js
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

if (!ADMIN_USER || !ADMIN_PASS) {
  console.error('[FATAL] 缺少管理员账号密码配置，请设置 ADMIN_USER 和 ADMIN_PASS 环境变量');
  process.exit(1);
}
```

**第二步：使用 bcrypt 哈希存储密码（推荐方案）**

安装依赖：
```bash
npm install bcrypt
```

改造 `auth.js`：
```javascript
const bcrypt = require('bcrypt');

// 启动时校验并生成/验证密码哈希
async function initAdminAuth() {
  const ADMIN_USER = process.env.ADMIN_USER;
  const ADMIN_PASS = process.env.ADMIN_PASS;
  const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH;

  if (!ADMIN_USER) {
    console.error('[FATAL] 必须配置 ADMIN_USER');
    process.exit(1);
  }

  if (!ADMIN_PASS && !ADMIN_PASS_HASH) {
    console.error('[FATAL] 必须配置 ADMIN_PASS 或 ADMIN_PASS_HASH（推荐后者）');
    process.exit(1);
  }

  // 支持两种模式：明文密码（启动后转哈希）或预生成哈希
  if (ADMIN_PASS_HASH) {
    module.exports.adminConfig = { username: ADMIN_USER, passwordHash: ADMIN_PASS_HASH };
  } else {
    const hash = await bcrypt.hash(ADMIN_PASS, 12);
    console.log('[建议] 将以下哈希值配置到 ADMIN_PASS_HASH 并删除 ADMIN_PASS：\n', hash);
    module.exports.adminConfig = { username: ADMIN_USER, passwordHash: hash };
  }
}

// 登录时对比
const match = await bcrypt.compare(password, adminConfig.passwordHash);
if (!match) return res.json({ code: 401, message: '用户名或密码错误' });
```

生成密码哈希的辅助脚本：
```javascript
// scripts/gen-hash.js
const bcrypt = require('bcrypt');
const password = process.argv[2];
if (!password) { console.log('用法: node scripts/gen-hash.js <密码>'); process.exit(1); }
bcrypt.hash(password, 12).then(h => console.log('Hash:', h));
```

---

### 2.2 Token签名密钥硬编码

**风险位置**：[src/middleware/auth.js#L3](file:///Users/wuzhijie/Documents/xiaohongshu/biaozhu/wzj/1/src/middleware/auth.js#L3)

**问题描述**：
```javascript
const SECRET = process.env.AUTH_SECRET || 'bus-booking-system-secret-key-2024';
```
- 默认密钥公开在 Git 仓库中，任何人都可以伪造任意用户的 Token
- 密钥强度虽够但已公开，等同于形同虚设

**攻击场景**：
攻击者拿到源码中的默认密钥，自行构造：
```javascript
const payload = { username: 'admin', iat: Date.now(), exp: Date.now() + 86400000 };
const signature = crypto.createHmac('sha256', 'bus-booking-system-secret-key-2024')
    .update(JSON.stringify(payload)).digest('hex');
// 直接用这个伪造的Token就能登录管理端
```

**修复方案**：

```javascript
// src/middleware/auth.js
const crypto = require('crypto');

// 强制从环境变量读取，不提供默认值
const SECRET = process.env.AUTH_SECRET;

if (!SECRET || SECRET.length < 32) {
  console.error('[FATAL] AUTH_SECRET 未配置或强度不足（至少32字符）');
  console.error('生成强密钥命令: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}

const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24小时，可配置化
```

提供密钥生成指南（在 `.env.example` 中提示）：
```bash
# 生成64字符强随机密钥
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

### 2.3 SQLite 内存数据库生产风险

**风险位置**：[src/db/index.js#L11-L16](file:///Users/wuzhijie/Documents/xiaohongshu/biaozhu/wzj/1/src/db/index.js#L11-L16)

**问题描述**：
```javascript
if (this.type === 'sqlite') {
  this.connection = new Database(':memory:'); // 内存模式
  // ...
}
```
- 默认使用 `:memory:` 内存数据库，**服务重启数据全部丢失**
- 开发者或运维若遗漏配置 `DB_TYPE=mysql`，生产环境会直接跑在内存库上
- 无法做数据备份、无法做数据恢复

**修复方案**：

在 [server.js](file:///Users/wuzhijie/Documents/xiaohongshu/biaozhu/wzj/1/src/server.js) 启动时增加生产环境校验：

```javascript
// src/server.js 启动函数开头
async function start() {
  // 生产环境安全检查
  if (process.env.NODE_ENV === 'production') {
    if (process.env.DB_TYPE !== 'mysql') {
      console.error('[FATAL] 生产环境必须使用 MySQL！请配置 DB_TYPE=mysql');
      process.exit(1);
    }
    if (process.env.AUTH_SECRET === 'bus-booking-system-secret-key-2024' || !process.env.AUTH_SECRET) {
      console.error('[FATAL] 生产环境必须修改默认 AUTH_SECRET！');
      process.exit(1);
    }
  }

  try {
    await db.init();
    // ...
  }
}
```

同时将 SQLite 默认改为文件模式（开发环境友好）：
```javascript
// src/db/index.js
const path = require('path');

async init() {
  if (this.type === 'sqlite') {
    // 改为文件模式，不再丢失数据；仅开发环境下允许
    const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '..', '..', 'data.sqlite');
    this.connection = new Database(dbPath);
    this.connection.pragma('journal_mode = WAL');
    // ...
  }
}
```

---

## 3. 🟠 高危漏洞及修复方案

### 3.1 登录接口无速率限制（暴力破解风险）

**风险位置**：[src/routes/auth.js#L9-L30](file:///Users/wuzhijie/Documents/xiaohongshu/biaozhu/wzj/1/src/routes/auth.js#L9-L30)

**问题描述**：
- 登录接口无任何频率限制，攻击者可每秒尝试数千次密码
- 即使密码较强，也可通过字典攻击逐步爆破
- 无验证码、无IP封禁机制

**修复方案**：使用 `express-rate-limit` 中间件

```bash
npm install express-rate-limit
```

```javascript
// src/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

// 登录限流：同一IP 15分钟内最多尝试 5 次
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { code: 429, message: '尝试次数过多，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip
});

// 预定接口限流：同一IP 1分钟内最多 10 次下单（防刷票）
const bookingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { code: 429, message: '操作过于频繁，请稍后再试' },
  keyGenerator: (req) => req.ip
});

// 查询接口限流：同一IP 1分钟最多 60 次
const queryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { code: 429, message: '请求过于频繁' },
  keyGenerator: (req) => req.ip
});

module.exports = { loginLimiter, bookingLimiter, queryLimiter };
```

在路由中应用：
```javascript
// src/routes/auth.js
const { loginLimiter } = require('../middleware/rateLimit');
router.post('/login', loginLimiter, (req, res) => { ... });

// src/routes/booking.js
const { bookingLimiter, queryLimiter } = require('../middleware/rateLimit');
router.post('/', bookingLimiter, bookingController.createBooking);
router.get('/schedules', queryLimiter, bookingController.getSchedules);
```

---

### 3.2 订单超卖（竞态条件）

**风险位置**：[src/controllers/booking.js#L50-L70](file:///Users/wuzhijie/Documents/xiaohongshu/biaozhu/wzj/1/src/controllers/booking.js#L50-L70)

**问题描述**：
```javascript
// 步骤1：查询余票
const bookedCount = await db.query('SELECT COUNT(*) ...');
if (bookedCount[0].count >= schedule[0].total_seats) { return 满员; }

// 步骤2：插入订单
await db.query('INSERT INTO bookings ...');
```

**并发场景**：
同一班次仅剩1个座位时，两个请求同时到达，都通过了步骤1的检查，然后都执行了步骤2，实际卖出了2个座位。高并发下会频繁出现超卖。

**修复方案（MySQL版，利用事务+行锁）**：

```javascript
// src/controllers/booking.js - createBooking 重写
async createBooking(req, res) {
  const { passenger_name, passenger_phone, id_card, schedule_id, travel_date } = req.body;

  // 参数校验（略）

  const connection = db.getConnection(); // 需要暴露连接池
  let success = false;

  try {
    await connection.beginTransaction();

    // 1. 先 SELECT ... FOR UPDATE 锁定相关行（防止并发）
    const [lockResult] = await connection.execute(
      `SELECT COUNT(*) as count FROM bookings 
       WHERE schedule_id = ? AND travel_date = ? AND status != 'cancelled'
       FOR UPDATE`,
      [schedule_id, travel_date]
    );

    const bookedCount = lockResult[0].count;
    const [schedules] = await connection.execute('SELECT total_seats FROM schedules WHERE id = ? FOR UPDATE', [schedule_id]);
    
    if (schedules.length === 0) {
      await connection.rollback();
      return res.json({ code: 400, message: '班次不存在' });
    }

    if (bookedCount >= schedules[0].total_seats) {
      await connection.rollback();
      return res.json({ code: 400, message: '该班次已满员，请选择其他班次' });
    }

    // 2. 在事务中完成插入和座位号计算
    const [insertResult] = await connection.execute(
      `INSERT INTO bookings (...) VALUES (?, ?, ?, ?, ?, 'confirmed')`,
      [...]
    );

    // 3. 查询完整订单
    const [booking] = await connection.execute(
      `SELECT b.*, s.route, s.departure_time, s.arrival_time, s.price 
       FROM bookings b LEFT JOIN schedules s ON b.schedule_id = s.id WHERE b.id = ?`,
      [insertResult.insertId]
    );

    await connection.commit();
    success = true;
    res.json({ code: 0, data: booking[0], message: '预定成功' });

  } catch (error) {
    if (!success) await connection.rollback();
    console.error(error);
    res.json({ code: 500, message: '预定失败' });
  }
}
```

注意：SQLite 对事务支持有限，生产环境请务必用 MySQL。

---

### 3.3 CORS 配置过于宽松

**风险位置**：[src/server.js#L10](file:///Users/wuzhijie/Documents/xiaohongshu/biaozhu/wzj/1/src/server.js#L10)

**问题描述**：
```javascript
app.use(cors()); // 允许所有来源、所有方法、所有头
```

**攻击场景**：
用户登录了班车管理系统后，访问了恶意网站，恶意网站通过 CORS 直接调用派车接口：
```javascript
// 恶意网站 JS
fetch('https://your-bus-site.com/api/dispatch/assign', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bus_id: 1, schedule_id: 1, travel_date: '...' })
});
```
虽然 Token 在 localStorage 中不会自动发送，但如果二开时改用 Cookie 认证就会触发 CSRF。

**修复方案**：

```javascript
// src/server.js
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : (process.env.NODE_ENV === 'production' 
      ? ['https://your-domain.com'] 
      : ['http://localhost:3000', 'http://localhost:8080']);

app.use(cors({
  origin: function (origin, callback) {
    // 允许无 origin 的请求（如移动端、Postman）
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('不允许的跨域来源'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 86400
}));
```

---

### 3.4 XSS 跨站脚本风险

**风险位置**：多处数据直接插入 DOM

例如 [app.js#L250-L259](file:///Users/wuzhijie/Documents/xiaohongshu/biaozhu/wzj/1/src/public/js/app.js#L250-L259)：
```javascript
document.getElementById('successDetail').innerHTML = `
  <div class="row"><span class="label">姓名</span><span class="value">${booking.passenger_name}</span></div>
  ...
`;
```

**问题描述**：用户输入的 `passenger_name`、`route` 等数据直接用 `innerHTML` 渲染，如果攻击者在姓名字段输入 `<img src=x onerror=alert(1)>`，管理端查看订单时就会执行恶意脚本。

**修复方案**：

**方案1：统一转义函数**
```javascript
// src/public/js/utils.js （新增）
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

// 所有使用模板字符串插入 innerHTML 的地方替换
`<div class="value">${escapeHtml(booking.passenger_name)}</div>`
```

**方案2：改用 textContent 渲染**（更安全，不支持HTML嵌套时推荐）
```javascript
// 例如渲染订单列表时，不用 join('') 的 innerHTML，而是 createElement
function renderBookingList(bookings) {
  const container = document.getElementById('bookingList');
  container.innerHTML = '';
  for (const b of bookings) {
    const card = document.createElement('div');
    card.className = 'card';
    const header = document.createElement('div');
    const routeEl = document.createElement('span');
    routeEl.className = 'booking-route';
    routeEl.textContent = b.route; // textContent 自动转义
    // ... 逐个创建子元素
  }
}
```

---

## 4. 🟡 中危漏洞及修复方案

### 4.1 敏感数据明文存储与展示

**风险位置**：
- 身份证号明文存储：[db/index.js](file:///Users/wuzhijie/Documents/xiaohongshu/biaozhu/wzj/1/src/db/index.js) 表结构
- 前端明文展示身份证：[app.js#L328](file:///Users/wuzhijie/Documents/xiaohongshu/biaozhu/wzj/1/src/public/js/app.js#L328)

**问题描述**：
- 身份证号属于受《个人信息保护法》严格保护的敏感个人信息
- 数据库一旦泄露，用户身份证号直接暴露
- 前端管理端完整展示身份证，有越权查看风险

**修复方案**：

**存储层面 - 身份证号加密存储**：
```bash
npm install crypto  # Node.js 内置，无需安装
```

```javascript
// src/utils/crypto.js （新增）
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const ENC_KEY = Buffer.from(process.env.DATA_ENC_KEY || crypto.randomBytes(32).toString('hex'), 'hex');
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENC_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(ciphertext) {
  if (!ciphertext || !ciphertext.includes(':')) return ciphertext;
  const [ivHex, tagHex, encHex] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENC_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
```

**展示层面 - 脱敏显示**：
```javascript
// 前后端通用脱敏函数
function maskIdCard(idCard) {
  if (!idCard || idCard.length < 10) return idCard;
  return idCard.substring(0, 4) + '**********' + idCard.substring(idCard.length - 4);
}
// 110101********1234

function maskPhone(phone) {
  if (!phone || phone.length < 11) return phone;
  return phone.substring(0, 3) + '****' + phone.substring(7);
}
// 138****8000
```

**后端返回数据时脱敏**：
```javascript
// 在 controller 返回前处理
bookings.forEach(b => {
  b.id_card = b.id_card ? maskIdCard(decrypt(b.id_card)) : '';
  b.passenger_phone = maskPhone(b.passenger_phone);
});
```

---

### 4.2 Token 无法主动撤销

**问题描述**：
当前 Token 是无状态的，一旦签发只能等 24 小时自动过期。管理员修改密码后，之前泄露的 Token 仍然有效。

**修复方案 - 增加 Token 黑名单（Redis 或 内存表）**：

```javascript
// src/middleware/tokenBlacklist.js
// 简单版：内存黑名单（单实例部署适用，多实例请用Redis）
const blacklist = new Set();

function addToBlacklist(token, expiresAt) {
  blacklist.add(token);
  // 过期后自动清理
  setTimeout(() => blacklist.delete(token), expiresAt - Date.now());
}

function isBlacklisted(token) {
  return blacklist.has(token);
}

// 登出接口
router.post('/logout', authMiddleware, (req, res) => {
  const token = req.headers.authorization.substring(7);
  addToBlacklist(token, req.adminUser.exp);
  res.json({ code: 0, message: '登出成功' });
});

// verifyToken 中增加黑名单检查
function verifyToken(token) {
  if (isBlacklisted(token)) return null;
  // ... 原有逻辑
}
```

---

### 4.3 缺少操作审计日志

**问题描述**：
管理员登录、派车、完成行程、取消订单等关键操作没有日志记录，出现问题无法追溯。

**修复方案**：

```javascript
// src/middleware/audit.js
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function writeAuditLog(action, username, ip, detail = {}) {
  const log = {
    time: new Date().toISOString(),
    action,
    username: username || 'anonymous',
    ip,
    detail,
  };
  const line = JSON.stringify(log) + '\n';
  const logFile = path.join(LOG_DIR, `audit-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFile(logFile, line, (err) => err && console.error('[AUDIT] 写入失败', err));
}

// 中间件：记录管理员操作
function auditMiddleware(actionName, getDetail = (req) => ({})) {
  return (req, res, next) => {
    const oldSend = res.json;
    res.json = function(data) {
      // 响应返回后记录日志（记录成功/失败）
      writeAuditLog(actionName, req.adminUser?.username, req.ip, {
        ...getDetail(req),
        result_code: data.code,
        result_msg: data.message
      });
      return oldSend.call(this, data);
    };
    next();
  };
}

module.exports = { auditMiddleware, writeAuditLog };
```

应用到关键路由：
```javascript
// src/routes/dispatch.js
const { auditMiddleware } = require('../middleware/audit');

router.post('/assign', 
  authMiddleware, 
  auditMiddleware('assign_bus', req => ({ 
    bus_id: req.body.bus_id, 
    schedule_id: req.body.schedule_id,
    travel_date: req.body.travel_date
  })),
  dispatchController.assignBus
);
```

---

### 4.4 无 HTTPS 强制与安全响应头

**修复方案 - 安装 helmet**：

```bash
npm install helmet
```

```javascript
// src/server.js
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'"], // 现有内联脚本需保留
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "https:"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  xssFilter: true,
  noSniff: true
}));

// 强制 HTTPS 跳转（生产环境）
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}
```

---

### 4.5 后端输入验证不足

**问题描述**：
前端有校验，但后端缺少二次验证。例如手机号格式、身份证号格式、姓名长度、日期格式等。

**修复方案 - 统一校验中间件**：

```javascript
// src/middleware/validator.js
const PHONE_REGEX = /^1[3-9]\d{9}$/;
const ID_CARD_REGEX = /(^\d{15}$)|(^\d{17}(\d|X|x)$)/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateBookingCreate(req, res, next) {
  const { passenger_name, passenger_phone, id_card, schedule_id, travel_date } = req.body;
  const errors = [];

  if (!passenger_name || passenger_name.length < 2 || passenger_name.length > 20) {
    errors.push('姓名字段必须2-20个字符');
  }
  if (!PHONE_REGEX.test(passenger_phone)) {
    errors.push('手机号格式不正确');
  }
  if (id_card && !ID_CARD_REGEX.test(id_card)) {
    errors.push('身份证号格式不正确');
  }
  if (!Number.isInteger(Number(schedule_id)) || schedule_id <= 0) {
    errors.push('班次ID无效');
  }
  if (!DATE_REGEX.test(travel_date)) {
    errors.push('日期格式不正确（YYYY-MM-DD）');
  } else {
    const d = new Date(travel_date);
    if (isNaN(d.getTime())) errors.push('日期无效');
  }

  if (errors.length > 0) {
    return res.json({ code: 400, message: errors[0] });
  }
  next();
}

module.exports = { validateBookingCreate };
```

---

## 5. 🔵 低危漏洞与安全加固建议

### 5.1 错误信息暴露

**问题**：
```javascript
console.error('[Booking] 创建预定失败:', error);
res.json({ code: 500, message: '预定失败' });
```
虽然 message 没泄露细节，但 console.error 会把完整错误栈打到 stdout，生产环境会被日志收集。

**修复**：区分开发/生产环境日志：
```javascript
if (process.env.NODE_ENV === 'development') {
  console.error('[Booking] 创建预定失败:', error);
} else {
  console.error('[Booking] 创建预定失败:', error.message, error.code); // 仅打摘要
}
```

### 5.2 缺少请求体大小限制

**修复**：
```javascript
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
```

### 5.3 SQLite 文件模式未加访问限制

如果使用文件 SQLite，确保 `.sqlite` 文件不被静态服务访问：
```javascript
// server.js 中，在 express.static 之前加
app.use((req, res, next) => {
  if (req.url.endsWith('.sqlite')) return res.status(403).end();
  next();
});
```

### 5.4 管理端 Token 存储位置

当前用 localStorage 存 Token，容易被 XSS 窃取。可改为：
- **HttpOnly Cookie**：更安全，但需处理 CSRF
- **sessionStorage**：至少关闭浏览器就清除，减少持久化泄露

### 5.5 目录遍历防护

虽然 Express 默认静态服务有保护，但建议显式加：
```javascript
// 防止 /.. 等路径遍历
app.use((req, res, next) => {
  if (req.path.includes('..')) return res.status(400).end();
  next();
});
```

---

## 6. 安全配置最佳实践

### 6.1 Nginx 反向代理配置示例

```nginx
server {
    listen 80;
    server_name bus.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bus.yourdomain.com;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 限流区
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;

    location /api/auth/login {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://127.0.0.1:3000;
    }

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
    }
}
```

### 6.2 推荐依赖升级

```bash
# 建议新增的安全依赖
npm install bcrypt express-rate-limit helmet express-validator

# 定期检查漏洞
npm audit
npm audit fix
```

---

## 7. 生产环境安全Checklist

上线前必须逐项确认：

### 🔴 必须完成
- [ ] **移除所有默认值**：`ADMIN_USER`、`ADMIN_PASS`、`AUTH_SECRET` 必须通过环境变量配置
- [ ] **密码哈希**：启用 bcrypt 存储，禁止明文
- [ ] **使用 MySQL**：生产环境禁用 SQLite
- [ ] **修改默认密钥**：`AUTH_SECRET` 至少32位随机字符
- [ ] **启用 HTTPS**：配置 TLS 证书，开启 HSTS
- [ ] **启用接口限流**：登录、预定等关键接口加 rate limit

### 🟠 强烈建议
- [ ] **超卖防护**：下单接口使用事务 + 行锁
- [ ] **输入校验**：所有写接口加后端参数校验
- [ ] **CORS 限制**：配置精确的允许域名
- [ ] **XSS 防护**：所有用户数据渲染加转义
- [ ] **敏感数据加密**：身份证号加密存储，展示脱敏
- [ ] **操作审计日志**：关键操作留痕

### 🟡 建议完成
- [ ] **Token 黑名单**：支持登出和强制下线
- [ ] **安全响应头**：配置 helmet
- [ ] **日志脱敏**：错误日志不泄露隐私
- [ ] **定期漏洞扫描**：`npm audit` 纳入 CI
- [ ] **IP 白名单**：管理端接口可加 IP 访问限制

### 🔵 锦上添花
- [ ] **管理端两步验证**：TOTP
- [ ] **统一登录错误提示**：不区分"用户不存在"还是"密码错误"
- [ ] **密码定期修改提醒**
- [ ] **异常登录告警**：新IP登录触发短信/邮件

---

## 附录：漏洞修复优先级路线图

| 阶段 | 时间 | 内容 | 目标 |
|------|------|------|------|
| **第一阶段** | 上线前1天 | 2.1/2.2/2.3 严重漏洞 + 3.1 限流 + 3.3 CORS | 杜绝"脚本小子"能攻破的漏洞 |
| **第二阶段** | 上线后1周内 | 3.2 超卖 + 3.4 XSS + 4.5 输入校验 + 4.1 加密存储 | 核心业务逻辑安全 |
| **第三阶段** | 上线后2周内 | 4.2 Token撤销 + 4.3 审计日志 + 4.4 安全头 | 完善运维可追溯能力 |
| **第四阶段** | 持续改进 | 5.x 加固项 + 两因素认证 + 异常监控 | 达到企业级安全标准 |

---

**文档结束**

安全是一个持续的过程，建议每月执行一次 `npm audit`，每季度进行一次全面代码审计。
