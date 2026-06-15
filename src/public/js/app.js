const API_BASE = '/api';

let currentRoute = '北京→张家口';
let selectedScheduleId = null;
let currentBookingId = null;

const statusMap = {
  pending: { text: '待处理', class: 'status-pending' },
  confirmed: { text: '已确认', class: 'status-confirmed' },
  dispatched: { text: '已派车', class: 'status-dispatched' },
  completed: { text: '已完成', class: 'status-completed' },
  cancelled: { text: '已取消', class: 'status-cancelled' }
};

document.addEventListener('DOMContentLoaded', function() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('travelDate').value = today;
  document.getElementById('travelDate').min = today;

  loadSchedules();
  bindEvents();
});

function bindEvents() {
  document.querySelectorAll('.route-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.route-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      currentRoute = this.dataset.route;
      selectedScheduleId = null;
      loadSchedules();
    });
  });

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      this.classList.add('active');
      const tab = this.dataset.tab;
      document.getElementById('booking-tab').classList.toggle('hidden', tab !== 'booking');
      document.getElementById('my-tab').classList.toggle('hidden', tab !== 'my');
      if (tab === 'my') {
        const phone = localStorage.getItem('bookingPhone');
        if (phone) {
          document.getElementById('queryPhone').value = phone;
          queryBookings();
        }
      }
    });
  });

  document.getElementById('travelDate').addEventListener('change', function() {
    selectedScheduleId = null;
    renderSchedules(window.schedulesData || []);
  });

  document.getElementById('submitBtn').addEventListener('click', submitBooking);
  document.getElementById('queryBtn').addEventListener('click', queryBookings);
  document.getElementById('cancelBtn').addEventListener('click', cancelBooking);
}

async function loadSchedules() {
  try {
    const res = await fetch(`${API_BASE}/bookings/schedules?route=${encodeURIComponent(currentRoute)}`);
    const data = await res.json();
    if (data.code === 0) {
      window.schedulesData = data.data;
      renderSchedules(data.data);
    }
  } catch (e) {
    showToast('加载班次失败');
  }
}

function renderSchedules(schedules) {
  const container = document.getElementById('scheduleList');
  if (!schedules || schedules.length === 0) {
    container.innerHTML = '<div class="empty">暂无班次信息</div>';
    return;
  }

  container.innerHTML = schedules.map(s => `
    <div class="schedule-item ${selectedScheduleId === s.id ? 'selected' : ''}" 
         onclick="selectSchedule(${s.id})">
      <div class="schedule-time">
        <span class="departure">${s.departure_time}</span>
        <span class="arrow">→</span>
        <span class="arrival">${s.arrival_time}</span>
      </div>
      <div class="schedule-price">¥${s.price}<small>/人</small></div>
    </div>
  `).join('');
}

function selectSchedule(id) {
  selectedScheduleId = id;
  renderSchedules(window.schedulesData || []);
}

async function submitBooking() {
  const passengerName = document.getElementById('passengerName').value.trim();
  const passengerPhone = document.getElementById('passengerPhone').value.trim();
  const idCard = document.getElementById('idCard').value.trim();
  const travelDate = document.getElementById('travelDate').value;

  if (!passengerName) return showToast('请输入姓名');
  if (!/^1\d{10}$/.test(passengerPhone)) return showToast('请输入正确的手机号');
  if (!travelDate) return showToast('请选择乘车日期');
  if (!selectedScheduleId) return showToast('请选择班次');

  try {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passenger_name: passengerName, passenger_phone: passengerPhone, id_card: idCard, schedule_id: selectedScheduleId, travel_date: travelDate })
    });
    const data = await res.json();
    if (data.code === 0) {
      showSuccessModal(data.data);
      localStorage.setItem('bookingPhone', passengerPhone);
      document.getElementById('passengerName').value = '';
      document.getElementById('idCard').value = '';
      selectedScheduleId = null;
      renderSchedules(window.schedulesData || []);
    } else {
      showToast(data.message || '预定失败');
    }
  } catch (e) {
    showToast('网络错误');
  }
}

function showSuccessModal(booking) {
  const status = statusMap[booking.status] || { text: booking.status, class: '' };
  document.getElementById('successDetail').innerHTML = `
    <div class="row"><span class="label">订单号</span><span class="value">${booking.id}</span></div>
    <div class="row"><span class="label">线路</span><span class="value">${booking.route}</span></div>
    <div class="row"><span class="label">日期</span><span class="value">${booking.travel_date}</span></div>
    <div class="row"><span class="label">班次</span><span class="value">${booking.departure_time} - ${booking.arrival_time}</span></div>
    <div class="row"><span class="label">座位号</span><span class="value">${booking.seat_number}号</span></div>
    <div class="row"><span class="label">姓名</span><span class="value">${booking.passenger_name}</span></div>
    <div class="row"><span class="label">手机</span><span class="value">${booking.passenger_phone}</span></div>
    <div class="row"><span class="label">票价</span><span class="value">¥${booking.price}</span></div>
    <div class="row"><span class="label">状态</span><span class="value ${status.class}">${status.text}</span></div>
  `;
  document.getElementById('successModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('successModal').classList.add('hidden');
}

async function queryBookings() {
  const phone = document.getElementById('queryPhone').value.trim();
  if (!/^1\d{10}$/.test(phone)) return showToast('请输入正确的手机号');

  try {
    const res = await fetch(`${API_BASE}/bookings?phone=${phone}`);
    const data = await res.json();
    if (data.code === 0) {
      localStorage.setItem('bookingPhone', phone);
      renderBookingList(data.data);
    }
  } catch (e) {
    showToast('查询失败');
  }
}

function renderBookingList(bookings) {
  const container = document.getElementById('bookingList');
  if (!bookings || bookings.length === 0) {
    container.innerHTML = '<div class="card"><div class="empty">暂无订单</div></div>';
    return;
  }

  container.innerHTML = bookings.map(b => {
    const status = statusMap[b.status] || { text: b.status, class: '' };
    return `
      <div class="card" onclick="showDetail(${b.id})">
        <div class="booking-header">
          <span class="booking-route">${b.route}</span>
          <span class="booking-status ${status.class}">${status.text}</span>
        </div>
        <div class="booking-info">
          <div>日期：<span>${b.travel_date}</span> | 班次：<span>${b.departure_time}</span></div>
          <div>乘客：<span>${b.passenger_name}</span> | 座位：<span>${b.seat_number}号</span></div>
          ${b.plate_number ? `<div>车辆：<span>${b.plate_number}</span> | 司机：<span>${b.driver_name || '-'}</span></div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function showDetail(id) {
  try {
    const res = await fetch(`${API_BASE}/bookings/${id}`);
    const data = await res.json();
    if (data.code === 0) {
      currentBookingId = id;
      const b = data.data;
      const status = statusMap[b.status] || { text: b.status, class: '' };
      const canCancel = b.status === 'pending' || b.status === 'confirmed';
      document.getElementById('cancelBtn').style.display = canCancel ? 'block' : 'none';

      document.getElementById('detailContent').innerHTML = `
        <div class="row"><span class="label">订单号</span><span class="value">${b.id}</span></div>
        <div class="row"><span class="label">线路</span><span class="value">${b.route}</span></div>
        <div class="row"><span class="label">日期</span><span class="value">${b.travel_date}</span></div>
        <div class="row"><span class="label">班次</span><span class="value">${b.departure_time} - ${b.arrival_time}</span></div>
        <div class="row"><span class="label">座位号</span><span class="value">${b.seat_number}号</span></div>
        <div class="row"><span class="label">姓名</span><span class="value">${b.passenger_name}</span></div>
        <div class="row"><span class="label">手机</span><span class="value">${b.passenger_phone}</span></div>
        ${b.id_card ? `<div class="row"><span class="label">身份证</span><span class="value">${b.id_card}</span></div>` : ''}
        ${b.plate_number ? `<div class="row"><span class="label">车牌号</span><span class="value">${b.plate_number}</span></div>` : ''}
        ${b.driver_name ? `<div class="row"><span class="label">司机</span><span class="value">${b.driver_name} (${b.driver_phone || '-'})</span></div>` : ''}
        <div class="row"><span class="label">票价</span><span class="value">¥${b.price}</span></div>
        <div class="row"><span class="label">状态</span><span class="value ${status.class}">${status.text}</span></div>
        <div class="row"><span class="label">下单时间</span><span class="value">${b.created_at}</span></div>
      `;
      document.getElementById('detailModal').classList.remove('hidden');
    }
  } catch (e) {
    showToast('获取详情失败');
  }
}

function closeDetailModal() {
  document.getElementById('detailModal').classList.add('hidden');
  currentBookingId = null;
}

async function cancelBooking() {
  if (!currentBookingId) return;
  if (!confirm('确定要取消该订单吗？')) return;

  try {
    const res = await fetch(`${API_BASE}/bookings/${currentBookingId}/cancel`, { method: 'POST' });
    const data = await res.json();
    if (data.code === 0) {
      showToast('取消成功');
      closeDetailModal();
      queryBookings();
    } else {
      showToast(data.message || '取消失败');
    }
  } catch (e) {
    showToast('取消失败');
  }
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}
