# 班车预定系统 - 二次开发手册

> 版本：v1.0.0  
> 更新日期：2026-06-16  
> 适用范围：北京-张家口班车预定系统

---

## 目录

1. [系统架构概览](#1-系统架构概览)
2. [环境配置与部署](#2-环境配置与部署)
3. [数据库设计](#3-数据库设计)
4. [API 接口详细文档](#4-api-接口详细文档)
5. [认证与权限体系](#5-认证与权限体系)
6. [前端开发指南](#6-前端开发指南)
7. [后端扩展开发](#7-后端扩展开发)
8. [常见问题与最佳实践](#8-常见问题与最佳实践)

---

## 1. 系统架构概览

### 1.1 技术栈

| 层级 | 技术选型 | 版本要求 |
|------|----------|----------|
| 运行时 | Node.js | >= 14.x |
| Web框架 | Express | ^4.18.2 |
| 数据库（开发） | better-sqlite3 | ^9.2.2 |
| 数据库（生产） | mysql2 | ^3.6.5 |
| 配置管理 | dotenv | ^16.3.1 |
| 跨域支持 | cors | ^2.8.5 |
| 前端 | 原生 HTML/CSS/JS | - |

### 1.2 模块架构图

```
┌─────────────────────────────────────────────────────┐
│                    客户端 (H5/浏览器)                │
│  ┌──────────────┐          ┌──────────────────┐     │
│  │  用户端页面   │          │   管理端页面      │     │
│  │  index.html  │          │   admin.html     │     │
│  └──────┬───────┘          └────────┬─────────┘     │
└─────────┼───────────────────────────┼───────────────┘
          │                           │
          │  REST API (JSON)          │  REST API + Token
          ▼                           ▼
┌─────────────────────────────────────────────────────┐
│                    Express 服务层                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  auth 路由   │  │ booking 路由  │  │ dispatch   │  │
│  │  /api/auth  │  │ /api/bookings│  │  路由       │  │
│  └──────┬──────┘  └──────┬───────┘  │/api/dispatch│  │
│         │                │           └─────┬──────┘  │
└─────────┼────────────────┼─────────────────┼─────────┘
          │                │                 │
          ▼                ▼                 ▼
┌─────────────────────────────────────────────────────┐
│                  业务逻辑层 (Controllers)             │
│  ┌────────────────┐  ┌──────────────────────────┐    │
│  │ BookingController│  │   DispatchController    │    │
│  └────────┬───────┘  └───────────┬──────────────┘    │
└───────────┼──────────────────────┼───────────────────┘
            │                      │
            ▼                      ▼
┌─────────────────────────────────────────────────────┐
│              数据库抽象层 (DB Layer)                  │
│  ┌──────────────────┐    ┌──────────────────────┐   │
│  │   SQLite 驱动     │    │      MySQL 驱动       │   │
│  └──────────────────┘    └──────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 1.3 目录结构详解

```
src/
├── server.js                  # 服务入口文件，初始化Express、路由、静态资源
├── db/
│   └── index.js               # 数据库抽象层，支持SQLite和MySQL双引擎切换
├── middleware/
│   └── auth.js                # 认证中间件：Token生成、验证、权限校验
├── controllers/
│   ├── booking.js             # 预定业务控制器：班次查询、下单、取消、查询
│   └── dispatch.js            # 派车业务控制器：车辆管理、派车、行程完成
├── routes/
│   ├── auth.js                # 认证路由：管理员登录
│   ├── booking.js             # 预定路由：公开API + 可选认证API
│   └── dispatch.js            # 派车路由：全部需要管理员认证
└── public/                    # 前端静态资源（Express静态托管）
    ├── index.html             # 用户端H5页面
    ├── admin.html             # 管理端页面
    ├── css/
    │   └── style.css          # 全局样式
    └── js/
        ├── app.js             # 用户端业务逻辑
        ├── admin.js           # 管理端业务逻辑
        └── calendar.js        # 日期选择器组件
```

---

## 2. 环境配置与部署

### 2.1 环境变量说明

创建 `.env` 文件在项目根目录：

```env
# ===== 基础配置 =====
PORT=3000                                    # 服务监听端口
NODE_ENV=development                         # 运行环境：development / production

# ===== 数据库配置 =====
DB_TYPE=sqlite                               # 数据库类型：sqlite / mysql

# MySQL 配置（DB_TYPE=mysql 时必填）
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=bus_booking

# ===== 安全配置 =====
ADMIN_USER=admin                             # 管理员用户名
ADMIN_PASS=your_strong_password              # 管理员密码
AUTH_SECRET=your_very_long_secret_key_here   # Token签名密钥（生产环境必须修改）
```

### 2.2 启动命令

```bash
# 1. 安装依赖
npm install

# 2. 开发模式（SQLite内存数据库）
npm run dev

# 3. 生产模式（MySQL）
npm run prod

# 4. 通用启动
npm start
```

### 2.3 Docker 部署参考（可选）

可自行创建 Dockerfile：

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
COPY .env ./
EXPOSE 3000
CMD ["npm", "run", "prod"]
```

---

## 3. 数据库设计

### 3.1 表结构

#### 3.1.1 buses（车辆表）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 车辆ID |
| plate_number | VARCHAR(20) | NOT NULL, UNIQUE | 车牌号 |
| capacity | INT | NOT NULL, DEFAULT 45 | 载客量（座位数） |
| driver_name | VARCHAR(50) | NULLABLE | 司机姓名 |
| driver_phone | VARCHAR(20) | NULLABLE | 司机联系电话 |
| status | VARCHAR(20) | DEFAULT 'idle' | 状态：`idle`=空闲 / `dispatched`=运行中 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 3.1.2 schedules（班次表）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 班次ID |
| route | VARCHAR(100) | NOT NULL | 线路名称，如 "北京→张家口" |
| departure_time | VARCHAR(10) | NOT NULL | 发车时间，格式 "HH:mm" |
| arrival_time | VARCHAR(10) | NOT NULL | 到达时间，格式 "HH:mm" |
| price | DECIMAL(10,2) | NOT NULL, DEFAULT 80 | 票价（元） |
| total_seats | INT | NOT NULL, DEFAULT 45 | 总座位数 |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |

#### 3.1.3 bookings（预定表）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | 订单ID |
| passenger_name | VARCHAR(50) | NOT NULL | 乘客姓名 |
| passenger_phone | VARCHAR(20) | NOT NULL | 乘客手机号（用于身份识别） |
| id_card | VARCHAR(20) | NULLABLE | 身份证号（选填） |
| schedule_id | INT | NOT NULL, FOREIGN KEY | 关联班次ID |
| travel_date | DATE | NOT NULL | 乘车日期 "YYYY-MM-DD" |
| seat_number | INT | NULLABLE | 座位号 |
| status | VARCHAR(20) | DEFAULT 'pending' | 订单状态（见下方枚举） |
| bus_id | INT | NULLABLE, FOREIGN KEY | 关联车辆ID（派车后赋值） |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP | 下单时间 |

### 3.2 订单状态流转

```
   下单
    ↓
 pending ──→ confirmed ──→ dispatched ──→ completed
                │              │
                └──────────────┴──→ cancelled
                        ↑
                    （派车前可取消）
```

| 状态值 | 中文说明 | 可操作 |
|--------|----------|--------|
| pending | 待处理 | 确认/取消 |
| confirmed | 已确认 | 派车/取消（派车前） |
| dispatched | 已派车 | 完成行程 |
| completed | 已完成 | - |
| cancelled | 已取消 | - |

### 3.3 数据库扩展建议

如需新增功能，推荐增加以下表：

- `admins` 表：替代硬编码的管理员账号，支持多管理员
- `payments` 表：对接支付系统时记录支付流水
- `refunds` 表：退款记录表
- `audit_logs` 表：操作审计日志
- `stations` 表：站点信息表（上下车点）

---

## 4. API 接口详细文档

### 4.1 统一响应格式

所有接口统一返回 JSON 格式：

```json
{
  "code": 0,           // 业务状态码：0=成功，非0=失败
  "message": "ok",     // 提示信息
  "data": {}           // 业务数据（可能是对象、数组、null）
}
```

**业务状态码约定：**

| code | 含义 |
|------|------|
| 0 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未登录或登录过期 |
| 403 | 无权限访问 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

### 4.2 健康检查接口（公开）

#### GET /api/health

获取服务运行状态。

**响应示例：**
```json
{
  "code": 0,
  "message": "ok",
  "env": "production",
  "db": "mysql"
}
```

---

### 4.3 认证接口（公开）

#### POST /api/auth/login

管理员登录，获取访问令牌。

**请求体：**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 管理员用户名 |
| password | string | 是 | 管理员密码 |

**成功响应：**
```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "token": "eyJ1c2VybmFtZSI6...（Base64Payload.HexSignature）",
    "username": "admin"
  }
}
```

**失败响应：**
```json
{
  "code": 401,
  "message": "用户名或密码错误"
}
```

---

### 4.4 班次查询接口（公开）

#### GET /api/bookings/schedules

获取班次列表，可附带查询指定日期的余票信息。

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| route | string | 否 | 线路过滤，如 "北京→张家口" |
| date | string | 否 | 乘车日期 "YYYY-MM-DD"，传了会计算余票 |

**请求示例：**
```
GET /api/bookings/schedules?route=北京→张家口&date=2026-06-20
```

**成功响应：**
```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "route": "北京→张家口",
      "departure_time": "07:00",
      "arrival_time": "10:30",
      "price": 80,
      "total_seats": 45,
      "created_at": "2026-06-16T00:00:00.000Z",
      "booked_count": 12,        // 仅传了 date 时返回
      "remaining_seats": 33,     // 仅传了 date 时返回
      "is_full": false           // 仅传了 date 时返回
    }
  ]
}
```

---

### 4.5 创建预定接口（公开）

#### POST /api/bookings

用户提交预定订单。

**请求体：**
```json
{
  "passenger_name": "张三",
  "passenger_phone": "13800138000",
  "id_card": "110101199001011234",
  "schedule_id": 1,
  "travel_date": "2026-06-20"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| passenger_name | string | 是 | 乘客姓名 |
| passenger_phone | string | 是 | 手机号（11位） |
| id_card | string | 否 | 身份证号 |
| schedule_id | number | 是 | 班次ID |
| travel_date | string | 是 | 乘车日期 "YYYY-MM-DD" |

**成功响应（code=0）：**
- `data` 返回完整的订单信息，包含关联的班次信息（线路、时间、票价）

**可能的错误：**
- `400` 请填写完整信息
- `400` 班次不存在
- `400` 该班次已满员，请选择其他班次

---

### 4.6 查询订单列表（公开 + 可选管理员权限）

#### GET /api/bookings

查询订单列表。

- **普通用户**：必须传 `phone` 参数，只能看自己的订单
- **管理员**：带有效 Token 时，不传 `phone` 可看全部订单

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phone | string | 用户必填 | 乘客手机号 |
| date | string | 否 | 乘车日期过滤 |
| status | string | 否 | 订单状态过滤 |

**管理员调用示例（带Token）：**
```
GET /api/bookings?date=2026-06-20&status=confirmed
Authorization: Bearer <token>
```

**成功响应：**
- `data` 为订单数组，每条订单包含：订单信息 + 班次信息 + （派车后）车辆司机信息

---

### 4.7 查询订单详情（公开 + 可选管理员权限）

#### GET /api/bookings/:id

获取单条订单详情。

- **普通用户**：必须传 `phone` query 参数，且手机号必须匹配
- **管理员**：带有效 Token 时无需传 phone

**路径参数：**
- `id`：订单ID

**Query 参数：**
- `phone`：普通用户必填，手机号

**可能的错误：**
- `404` 订单不存在
- `403` 无权查看该订单

---

### 4.8 取消订单（公开 + 可选管理员权限）

#### POST /api/bookings/:id/cancel

取消未派车的订单。

- **普通用户**：body 中必须传 `phone`，且手机号匹配
- **管理员**：带有效 Token 时无需传 phone

**请求体（普通用户）：**
```json
{
  "phone": "13800138000"
}
```

**可能的错误：**
- `404` 订单不存在
- `403` 无权取消该订单
- `400` 已派车订单不能取消

---

### 4.9 获取车辆列表（需管理员登录）

#### GET /api/dispatch/buses

获取所有车辆，可按状态过滤。

**请求头要求：**
```
Authorization: Bearer <admin_token>
```

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 状态过滤：idle / dispatched |

**响应 data 字段说明：**
- 见 `buses` 表结构

---

### 4.10 获取待派车订单（需管理员登录）

#### GET /api/dispatch/pending

获取所有已确认但未派车的订单，按 `日期+班次` 自动分组。

**Query 参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| date | string | 否 | 日期过滤 |
| route | string | 否 | 线路过滤 |

**响应示例：**
```json
{
  "code": 0,
  "data": [
    {
      "date": "2026-06-20",
      "schedule_id": 1,
      "route": "北京→张家口",
      "departure_time": "07:00",
      "arrival_time": "10:30",
      "price": 80,
      "bookings": [
        { "id": 101, "passenger_name": "张三", "...": "..." },
        { "id": 102, "passenger_name": "李四", "...": "..." }
      ],
      "totalPassengers": 2
    }
  ]
}
```

---

### 4.11 指派车辆派车（需管理员登录）

#### POST /api/dispatch/assign

将某日期某班次的所有已确认订单批量分配给一辆车。

**请求体：**
```json
{
  "bus_id": 1,
  "schedule_id": 1,
  "travel_date": "2026-06-20"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bus_id | number | 是 | 车辆ID（必须是idle状态） |
| schedule_id | number | 是 | 班次ID |
| travel_date | string | 是 | 乘车日期 |

**业务校验逻辑：**
1. 车辆必须存在
2. 车辆必须是 `idle` 状态
3. 该班次+日期下必须有待派车的订单
4. 待派车人数不能超过车辆容量

**成功后副作用：**
- 车辆状态 → `dispatched`
- 匹配的订单状态 → `dispatched`
- 订单 `bus_id` 字段被赋值

**可能的错误：**
- `400` 参数不完整
- `404` 车辆不存在
- `400` 车辆当前不可用
- `400` 没有需要派车的订单
- `400` 车辆容量不足

---

### 4.12 完成行程（需管理员登录）

#### POST /api/dispatch/complete

车辆完成行程后，恢复车辆空闲状态，订单标记完成。

**请求体：**
```json
{
  "bus_id": 1
}
```

**成功后副作用：**
- 该车辆状态 → `idle`
- 该车辆所有 `dispatched` 状态的订单 → `completed`

---

### 4.13 获取派车记录（需管理员登录）

#### GET /api/dispatch/trips

获取历史派车记录，按车辆+日期+班次分组。

**响应 data 字段：**

| 字段 | 说明 |
|------|------|
| bus_id | 车辆ID |
| plate_number | 车牌号 |
| driver_name | 司机姓名 |
| driver_phone | 司机电话 |
| travel_date | 乘车日期 |
| route | 线路 |
| departure_time | 发车时间 |
| arrival_time | 到达时间 |
| passenger_count | 乘客数量 |
| status | 状态（dispatched/completed） |

---

## 5. 认证与权限体系

### 5.1 Token 机制说明

系统采用自定义的 **HMAC-SHA256 签名 Token**，结构类似 JWT 但更轻量：

```
Token = Base64UrlEncode(PayloadJSON) + "." + Hex(HMAC-SHA256(PayloadJSON, SECRET))
```

**Payload 结构：**
```json
{
  "username": "admin",
  "iat": 1718500000000,    // 签发时间戳（毫秒）
  "exp": 1718586400000     // 过期时间戳（默认24小时后）
}
```

### 5.2 认证中间件使用方式

在路由文件中使用：

```javascript
const { authMiddleware, verifyToken, generateToken } = require('../middleware/auth');

// 方式1：强制需要管理员登录
router.get('/admin-only', authMiddleware, (req, res) => {
  console.log(req.adminUser); // { username, iat, exp }
  res.json({ code: 0 });
});

// 方式2：可选认证（有Token就解析，没有也放行）
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (payload) req.adminUser = payload;
  }
  next();
}
```

### 5.3 前端调用方式

管理端使用 `localStorage` 存储 Token，所有管理接口请求带上 Header：

```javascript
// 前端封装参考（见 src/public/js/admin.js）
function authenticatedFetch(url, options = {}) {
  const token = localStorage.getItem('adminToken');
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}
```

### 5.4 权限扩展建议

如需细粒度权限控制，建议：

1. 新建 `admins` 表，字段：`id, username, password_hash, role, created_at`
2. Payload 中增加 `role` 字段（如 `super_admin` / `operator` / `viewer`）
3. 新增 `requireRole(role)` 中间件做路由级权限检查

---

## 6. 前端开发指南

### 6.1 用户端核心文件

| 文件 | 职责 |
|------|------|
| [index.html](file:///Users/wuzhijie/Documents/xiaohongshu/biaozhu/wzj/1/src/public/index.html) | 页面结构：订票Tab + 我的订单Tab |
| [app.js](file:///Users/wuzhijie/Documents/xiaohongshu/biaozhu/wzj/1/src/public/js/app.js) | 核心逻辑：班次加载、预定提交、订单查询/取消 |
| [calendar.js](file:///Users/wuzhijie/Documents/xiaohongshu/biaozhu/wzj/1/src/public/js/calendar.js) | 通用日期选择器组件 |
| [style.css](file:///Users/wuzhijie/Documents/xiaohongshu/biaozhu/wzj/1/src/public/css/style.css) | 全局样式 |

### 6.2 管理端核心文件

| 文件 | 职责 |
|------|------|
| [admin.html](file:///Users/wuzhijie/Documents/xiaohongshu/biaozhu/wzj/1/src/public/admin.html) | 管理端结构：登录 + 3个Tab（待派车/派车记录/车辆） |
| [admin.js](file:///Users/wuzhijie/Documents/xiaohongshu/biaozhu/wzj/1/src/public/js/admin.js) | 管理端逻辑：登录、派车、完成行程等 |

### 6.3 前端公共常量

```javascript
// 订单状态映射（两端共用）
const statusMap = {
  pending: { text: '待处理', class: 'status-pending' },
  confirmed: { text: '已确认', class: 'status-confirmed' },
  dispatched: { text: '已派车', class: 'status-dispatched' },
  completed: { text: '已完成', class: 'status-completed' },
  cancelled: { text: '已取消', class: 'status-cancelled' }
};
```

### 6.4 日期选择器组件用法

```javascript
// 初始化（见 calendar.js 的 initDatePicker）
const datePicker = initDatePicker('wrapId', 'hiddenInputId', 'displayId', {
  placeholder: '请选择日期',
  minToday: true,        // true=禁止选今天之前
  onChange: function(dateStr) {
    console.log('选中了:', dateStr);
  }
});

// API
datePicker.setValue('2026-06-20');   // 设值
datePicker.getValue();               // 取值
```

### 6.5 前端改造建议

如果二开需要改造前端，建议：

- **小型修改**：直接编辑现有 `index.html` / `app.js`
- **大型重构**：考虑引入 Vue3 / React + Vite 构建，但需要修改 `server.js` 增加构建产物托管
- **样式主题**：所有颜色、间距集中在 `style.css` 顶部，可快速替换品牌色

---

## 7. 后端扩展开发

### 7.1 新增 API 路由（标准流程）

以新增「班次管理」接口为例：

**步骤1：创建 Controller**

```javascript
// src/controllers/schedule.js
const db = require('../db');

class ScheduleController {
  async create(req, res) {
    try {
      const { route, departure_time, arrival_time, price, total_seats } = req.body;
      // TODO: 参数校验
      const result = await db.query(
        'INSERT INTO schedules (route, departure_time, arrival_time, price, total_seats) VALUES (?, ?, ?, ?, ?)',
        [route, departure_time, arrival_time, price, total_seats || 45]
      );
      res.json({ code: 0, data: { id: result[0].insertId }, message: '创建成功' });
    } catch (e) {
      console.error(e);
      res.json({ code: 500, message: '创建失败' });
    }
  }
}

module.exports = new ScheduleController();
```

**步骤2：创建路由文件**

```javascript
// src/routes/schedule.js
const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/schedule');
const { authMiddleware } = require('../middleware/auth');

router.post('/', authMiddleware, scheduleController.create);
router.put('/:id', authMiddleware, scheduleController.update);
router.delete('/:id', authMiddleware, scheduleController.delete);

module.exports = router;
```

**步骤3：在 server.js 注册路由**

```javascript
// 在 server.js 第16-18行附近添加：
app.use('/api/schedules', require('./routes/schedule'));
```

### 7.2 数据库操作规范

所有 SQL 操作必须走 `db.query(sql, params)`，**禁止字符串拼接 SQL**：

```javascript
// ✅ 正确（参数绑定，防SQL注入）
const user = await db.query('SELECT * FROM bookings WHERE phone = ?', [phone]);

// ❌ 错误（SQL注入风险）
const user = await db.query(`SELECT * FROM bookings WHERE phone = '${phone}'`);
```

`db.query` 返回值约定：
- `SELECT`：返回匹配行的数组（即使只有一条也返回 `[{...}]`）
- `INSERT/UPDATE/DELETE`：返回 `[{ insertId, affectedRows }]`

### 7.3 新增数据库表

如需新增表，在 [db/index.js](file:///Users/wuzhijie/Documents/xiaohongshu/biaozhu/wzj/1/src/db/index.js) 的 `createTablesSQLite` 和 `createTablesMySQL` 方法中同步添加建表 SQL。

**注意：两个方法的 SQL 必须同步维护，且注意类型差异（SQLite 与 MySQL 数据类型不完全一致）。**

### 7.4 错误处理最佳实践

```javascript
async someMethod(req, res) {
  try {
    // 1. 参数校验
    if (!req.body.required_field) {
      return res.json({ code: 400, message: '缺少必填字段' });
    }

    // 2. 业务逻辑
    const result = await db.query('...');

    // 3. 返回成功
    res.json({ code: 0, data: result });
  } catch (error) {
    // 4. 统一错误处理：记录日志 + 返回500
    console.error('[模块名] 操作失败:', error);
    res.json({ code: 500, message: '服务器内部错误' });
  }
}
```

---

## 8. 常见问题与最佳实践

### 8.1 生产环境检查清单

- [ ] 修改 `.env` 中 `AUTH_SECRET` 为强随机字符串（至少32位）
- [ ] 修改管理员密码（`ADMIN_PASS`），禁止使用默认值
- [ ] `NODE_ENV=production`
- [ ] `DB_TYPE=mysql`，SQLite 仅用于开发
- [ ] MySQL 用户权限最小化，仅授予 SELECT/INSERT/UPDATE/DELETE
- [ ] 配置 HTTPS（Nginx / Caddy 反向代理）
- [ ] 配置防火墙，仅开放必要端口
- [ ] 开启 MySQL 慢查询日志监控

### 8.2 SQLite 切换到 MySQL 的注意事项

1. SQLite 默认大小写不敏感，MySQL 视 collation 而定
2. SQLite 的 `AUTOINCREMENT` vs MySQL 的 `AUTO_INCREMENT`
3. 日期处理：SQLite 存 TEXT，MySQL 有原生 DATE/DATETIME 类型
4. 事务支持：如需事务，要分别适配两个驱动的 API

### 8.3 性能优化建议

- **余票计算缓存**：当前 `getSchedules` 每个班次单独 COUNT，可改为 GROUP BY 一次性查询
- **索引优化**：`bookings(schedule_id, travel_date, status)` 建联合索引
- **接口限流**：登录接口、预定接口应加限流（防止恶意刷接口）
- **分页支持**：订单列表接口建议增加 `page` / `pageSize` 参数

### 8.4 常见扩展需求

| 需求 | 推荐改动点 |
|------|-----------|
| 增加微信支付 | 新增 `payments` 表 + `/api/pay/*` 路由 + 支付回调 |
| 多管理员账号 | 新增 `admins` 表 + 改造 `auth.js` |
| 短信通知 | 在 `createBooking` / `assignBus` 成功后调用短信SDK |
| 多线路配置 | 班次表已有 `route` 字段，前端改为动态读取 |
| 座位选号 | 新增 `seats` 表 + 座位锁定逻辑 + 前端座位图 |
| 优惠券 | 新增 `coupons` / `user_coupons` 表 + 下单时核销 |

### 8.5 数据备份建议

- **MySQL**：定时使用 `mysqldump` 全量备份，binlog 增量备份
- **SQLite**：不要用于生产！硬要用就配合 `.backup` API 定时拷贝

---

## 附录：接口速查表

| # | 方法 | 路径 | 认证 | 说明 |
|---|------|------|------|------|
| 1 | GET | `/api/health` | 否 | 健康检查 |
| 2 | POST | `/api/auth/login` | 否 | 管理员登录 |
| 3 | GET | `/api/bookings/schedules` | 否 | 班次列表（支持余票计算） |
| 4 | POST | `/api/bookings` | 否 | 创建预定 |
| 5 | GET | `/api/bookings` | 可选 | 订单列表（用户需phone，管理员看全部） |
| 6 | GET | `/api/bookings/:id` | 可选 | 订单详情 |
| 7 | POST | `/api/bookings/:id/cancel` | 可选 | 取消订单 |
| 8 | GET | `/api/dispatch/buses` | 是 | 车辆列表 |
| 9 | GET | `/api/dispatch/pending` | 是 | 待派车订单（分组） |
| 10 | POST | `/api/dispatch/assign` | 是 | 批量派车 |
| 11 | POST | `/api/dispatch/complete` | 是 | 完成行程 |
| 12 | GET | `/api/dispatch/trips` | 是 | 派车记录 |

---

**文档结束**  
如有问题请基于源码调试，关键代码位置已在文档中给出链接。
