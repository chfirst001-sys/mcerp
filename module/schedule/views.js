import { escapeHtml } from "../../js/main.js";
import { state } from "./store.js";

export const getEventsForDate = (dateStr) => {
    return state.schedules.filter(evt => dateStr >= evt.startDate && dateStr <= evt.endDate);
};

export const calculateOverlap = (events) => {
    const parseTime = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const evts = events.map(e => ({ ...e, startMin: parseTime(e.startTime), endMin: parseTime(e.endTime) }))
                       .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
    const groups = []; let currentGroup = []; let currentMaxEnd = 0;
    evts.forEach(e => {
        if (currentGroup.length === 0) { currentGroup.push(e); currentMaxEnd = e.endMin; }
        else {
            if (e.startMin < currentMaxEnd) { currentGroup.push(e); currentMaxEnd = Math.max(currentMaxEnd, e.endMin); }
            else { groups.push(currentGroup); currentGroup = [e]; currentMaxEnd = e.endMin; }
        }
    });
    if (currentGroup.length > 0) groups.push(currentGroup);
    groups.forEach(group => {
        const columns = [];
        group.forEach(e => {
            let placed = false;
            for (let i = 0; i < columns.length; i++) {
                const col = columns[i];
                if (col[col.length - 1].endMin <= e.startMin) { col.push(e); e.colIdx = i; placed = true; break; }
            }
            if (!placed) { e.colIdx = columns.length; columns.push([e]); }
        });
        group.forEach(e => e.numCols = columns.length);
    });
    return evts;
};

export const generateCellHtml = (dateStr, day, isOtherMonth, dayOfWeek, isToday = false) => {
    const cellClasses = ['calendar-cell'];
    if (isOtherMonth) cellClasses.push('other-month');
    if (isToday) cellClasses.push('today');
    if (dayOfWeek === 0) cellClasses.push('sun');
    if (dayOfWeek === 6) cellClasses.push('sat');
    const dayEvents = getEventsForDate(dateStr);
    let eventsHtml = '';
    dayEvents.forEach(evt => { eventsHtml += `<div class="event-badge type-${evt.type}" data-id="${evt.id}" title="${escapeHtml(evt.title)}">${escapeHtml(evt.title)}</div>`; });
    return `<div class="${cellClasses.join(' ')}" data-date="${dateStr}"><div style="text-align: center;"><span class="calendar-date">${day}</span></div>${eventsHtml}</div>`;
};

export const renderMonthView = (container, ctx) => {
    const year = state.currentDate.getFullYear(); const month = state.currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const daysInPrevMonth = new Date(year, month, 0).getDate();
    let html = '<div class="calendar-grid">';
    const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
    weekDays.forEach(day => { html += `<div class="calendar-header-cell">${day}</div>`; });
    for (let i = 0; i < firstDay; i++) {
        const day = daysInPrevMonth - firstDay + i + 1;
        const dateStr = `${month === 0 ? year - 1 : year}-${String(month === 0 ? 12 : month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        html += generateCellHtml(dateStr, day, true, i % 7);
    }
    const now = new Date(); const realTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    for (let i = 1; i <= daysInMonth; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const isToday = dateStr === realTodayStr; const dayOfWeek = (firstDay + i - 1) % 7;
        html += generateCellHtml(dateStr, i, false, dayOfWeek, isToday);
    }
    const totalCells = firstDay + daysInMonth; const nextMonthDays = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= nextMonthDays; i++) {
        const dateStr = `${month === 11 ? year + 1 : year}-${String(month === 11 ? 1 : month + 2).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayOfWeek = (totalCells + i - 1) % 7;
        html += generateCellHtml(dateStr, i, true, dayOfWeek);
    }
    html += '</div>';
    container.innerHTML = html;
    ctx.bindCalendarEvents(container);
};

export const renderDayWeekView = (container, datesArray, ctx) => {
    const now = new Date(); const nowStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentMin = now.getHours() * 60 + now.getMinutes();
    let headerHtml = '<div style="display: flex; border-bottom: 1px solid #dadce0; margin-left: 45px; background: white;">';
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    datesArray.forEach((dateStr, index) => {
        const isLast = index === datesArray.length - 1;
        const d = new Date(dateStr); const isToday = dateStr === nowStr;
        const dayColor = isToday ? '#1a73e8' : (d.getDay() === 0 ? '#e74c3c' : (d.getDay() === 6 ? '#2980b9' : '#70757a'));
        headerHtml += `<div class="calendar-cell" data-date="${dateStr}" style="flex: 1; text-align: center; padding: 10px 0; border-right: ${isLast ? 'none' : '1px solid #dadce0'}; cursor: pointer; min-height: auto; box-sizing: border-box;"><div style="font-size: 11px; color: ${dayColor}; margin-bottom: 4px; font-weight: 500;">${dayNames[d.getDay()]}</div><div style="font-size: 20px; width: 36px; height: 36px; line-height: 36px; border-radius: 50%; margin: 0 auto; color: ${isToday ? 'white' : '#3c4043'}; background: ${isToday ? '#1a73e8' : 'transparent'}; font-weight: ${isToday ? 'bold' : 'normal'}; transition: background 0.2s;">${d.getDate()}</div></div>`;
    });
    headerHtml += '</div>';
    let allDaySection = '<div style="display: flex; margin-left: 45px; border-bottom: 1px solid #dadce0; min-height: 24px; padding: 2px 0; background: white;">';
    datesArray.forEach((dateStr, index) => {
        const isLast = index === datesArray.length - 1;
        const dayEvents = getEventsForDate(dateStr); const allDayEvts = dayEvents.filter(e => e.isAllDay || e.startDate !== e.endDate);
        const evtsHtml = allDayEvts.map(e => `<div class="event-badge type-${e.type}" data-id="${e.id}" style="padding:2px 4px; font-size:11px; margin-bottom:2px; cursor:pointer;" title="${escapeHtml(e.title)}">${escapeHtml(e.title)}</div>`).join('');
        allDaySection += `<div style="flex: 1; border-right: ${isLast ? 'none' : '1px solid #dadce0'}; padding: 2px; box-sizing: border-box;" class="calendar-cell" data-date="${dateStr}">${evtsHtml}</div>`;
    });
    allDaySection += '</div>';
    let timeLabels = ''; let gridLines = '';
    for (let i = 1; i < 24; i++) {
        timeLabels += `<div style="position:absolute; top:${i * 60 - 7}px; right:8px; font-size:10px; color:#70757a; font-weight: 500;">${i === 12 ? '오후 12' : (i > 12 ? '오후 ' + (i - 12) : '오전 ' + i)}시</div>`;
        gridLines += `<div style="position:absolute; top:${i * 60}px; left:0; right:0; border-top:1px solid #dadce0;"></div>`;
    }
    let gridColumnsHtml = '';
    datesArray.forEach(dateStr => {
        const dayEvents = getEventsForDate(dateStr); const timedEvts = dayEvents.filter(e => !e.isAllDay && e.startDate === e.endDate);
        let timedHtml = ''; const processedEvts = calculateOverlap(timedEvts);
        processedEvts.forEach(e => {
            let top = e.startMin; let height = e.endMin - top; if (height < 20) height = 20;
            const left = (e.colIdx / e.numCols) * 100; const width = (1 / e.numCols) * 100;
            const bg = e.type === 'meeting' ? '#9b59b6' : (e.type === 'task' ? '#e67e22' : (e.type === 'holiday' ? '#e74c3c' : '#3498db'));
            timedHtml += `<div class="timed-event-card event-badge type-${e.type}" data-id="${e.id}" style="top: ${top}px; height: ${height}px; left: calc(${left}% + 1px); width: calc(${width}% - 2px); background: ${bg}; z-index: 10;" title="${escapeHtml(e.title)}\n${e.startTime}~${e.endTime}"><div style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(e.title)}</div><div style="font-size:9px; opacity:0.8;">${e.startTime}~${e.endTime}</div></div>`;
        });
        if (dateStr === nowStr) timedHtml += `<div style="position:absolute; top:${currentMin}px; left:0; right:0; height:2px; background:#ea4335; z-index:20; pointer-events:none;"><div style="position:absolute; left:-5px; top:-4px; width:10px; height:10px; border-radius:50%; background:#ea4335;"></div></div>`;
        gridColumnsHtml += `<div class="grid-column" data-date="${dateStr}">${timedHtml}</div>`;
    });
    container.innerHTML = `<div style="display:flex; flex-direction:column; height:100%; background:white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">${headerHtml}${allDaySection}<div class="time-grid-wrapper"><div class="time-axis">${timeLabels}</div><div style="flex: 1; position: relative; height: 1440px; display: flex;"><div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none;">${gridLines}</div>${gridColumnsHtml}</div></div></div>`;
    ctx.bindCalendarEvents(container);
    const wrapper = container.querySelector('.time-grid-wrapper');
    if (wrapper) wrapper.scrollTop = 9 * 60 - 20;
};

export const renderWeekView = (container, ctx) => {
    const year = state.currentDate.getFullYear(); const month = state.currentDate.getMonth(); const date = state.currentDate.getDate(); const day = state.currentDate.getDay();
    const startOfWeek = new Date(year, month, date - day); const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i);
        weekDates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    renderDayWeekView(container, weekDates, ctx);
};

export const renderDayView = (container, ctx) => {
    const dateStr = `${state.currentDate.getFullYear()}-${String(state.currentDate.getMonth() + 1).padStart(2, '0')}-${String(state.currentDate.getDate()).padStart(2, '0')}`;
    renderDayWeekView(container, [dateStr], ctx);
};

export const renderYearView = (container, ctx) => {
    const year = state.currentDate.getFullYear();
    let html = '<div class="year-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 10px;">';
    for (let m = 0; m < 12; m++) {
        const monthPrefix = `${year}-${String(m + 1).padStart(2, '0')}`;
        const monthEvents = state.schedules.filter(s => s.startDate.startsWith(monthPrefix) || s.endDate.startsWith(monthPrefix));
        const isCurrentMonth = (year === new Date().getFullYear() && m === new Date().getMonth());
        const bg = isCurrentMonth ? '#e8f4f8' : '#f8f9fa'; const border = isCurrentMonth ? '1px solid #3498db' : '1px solid #eee';
        html += `<div class="year-month-card" data-month="${m}" style="background: ${bg}; border: ${border}; border-radius: 8px; padding: 25px 10px; text-align: center; cursor: pointer; transition: transform 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05);" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'"><div style="font-size: 18px; font-weight: bold; color: #2c3e50; margin-bottom: 8px;">${m + 1}월</div><div style="font-size: 12px; color: ${monthEvents.length > 0 ? '#2980b9' : '#95a5a6'}; font-weight: ${monthEvents.length > 0 ? 'bold' : 'normal'};">${monthEvents.length > 0 ? `일정 ${monthEvents.length}건` : '일정 없음'}</div></div>`;
    }
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.year-month-card').forEach(card => {
        card.addEventListener('click', (e) => {
            state.currentDate = new Date(year, parseInt(e.currentTarget.dataset.month), 1);
            ctx.changeTab(2);
        });
    });
};