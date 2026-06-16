const TestHelper = require('./helpers/testHelper');
const dispatchService = require('../src/services/DispatchService');

describe('DispatchService 订单派车逻辑单元测试', () => {
  let testSchedule;
  let testBus;

  beforeEach(async () => {
    const schedules = await TestHelper.getSchedules();
    testSchedule = schedules[0];
    const buses = await TestHelper.getBuses();
    testBus = buses[0];
  });

  describe('assignBus - 核心派车逻辑', () => {
    describe('参数校验', () => {
      test('缺少 bus_id 应返回参数不完整错误', async () => {
        const result = await dispatchService.assignBus(null, testSchedule.id, TestHelper.testDate);

        expect(result.success).toBe(false);
        expect(result.code).toBe(400);
        expect(result.message).toBe('参数不完整');
      });

      test('缺少 schedule_id 应返回参数不完整错误', async () => {
        const result = await dispatchService.assignBus(testBus.id, null, TestHelper.testDate);

        expect(result.success).toBe(false);
        expect(result.code).toBe(400);
        expect(result.message).toBe('参数不完整');
      });

      test('缺少 travel_date 应返回参数不完整错误', async () => {
        const result = await dispatchService.assignBus(testBus.id, testSchedule.id, null);

        expect(result.success).toBe(false);
        expect(result.code).toBe(400);
        expect(result.message).toBe('参数不完整');
      });

      test('所有参数为空应返回参数不完整错误', async () => {
        const result = await dispatchService.assignBus('', '', '');

        expect(result.success).toBe(false);
        expect(result.code).toBe(400);
        expect(result.message).toBe('参数不完整');
      });
    });

    describe('车辆存在性校验', () => {
      test('车辆不存在应返回 404 错误', async () => {
        await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);
        const nonExistentBusId = 9999;

        const result = await dispatchService.assignBus(
          nonExistentBusId,
          testSchedule.id,
          TestHelper.testDate
        );

        expect(result.success).toBe(false);
        expect(result.code).toBe(404);
        expect(result.message).toBe('车辆不存在');
      });

      test('车辆存在但 ID 为 0 应返回 404 错误', async () => {
        await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);

        const result = await dispatchService.assignBus(0, testSchedule.id, TestHelper.testDate);

        expect(result.success).toBe(false);
        expect(result.code).toBe(404);
        expect(result.message).toBe('车辆不存在');
      });
    });

    describe('车辆可用性校验', () => {
      test('车辆状态为 dispatched 时不可派车', async () => {
        await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);
        const busyBus = await TestHelper.createBus({ status: 'dispatched' });

        const result = await dispatchService.assignBus(
          busyBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        expect(result.success).toBe(false);
        expect(result.code).toBe(400);
        expect(result.message).toBe('车辆当前不可用');
      });

      test('车辆状态为 maintenance 时不可派车', async () => {
        await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);
        const maintenanceBus = await TestHelper.createBus({ status: 'maintenance' });

        const result = await dispatchService.assignBus(
          maintenanceBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        expect(result.success).toBe(false);
        expect(result.code).toBe(400);
        expect(result.message).toBe('车辆当前不可用');
      });

      test('车辆状态为 idle 时可以派车', async () => {
        await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);
        const idleBus = await TestHelper.createBus({ status: 'idle' });

        const result = await dispatchService.assignBus(
          idleBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        expect(result.success).toBe(true);
      });
    });

    describe('订单存在性校验', () => {
      test('没有待派车订单时应返回错误', async () => {
        const result = await dispatchService.assignBus(
          testBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        expect(result.success).toBe(false);
        expect(result.code).toBe(400);
        expect(result.message).toBe('没有需要派车的订单');
      });

      test('只有待处理(pending)订单时应返回没有待派车订单错误', async () => {
        await TestHelper.createPendingBooking(testSchedule.id, TestHelper.testDate);

        const result = await dispatchService.assignBus(
          testBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        expect(result.success).toBe(false);
        expect(result.code).toBe(400);
        expect(result.message).toBe('没有需要派车的订单');
      });

      test('只有已取消(cancelled)订单时应返回没有待派车订单错误', async () => {
        await TestHelper.createCancelledBooking(testSchedule.id, TestHelper.testDate);

        const result = await dispatchService.assignBus(
          testBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        expect(result.success).toBe(false);
        expect(result.code).toBe(400);
        expect(result.message).toBe('没有需要派车的订单');
      });

      test('只有已派车(dispatched)订单时应返回没有待派车订单错误', async () => {
        await TestHelper.createDispatchedBooking(testSchedule.id, TestHelper.testDate, testBus.id);

        const result = await dispatchService.assignBus(
          testBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        expect(result.success).toBe(false);
        expect(result.code).toBe(400);
        expect(result.message).toBe('没有需要派车的订单');
      });

      test('混合状态订单时只统计 confirmed 状态订单', async () => {
        await TestHelper.createPendingBooking(testSchedule.id, TestHelper.testDate);
        await TestHelper.createCancelledBooking(testSchedule.id, TestHelper.testDate);
        const confirmedBookings = await TestHelper.createMultipleBookings(
          testSchedule.id,
          TestHelper.testDate,
          2,
          'confirmed'
        );

        const result = await dispatchService.assignBus(
          testBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        expect(result.success).toBe(true);
        expect(result.data.passenger_count).toBe(2);
      });
    });

    describe('车辆容量校验', () => {
      test('乘客数量等于车辆容量时可以派车', async () => {
        const smallBus = await TestHelper.createBus({ capacity: 3 });
        await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);

        const result = await dispatchService.assignBus(
          smallBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        expect(result.success).toBe(true);
        expect(result.data.passenger_count).toBe(3);
      });

      test('乘客数量超过车辆容量时应返回容量不足错误', async () => {
        const smallBus = await TestHelper.createBus({ capacity: 2 });
        await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);

        const result = await dispatchService.assignBus(
          smallBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        expect(result.success).toBe(false);
        expect(result.code).toBe(400);
        expect(result.message).toContain('车辆容量不足');
        expect(result.message).toContain('当前有3位乘客');
        expect(result.message).toContain('车辆容量2');
      });

      test('乘客数量远小于车辆容量时可以正常派车', async () => {
        const largeBus = await TestHelper.createBus({ capacity: 50 });
        await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);

        const result = await dispatchService.assignBus(
          largeBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        expect(result.success).toBe(true);
        expect(result.data.passenger_count).toBe(3);
      });
    });

    describe('派车成功流程', () => {
      test('正常派车应更新车辆状态为 dispatched', async () => {
        await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);

        const result = await dispatchService.assignBus(
          testBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        const updatedBus = await TestHelper.getBusById(testBus.id);
        expect(updatedBus.status).toBe('dispatched');
      });

      test('正常派车应更新订单状态为 dispatched 并关联 bus_id', async () => {
        const bookings = await TestHelper.createMultipleBookings(
          testSchedule.id,
          TestHelper.testDate,
          3
        );

        const result = await dispatchService.assignBus(
          testBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        for (const booking of bookings) {
          const updatedBooking = await TestHelper.getBookingById(booking.id);
          expect(updatedBooking.status).toBe('dispatched');
          expect(updatedBooking.bus_id).toBe(testBus.id);
        }
      });

      test('派车成功应返回正确的响应结构', async () => {
        await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);

        const result = await dispatchService.assignBus(
          testBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain('派车成功');
        expect(result.message).toContain('共3位乘客');
        expect(result.data).toBeDefined();
        expect(result.data.bus).toBeDefined();
        expect(result.data.bus.id).toBe(testBus.id);
        expect(result.data.passenger_count).toBe(3);
      });

      test('单个订单派车应正确处理', async () => {
        const singleBooking = await TestHelper.createBooking(testSchedule.id, TestHelper.testDate);

        const result = await dispatchService.assignBus(
          testBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        expect(result.success).toBe(true);
        expect(result.data.passenger_count).toBe(1);

        const updatedBooking = await TestHelper.getBookingById(singleBooking.id);
        expect(updatedBooking.status).toBe('dispatched');
        expect(updatedBooking.bus_id).toBe(testBus.id);
      });

      test('批量订单派车应正确更新所有订单', async () => {
        const bookings = await TestHelper.createMultipleBookings(
          testSchedule.id,
          TestHelper.testDate,
          10
        );

        const result = await dispatchService.assignBus(
          testBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        expect(result.data.passenger_count).toBe(10);

        for (const booking of bookings) {
          const updated = await TestHelper.getBookingById(booking.id);
          expect(updated.status).toBe('dispatched');
          expect(updated.bus_id).toBe(testBus.id);
        }
      });

      test('派车后不影响其他班次的订单', async () => {
        const schedule2 = (await TestHelper.getSchedules())[1];
        await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);
        const otherBookings = await TestHelper.createMultipleBookings(
          schedule2.id,
          TestHelper.testDate,
          2
        );

        const result = await dispatchService.assignBus(
          testBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        for (const booking of otherBookings) {
          const updated = await TestHelper.getBookingById(booking.id);
          expect(updated.status).toBe('confirmed');
          expect(updated.bus_id).toBeNull();
        }
      });

      test('派车后不影响其他日期的订单', async () => {
        await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);
        const otherDateBookings = await TestHelper.createMultipleBookings(
          testSchedule.id,
          TestHelper.testDate2,
          2
        );

        const result = await dispatchService.assignBus(
          testBus.id,
          testSchedule.id,
          TestHelper.testDate
        );

        for (const booking of otherDateBookings) {
          const updated = await TestHelper.getBookingById(booking.id);
          expect(updated.status).toBe('confirmed');
          expect(updated.bus_id).toBeNull();
        }
      });
    });
  });

  describe('completeTrip - 行程完成逻辑', () => {
    describe('参数校验', () => {
      test('缺少 bus_id 应返回参数不完整错误', async () => {
        const result = await dispatchService.completeTrip(null);

        expect(result.success).toBe(false);
        expect(result.code).toBe(400);
        expect(result.message).toBe('参数不完整');
      });

      test('bus_id 为空字符串应返回参数不完整错误', async () => {
        const result = await dispatchService.completeTrip('');

        expect(result.success).toBe(false);
        expect(result.code).toBe(400);
        expect(result.message).toBe('参数不完整');
      });
    });

    describe('车辆存在性校验', () => {
      test('车辆不存在应返回 404 错误', async () => {
        const result = await dispatchService.completeTrip(9999);

        expect(result.success).toBe(false);
        expect(result.code).toBe(404);
        expect(result.message).toBe('车辆不存在');
      });
    });

    describe('完成行程流程', () => {
      test('完成行程应将车辆状态恢复为 idle', async () => {
        await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);
        await dispatchService.assignBus(testBus.id, testSchedule.id, TestHelper.testDate);

        const busyBus = await TestHelper.getBusById(testBus.id);
        expect(busyBus.status).toBe('dispatched');

        const result = await dispatchService.completeTrip(testBus.id);

        const updatedBus = await TestHelper.getBusById(testBus.id);
        expect(updatedBus.status).toBe('idle');
      });

      test('完成行程应将相关订单状态更新为 completed', async () => {
        const bookings = await TestHelper.createMultipleBookings(
          testSchedule.id,
          TestHelper.testDate,
          3
        );
        await dispatchService.assignBus(testBus.id, testSchedule.id, TestHelper.testDate);

        const result = await dispatchService.completeTrip(testBus.id);

        for (const booking of bookings) {
          const updatedBooking = await TestHelper.getBookingById(booking.id);
          expect(updatedBooking.status).toBe('completed');
        }
      });

      test('完成行程应返回成功消息', async () => {
        await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);
        await dispatchService.assignBus(testBus.id, testSchedule.id, TestHelper.testDate);

        const result = await dispatchService.completeTrip(testBus.id);

        expect(result.success).toBe(true);
        expect(result.message).toBe('行程已完成，车辆已恢复空闲状态');
      });

      test('完成行程不影响其他车辆的订单', async () => {
        const bus2 = (await TestHelper.getBuses())[1];
        const schedule2 = (await TestHelper.getSchedules())[1];

        const bookings1 = await TestHelper.createMultipleBookings(
          testSchedule.id,
          TestHelper.testDate,
          2
        );
        const bookings2 = await TestHelper.createMultipleBookings(
          schedule2.id,
          TestHelper.testDate,
          2
        );

        await dispatchService.assignBus(testBus.id, testSchedule.id, TestHelper.testDate);
        await dispatchService.assignBus(bus2.id, schedule2.id, TestHelper.testDate);

        const result = await dispatchService.completeTrip(testBus.id);

        for (const booking of bookings1) {
          const updated = await TestHelper.getBookingById(booking.id);
          expect(updated.status).toBe('completed');
        }

        for (const booking of bookings2) {
          const updated = await TestHelper.getBookingById(booking.id);
          expect(updated.status).toBe('dispatched');
        }

        const bus2After = await TestHelper.getBusById(bus2.id);
        expect(bus2After.status).toBe('dispatched');
      });

      test('已完成行程的车辆可以再次被派车', async () => {
        const schedule2 = (await TestHelper.getSchedules())[1];

        await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 2);
        await dispatchService.assignBus(testBus.id, testSchedule.id, TestHelper.testDate);
        await dispatchService.completeTrip(testBus.id);

        const busAfterComplete = await TestHelper.getBusById(testBus.id);
        expect(busAfterComplete.status).toBe('idle');

        await TestHelper.createMultipleBookings(schedule2.id, TestHelper.testDate2, 3);
        const secondDispatchResult = await dispatchService.assignBus(
          testBus.id,
          schedule2.id,
          TestHelper.testDate2
        );

        expect(secondDispatchResult.success).toBe(true);
        expect(secondDispatchResult.data.passenger_count).toBe(3);

        const busAfterSecondDispatch = await TestHelper.getBusById(testBus.id);
        expect(busAfterSecondDispatch.status).toBe('dispatched');
      });
    });
  });

  describe('getPendingBookings - 获取待派车订单', () => {
    test('没有待派车订单时应返回空数组', async () => {
      const result = await dispatchService.getPendingBookings({});

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    test('应只返回状态为 confirmed 且 bus_id 为空的订单', async () => {
      await TestHelper.createPendingBooking(testSchedule.id, TestHelper.testDate);
      await TestHelper.createCancelledBooking(testSchedule.id, TestHelper.testDate);
      await TestHelper.createDispatchedBooking(testSchedule.id, TestHelper.testDate, testBus.id);
      await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);

      const result = await dispatchService.getPendingBookings({});

      expect(result.length).toBe(1);
      expect(result[0].totalPassengers).toBe(3);
    });

    test('应按日期和班次正确分组', async () => {
      const schedule2 = (await TestHelper.getSchedules())[1];
      await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 2);
      await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate2, 3);
      await TestHelper.createMultipleBookings(schedule2.id, TestHelper.testDate, 4);

      const result = await dispatchService.getPendingBookings({});

      expect(result.length).toBe(3);

      const group1 = result.find(
        g => g.date === TestHelper.testDate && g.schedule_id === testSchedule.id
      );
      const group2 = result.find(
        g => g.date === TestHelper.testDate2 && g.schedule_id === testSchedule.id
      );
      const group3 = result.find(
        g => g.date === TestHelper.testDate && g.schedule_id === schedule2.id
      );

      expect(group1).toBeDefined();
      expect(group1.totalPassengers).toBe(2);
      expect(group2).toBeDefined();
      expect(group2.totalPassengers).toBe(3);
      expect(group3).toBeDefined();
      expect(group3.totalPassengers).toBe(4);
    });

    test('按日期筛选应只返回指定日期的订单', async () => {
      const schedule2 = (await TestHelper.getSchedules())[1];
      await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 2);
      await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate2, 3);
      await TestHelper.createMultipleBookings(schedule2.id, TestHelper.testDate, 4);

      const result = await dispatchService.getPendingBookings({
        date: TestHelper.testDate,
        route: null
      });

      expect(result.length).toBe(2);
      for (const group of result) {
        expect(group.date).toBe(TestHelper.testDate);
      }
    });

    test('按路线筛选应只返回指定路线的订单', async () => {
      const schedules = await TestHelper.getSchedules();
      const beijingToZhangjiakou = schedules.filter(s => s.route === '北京→张家口');
      const zhangjiakouToBeijing = schedules.filter(s => s.route === '张家口→北京');

      if (beijingToZhangjiakou.length > 0 && zhangjiakouToBeijing.length > 0) {
        await TestHelper.createMultipleBookings(beijingToZhangjiakou[0].id, TestHelper.testDate, 2);
        await TestHelper.createMultipleBookings(zhangjiakouToBeijing[0].id, TestHelper.testDate, 3);

        const result = await dispatchService.getPendingBookings({
          date: null,
          route: '北京→张家口'
        });

        expect(result.length).toBe(1);
        expect(result[0].route).toBe('北京→张家口');
        expect(result[0].totalPassengers).toBe(2);
      }
    });

    test('返回的分组数据结构应正确', async () => {
      await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);

      const result = await dispatchService.getPendingBookings({});

      expect(result.length).toBe(1);
      const group = result[0];

      expect(group).toHaveProperty('date');
      expect(group).toHaveProperty('schedule_id');
      expect(group).toHaveProperty('route');
      expect(group).toHaveProperty('departure_time');
      expect(group).toHaveProperty('arrival_time');
      expect(group).toHaveProperty('price');
      expect(group).toHaveProperty('bookings');
      expect(group).toHaveProperty('totalPassengers');
      expect(Array.isArray(group.bookings)).toBe(true);
      expect(group.bookings.length).toBe(3);
    });
  });

  describe('getBuses - 获取车辆列表', () => {
    test('不带参数应返回所有车辆', async () => {
      await TestHelper.createBus({ status: 'dispatched' });
      await TestHelper.createBus({ status: 'maintenance' });

      const result = await dispatchService.getBuses();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(5);
    });

    test('按状态筛选 idle 车辆', async () => {
      await TestHelper.createBus({ status: 'dispatched' });
      await TestHelper.createBus({ status: 'maintenance' });

      const result = await dispatchService.getBuses('idle');

      expect(Array.isArray(result)).toBe(true);
      for (const bus of result) {
        expect(bus.status).toBe('idle');
      }
    });

    test('按状态筛选 dispatched 车辆', async () => {
      const dispatchedBus = await TestHelper.createBus({ status: 'dispatched' });

      const result = await dispatchService.getBuses('dispatched');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
      for (const bus of result) {
        expect(bus.status).toBe('dispatched');
      }
    });

    test('返回的车辆数据结构应正确', async () => {
      const result = await dispatchService.getBuses();

      expect(result.length).toBeGreaterThan(0);
      const bus = result[0];

      expect(bus).toHaveProperty('id');
      expect(bus).toHaveProperty('plate_number');
      expect(bus).toHaveProperty('capacity');
      expect(bus).toHaveProperty('driver_name');
      expect(bus).toHaveProperty('driver_phone');
      expect(bus).toHaveProperty('status');
    });
  });

  describe('getDispatchedTrips - 获取已派车行程', () => {
    test('没有已派车行程时应返回空数组', async () => {
      const result = await dispatchService.getDispatchedTrips();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    test('应正确返回已派车行程列表', async () => {
      const schedule2 = (await TestHelper.getSchedules())[1];
      await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);
      await dispatchService.assignBus(testBus.id, testSchedule.id, TestHelper.testDate);

      const result = await dispatchService.getDispatchedTrips();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);

      const trip = result[0];
      expect(trip.bus_id).toBe(testBus.id);
      expect(trip.passenger_count).toBe(3);
      expect(trip.travel_date).toBe(TestHelper.testDate);
    });

    test('多个已派车行程应正确分组', async () => {
      const bus2 = (await TestHelper.getBuses())[1];
      const schedule2 = (await TestHelper.getSchedules())[1];

      await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);
      await dispatchService.assignBus(testBus.id, testSchedule.id, TestHelper.testDate);

      await TestHelper.createMultipleBookings(schedule2.id, TestHelper.testDate2, 2);
      await dispatchService.assignBus(bus2.id, schedule2.id, TestHelper.testDate2);

      const result = await dispatchService.getDispatchedTrips();

      expect(result.length).toBe(2);
    });

    test('分页查询应返回正确结构', async () => {
      await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 3);
      await dispatchService.assignBus(testBus.id, testSchedule.id, TestHelper.testDate);

      const result = await dispatchService.getDispatchedTrips({ page: 1, pageSize: 10 });

      expect(result).toHaveProperty('list');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('pageSize');
      expect(result).toHaveProperty('totalPages');
      expect(Array.isArray(result.list)).toBe(true);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    test('分页查询第二页应返回正确数据', async () => {
      const buses = await TestHelper.getBuses();
      const schedules = await TestHelper.getSchedules();

      for (let i = 0; i < 3; i++) {
        await TestHelper.createMultipleBookings(schedules[i].id, TestHelper.testDate, 2 + i);
        await dispatchService.assignBus(buses[i].id, schedules[i].id, TestHelper.testDate);
      }

      const result = await dispatchService.getDispatchedTrips({ page: 2, pageSize: 2 });

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(2);
      expect(result.list.length).toBe(1);
    });
  });

  describe('完整派车流程集成测试', () => {
    test('完整派车流程：查询待派车 → 派车 → 查询已派车 → 完成行程', async () => {
      await TestHelper.createMultipleBookings(testSchedule.id, TestHelper.testDate, 5);

      const pendingBefore = await dispatchService.getPendingBookings({});
      expect(pendingBefore.length).toBe(1);
      expect(pendingBefore[0].totalPassengers).toBe(5);

      const availableBuses = await dispatchService.getBuses('idle');
      expect(availableBuses.length).toBeGreaterThanOrEqual(1);

      const busToDispatch = availableBuses[0];
      const dispatchResult = await dispatchService.assignBus(
        busToDispatch.id,
        testSchedule.id,
        TestHelper.testDate
      );
      expect(dispatchResult.success).toBe(true);

      const pendingAfter = await dispatchService.getPendingBookings({});
      expect(pendingAfter.length).toBe(0);

      const dispatchedTrips = await dispatchService.getDispatchedTrips();
      expect(dispatchedTrips.length).toBe(1);
      expect(dispatchedTrips[0].bus_id).toBe(busToDispatch.id);
      expect(dispatchedTrips[0].passenger_count).toBe(5);

      const busyBuses = await dispatchService.getBuses('dispatched');
      const dispatchedBus = busyBuses.find(b => b.id === busToDispatch.id);
      expect(dispatchedBus).toBeDefined();

      const completeResult = await dispatchService.completeTrip(busToDispatch.id);
      expect(completeResult.success).toBe(true);

      const idleBusesAfterComplete = await dispatchService.getBuses('idle');
      const completedBus = idleBusesAfterComplete.find(b => b.id === busToDispatch.id);
      expect(completedBus).toBeDefined();

      const finalBookings = await TestHelper.getBookingsByScheduleAndDate(
        testSchedule.id,
        TestHelper.testDate
      );
      expect(finalBookings.length).toBe(0);
    });
  });
});
