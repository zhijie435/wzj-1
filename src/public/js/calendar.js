function initDatePicker(wrapId, hiddenInputId, displayId, options = {}) {
  const wrap = document.getElementById(wrapId);
  const display = document.getElementById(displayId);
  const hiddenInput = document.getElementById(hiddenInputId);
  if (!wrap || !display || !hiddenInput) return;

  let currentYear, currentMonth;
  let open = false;
  let dropdown = null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${y}年${parseInt(m)}月${parseInt(d)}日`;
  }

  function setValue(dateStr) {
    hiddenInput.value = dateStr;
    if (dateStr) {
      display.textContent = formatDate(dateStr);
      display.classList.remove('placeholder');
    } else {
      display.textContent = options.placeholder || '请选择日期';
      display.classList.add('placeholder');
    }
    if (options.onChange) options.onChange(dateStr);
  }

  function buildCalendar(year, month) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const selectedVal = hiddenInput.value;

    let html = '<div class="calendar-header">';
    html += `<button type="button" class="calendar-nav" data-dir="prev">‹</button>`;
    html += `<span class="calendar-title">${year}年${month + 1}月</span>`;
    html += `<button type="button" class="calendar-nav" data-dir="next">›</button>`;
    html += '</div>';

    html += '<div class="calendar-weekdays">';
    for (const w of weekdays) {
      html += `<div class="calendar-weekday">${w}</div>`;
    }
    html += '</div>';

    html += '<div class="calendar-days">';
    for (let i = 0; i < firstDay; i++) {
      html += '<div class="calendar-day empty"></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(year, month, d);
      let cls = 'calendar-day';
      if (dateObj < today && options.minToday !== false) cls += ' disabled';
      if (dateStr === todayStr) cls += ' today';
      if (dateStr === selectedVal) cls += ' selected';
      html += `<button type="button" class="${cls}" data-date="${dateStr}">${d}</button>`;
    }
    html += '</div>';

    return html;
  }

  function render() {
    if (!dropdown) return;
    dropdown.innerHTML = buildCalendar(currentYear, currentMonth);
  }

  function openCalendar() {
    if (open) return;
    open = true;
    wrap.classList.add('active');
    const selVal = hiddenInput.value;
    if (selVal) {
      const [y, m] = selVal.split('-').map(Number);
      currentYear = y;
      currentMonth = m - 1;
    } else {
      currentYear = today.getFullYear();
      currentMonth = today.getMonth();
    }
    dropdown = document.createElement('div');
    dropdown.className = 'calendar-dropdown';
    wrap.appendChild(dropdown);
    render();
  }

  function closeCalendar() {
    if (!open || !dropdown) return;
    open = false;
    wrap.classList.remove('active');
    dropdown.remove();
    dropdown = null;
  }

  wrap.addEventListener('click', function(e) {
    if (e.target.closest('.calendar-nav')) {
      const dir = e.target.closest('.calendar-nav').dataset.dir;
      if (dir === 'prev') {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      } else {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      }
      render();
      return;
    }

    if (e.target.closest('.calendar-day') && !e.target.closest('.calendar-day').classList.contains('empty') && !e.target.closest('.calendar-day').classList.contains('disabled')) {
      const dayBtn = e.target.closest('.calendar-day');
      const dateStr = dayBtn.dataset.date;
      if (dateStr) {
        setValue(dateStr);
        closeCalendar();
      }
      return;
    }

    if (e.target === display || e.target.closest('.date-picker-input')) {
      if (open) {
        closeCalendar();
      } else {
        openCalendar();
      }
      return;
    }
  });

  document.addEventListener('click', function(e) {
    if (open && !wrap.contains(e.target)) {
      closeCalendar();
    }
  });

  return { setValue, getValue: () => hiddenInput.value };
}
