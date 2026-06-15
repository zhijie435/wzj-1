const API_BASE = '/api';

let currentAssignData = null;
let selectedBusId = null;

const statusMap = {
  pending: { text: '待处理', class: 'status-pending' },
  confirmed: { text: '已确认', class: 'status-confirmed' },
  dispatched: { text: '已派车', class: 'status-dispatched' },
  completed: { text: '已完成', class: 'status-completed' },
  cancelled: { text: '已取消', class: 'status-cancelled' }
};

const busStatusMap = {
  idle: { text: '空闲', class: 'bus-idle' },
  dispatched: { text: '运行中', class: 'bus-dispatched' }
};

function getAuthToken() {
  return localStorage.getItem('adminToken');
}

function authenticatedFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}

function handleAuthError(data) {
  if (data.code === 401) {
    localStorage.removeItem('adminToken');
    checkAuth();
    showToast('登录已过期，请重新登录');
    return true;
  }
  return false;
}

function checkAuth() {
  const token = getAuthToken();
  if (token) {
    document.getElementById('loginView').classList.add('hidden');
    document.getElementById('adminView').classList.remove('hidden');
    document.getElementById('logoutWrap').classList.remove('hidden');
    return true;
  }
  document.getElementById('loginView').classList.remove('hidden');
  document.getElementById('adminView').classList.add('hidden');
  document.getElementById('logoutWrap').classList.add('hidden');
  return false;
}

document.addEventListener('DOMContentLoaded', function() {
  const today = new Date().toISOString().split('T')[0];

  if (checkAuth()) {
    initAdmin(today);
  }

  bindAuthEvents(today);
});

function initAdmin(today) {
  const datePicker = initDatePicker('filterDatePicker', 'filterDate', 'filterDateDisplay', {
    placeholder: '请选择日期',
    minToday: false
  });
  datePicker.setValue(today);

  bindEvents();
  loadPendingBookings();
  loadBuses();
}

function bindAuthEvents(today) {
  document.getElementById('loginBtn').addEventListener('click', function() {
    doLogin(today);
  });

  document.getElementById('adminPassword').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLogin(today);
  });

  document.getElementById('logoutBtn').addEventListener('click', function() {
    localStorage.removeItem('adminToken');
    checkAuth();
  });
}

async function doLogin(today) {
  const username = document.getElementById('adminUsername').value.trim();
  const password = document.getElementById('adminPassword').value.trim();
  const errorEl = document.getElementById('loginError');

  if (!username || !password) {
    errorEl.textContent = '请输入用户名和密码';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.code === 0 && data.data && data.data.token) {
      localStorage.setItem('adminToken', data.data.token);
      errorEl.style.display = 'none';
      checkAuth();
      initAdmin(today);
    } else {
      errorEl.textContent = data.message || '用户名或密码错误';
      errorEl.style.display = 'block';
    }
  } catch (e) {
    errorEl.textContent = '登录失败，请稍后重试';
    errorEl.style.display = 'block';
  }
}

function bindEvents() {
  document.querySelectorAll('.nav-item').forEach(tab => {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      const tabName = this.dataset.tab;
      document.getElementById('pending-tab').classList.toggle('hidden', tabName !== 'pending');
      document.getElementById('trips-tab').classList.toggle('hidden', tabName !== 'trips');
      document.getElementById('buses-tab').classList.toggle('hidden', tabName !== 'buses');

      if (tabName === 'pending') loadPendingBookings();
      if (tabName === 'trips') loadTrips();
      if (tabName === 'buses') loadBuses();
    });
  });

  document.getElementById('filterBtn').addEventListener('click', loadPendingBookings);
  document.getElementById('confirmAssignBtn').addEventListener('click', confirmAssign);
}

async function loadPendingBookings() {
  const date = document.getElementById('filterDate').value;
  const route = document.getElementById('filterRoute').value;

  let url = `${API_BASE}/dispatch/pending`;
  const params = [];
  if (date) params.push(`date=${date}`);
  if (route) params.push(`route=${encodeURIComponent(route)}`);
  if (params.length) url += '?' + params.join('&');

  try {
    const res = await authenticatedFetch(url);
    const data = await res.json();
    if (handleAuthError(data)) return;
    if (data.code === 0) {
      renderPendingList(data.data);
    }
  } catch (e) {
    showToast('加载失败');
  }
}

function renderPendingList(groups) {
  const container = document.getElementById('pendingList');
  if (!groups || groups.length === 0) {
    container.innerHTML = '<div class="card"><div class="empty">暂无待派车订单</div></div>';
    return;
  }

  container.innerHTML = groups.map(g => `
    <div class="card">
      <div class="dispatch-group-header">
        <span class="dispatch-route">${g.route} | ${g.departure_time}</span>
        <span class="dispatch-count">${g.totalPassengers}人</span>
      </div>
      <div class="dispatch-passengers">
        ${g.bookings.map(b => `<div>${b.passenger_name} - ${b.passenger_phone} | ${b.seat_number}号</div>`).join('')}
      </div>
      <button class="btn btn-primary" onclick="openAssignModal(${g.schedule_id}, '${g.date}', ${g.totalPassengers}, '${g.route} ${g.departure_time}')">
        指派车辆
      </button>
    </div>
  `).join('');
}

async function openAssignModal(scheduleId, travelDate, passengerCount, desc) {
  currentAssignData = { schedule_id: scheduleId, travel_date: travelDate };
  selectedBusId = null;

  document.getElementById('assignInfo').innerHTML = `
    <strong>${desc}</strong><br>
    乘车日期：${travelDate}<br>
    乘客数量：${passengerCount}人
  `;

  try {
    const res = await authenticatedFetch(`${API_BASE}/dispatch/buses?status=idle`);
    const data = await res.json();
    if (handleAuthError(data)) return;
    if (data.code === 0) {
      const buses = data.data.filter(b => b.capacity >= passengerCount);
      if (buses.length === 0) {
        document.getElementById('busOptions').innerHTML = `
          <div style="color:#ff4d4f;padding:15px 0;text-align:center;">
            没有足够容量的空闲车辆<br>
            当前需要容量 ≥ ${passengerCount}
          </div>
        `;
        document.getElementById('confirmAssignBtn').disabled = true;
      } else {
        document.getElementById('busOptions').innerHTML = buses.map(b => `
          <label class="bus-item">
            <input type="radio" name="bus" value="${b.id}" onchange="selectedBusId = ${b.id}">
            <div class="bus-info">
              <div class="bus-plate">${b.plate_number}</div>
              <div class="bus-detail">
                ${b.driver_name || '未分配司机'} | ${b.driver_phone || '-'} | ${b.capacity}座
              </div>
            </div>
          </label>
        `).join('');
        document.getElementById('confirmAssignBtn').disabled = false;
      }
    }
  } catch (e) {
    showToast('加载车辆失败');
  }

  document.getElementById('assignModal').classList.remove('hidden');
}

function closeAssignModal() {
  document.getElementById('assignModal').classList.add('hidden');
  currentAssignData = null;
  selectedBusId = null;
}

async function confirmAssign() {
  if (!selectedBusId) {
    showToast('请选择车辆');
    return;
  }

  try {
    const res = await authenticatedFetch(`${API_BASE}/dispatch/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bus_id: selectedBusId,
        schedule_id: currentAssignData.schedule_id,
        travel_date: currentAssignData.travel_date
      })
    });
    const data = await res.json();
    if (handleAuthError(data)) return;
    if (data.code === 0) {
      showToast(data.message);
      closeAssignModal();
      loadPendingBookings();
    } else {
      showToast(data.message || '派车失败');
    }
  } catch (e) {
    showToast('派车失败');
  }
}

async function loadTrips() {
  try {
    const res = await authenticatedFetch(`${API_BASE}/dispatch/trips`);
    const data = await res.json();
    if (handleAuthError(data)) return;
    if (data.code === 0) {
      renderTrips(data.data);
    }
  } catch (e) {
    showToast('加载失败');
  }
}

function renderTrips(trips) {
  const container = document.getElementById('tripsList');
  if (!trips || trips.length === 0) {
    container.innerHTML = '<div class="card"><div class="empty">暂无派车记录</div></div>';
    return;
  }

  container.innerHTML = `
    <div class="card">
      ${trips.map(t => {
        const status = statusMap[t.status] || { text: t.status, class: '' };
        return `
          <div class="trip-item">
            <div class="trip-header">
              <span class="trip-route">${t.route} | ${t.departure_time}</span>
              <span class="booking-status ${status.class}">${status.text}</span>
            </div>
            <div class="trip-info">
              <div>日期：${t.travel_date} | 乘客：${t.passenger_count}人</div>
              <div>车辆：${t.plate_number} | 司机：${t.driver_name || '-'}</div>
              ${t.status === 'dispatched' ? `
                <button class="btn btn-success" style="margin-top:10px;height:36px;font-size:0.85rem;" 
                        onclick="completeTrip(${t.bus_id})">
                  完成行程
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function completeTrip(busId) {
  if (!confirm('确认该班次已完成行程？')) return;

  try {
    const res = await authenticatedFetch(`${API_BASE}/dispatch/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bus_id: busId })
    });
    const data = await res.json();
    if (handleAuthError(data)) return;
    if (data.code === 0) {
      showToast(data.message);
      loadTrips();
    } else {
      showToast(data.message || '操作失败');
    }
  } catch (e) {
    showToast('操作失败');
  }
}

async function loadBuses() {
  try {
    const res = await authenticatedFetch(`${API_BASE}/dispatch/buses`);
    const data = await res.json();
    if (handleAuthError(data)) return;
    if (data.code === 0) {
      renderBuses(data.data);
    }
  } catch (e) {
    showToast('加载失败');
  }
}

function renderBuses(buses) {
  const container = document.getElementById('busesList');

  document.getElementById('totalBuses').textContent = buses.length;
  document.getElementById('idleBuses').textContent = buses.filter(b => b.status === 'idle').length;
  document.getElementById('dispatchedBuses').textContent = buses.filter(b => b.status === 'dispatched').length;

  if (!buses || buses.length === 0) {
    container.innerHTML = '<div class="card"><div class="empty">暂无车辆</div></div>';
    return;
  }

  container.innerHTML = `
    <div class="card">
      ${buses.map(b => {
        const status = busStatusMap[b.status] || { text: b.status, class: '' };
        return `
          <div class="booking-item">
            <div class="booking-header">
              <span class="booking-route">${b.plate_number}</span>
              <span class="bus-status ${status.class}">${status.text}</span>
            </div>
            <div class="booking-info">
              <div>司机：<span>${b.driver_name || '未分配'}</span></div>
              <div>电话：<span>${b.driver_phone || '-'}</span></div>
              <div>容量：<span>${b.capacity}座</span></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}
