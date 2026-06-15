# 北京-张家口 班车预定系统

一个轻量级的班车预定和派车管理系统，支持 H5 移动端访问。

## 技术栈

### 后端
- **Node.js** - 运行环境
- **Express** - Web 框架（轻量级）
- **better-sqlite3** - 本地 SQLite 内存数据库（开发环境）
- **mysql2** - MySQL 数据库驱动（生产环境）
- **dotenv** - 环境变量配置

### 前端
- **HTML5 + CSS3 + 原生 JavaScript** - 无需构建工具，H5 友好
- 响应式设计，适配移动端

### 数据库
- **开发环境**: SQLite 内存模式（无需安装数据库，数据随进程消失）
- **生产环境**: MySQL

## 功能特性

### 用户端功能
- 🎫 **班次查询** - 按线路、日期查询可用班次
- 📝 **在线预定** - 填写乘客信息提交预定
- 📱 **订单查询** - 通过手机号查询个人订单
- ❌ **订单取消** - 未派车订单可取消
- 🎫 **座位分配** - 自动分配座位号

### 管理端功能
- 🚍 **待派车列表** - 按日期、线路筛选待派车订单
- 🚗 **车辆管理** - 查看车辆状态（空闲/运行中）
- 📋 **派车操作** - 批量分配车辆给同一班次的乘客
- ✅ **行程完成** - 完成行程后车辆恢复空闲状态
- 📊 **派车记录** - 查看历史派车记录

## 项目结构

```
├── src/
│   ├── server.js              # 服务入口
│   ├── db/
│   │   └── index.js           # 数据库抽象层（SQLite/MySQL 切换）
│   ├── controllers/
│   │   ├── booking.js         # 预定业务逻辑
│   │   └── dispatch.js        # 派车业务逻辑
│   ├── routes/
│   │   ├── booking.js         # 预定 API 路由
│   │   └── dispatch.js        # 派车 API 路由
│   └── public/                # H5 前端静态资源
│       ├── index.html         # 用户端页面
│       ├── admin.html         # 管理端页面
│       ├── css/
│       │   └── style.css      # 全局样式
│       └── js/
│           ├── app.js         # 用户端逻辑
│           └── admin.js       # 管理端逻辑
├── package.json
├── .env                       # 环境变量配置
└── README.md
```

## 快速开始

### 环境要求
- Node.js >= 14.x

### 安装依赖

```bash
npm install
```

### 本地开发（SQLite 内存数据库）

```bash
npm run dev
```

启动后访问：
- 用户端: http://localhost:3000
- 管理端: http://localhost:3000/admin

### 生产环境（MySQL）

1. 修改 `.env` 文件：
```env
NODE_ENV=production
DB_TYPE=mysql

MYSQL_HOST=your_host
MYSQL_PORT=3306
MYSQL_USER=your_user
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=bus_booking
```

2. 确保 MySQL 中已创建数据库：
```sql
CREATE DATABASE bus_booking DEFAULT CHARSET utf8mb4;
```

3. 启动服务：
```bash
npm run prod
```

## API 接口文档

### 预定相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/bookings/schedules` | 获取班次列表 |
| POST | `/api/bookings` | 创建预定 |
| GET | `/api/bookings` | 获取预定列表（支持 phone/date/status 筛选） |
| GET | `/api/bookings/:id` | 获取预定详情 |
| POST | `/api/bookings/:id/cancel` | 取消预定 |

### 派车相关

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dispatch/buses` | 获取车辆列表 |
| GET | `/api/dispatch/pending` | 获取待派车订单（按班次分组） |
| POST | `/api/dispatch/assign` | 分配车辆派车 |
| POST | `/api/dispatch/complete` | 完成行程 |
| GET | `/api/dispatch/trips` | 获取派车记录 |

### 健康检查

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 服务健康检查 |

## 数据库表结构

### buses（车辆表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| plate_number | VARCHAR(20) | 车牌号 |
| capacity | INT | 载客量 |
| driver_name | VARCHAR(50) | 司机姓名 |
| driver_phone | VARCHAR(20) | 司机电话 |
| status | VARCHAR(20) | 状态：idle/dispatched |
| created_at | DATETIME | 创建时间 |

### schedules（班次表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| route | VARCHAR(100) | 线路 |
| departure_time | VARCHAR(10) | 发车时间 |
| arrival_time | VARCHAR(10) | 到达时间 |
| price | DECIMAL(10,2) | 票价 |
| created_at | DATETIME | 创建时间 |

### bookings（预定表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| passenger_name | VARCHAR(50) | 乘客姓名 |
| passenger_phone | VARCHAR(20) | 乘客电话 |
| id_card | VARCHAR(20) | 身份证号 |
| schedule_id | INT | 班次ID |
| travel_date | DATE | 乘车日期 |
| seat_number | INT | 座位号 |
| status | VARCHAR(20) | 状态：pending/confirmed/dispatched/completed/cancelled |
| bus_id | INT | 车辆ID |
| created_at | DATETIME | 创建时间 |

## 初始数据

系统启动时会自动初始化以下数据：

### 班次
- 北京→张家口：07:00、09:00、11:00、14:00、17:00
- 张家口→北京：07:00、09:00、14:00

票价统一：¥80/人，车程约3.5小时

### 车辆
- 京A12345，张师傅，13800138001，45座
- 京A12346，李师傅，13800138002，45座
- 京A12347，王师傅，13800138003，45座

## 配置说明

### 环境变量 (.env)

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务端口 | 3000 |
| NODE_ENV | 运行环境 | development |
| DB_TYPE | 数据库类型 (sqlite/mysql) | sqlite |
| MYSQL_HOST | MySQL 主机 | localhost |
| MYSQL_PORT | MySQL 端口 | 3306 |
| MYSQL_USER | MySQL 用户名 | root |
| MYSQL_PASSWORD | MySQL 密码 | password |
| MYSQL_DATABASE | MySQL 数据库名 | bus_booking |

## H5 适配说明

- 移动端视口设置，禁止缩放
- 使用 rem 响应式布局
- 最大宽度 750px 居中显示
- 触摸优化，移除点击高亮
- 禁止电话号码自动识别
- 所有交互元素适配手指点击（最小 44px 高度）

## 数据流转

```
用户预定 → 生成订单（confirmed状态） → 管理端待派车列表
              ↑                           ↓
              |                        选择车辆派车
              |                           ↓
        取消订单（未派车）          订单状态变为 dispatched
                                          ↓
                                    完成行程
                                          ↓
                                    订单状态变为 completed
                                    车辆恢复 idle 状态
```

## 许可证

MIT
