import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, auth, escapeHtml } from "../js/main.js";
import CryptoJS from "https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/+esm";

const tabIds = ['day', 'week', 'month', 'year'];
let currentTabIndex = 2; // 기본값: '월'
let subTabButtons = null;
let lastReclickTime = 0;

let currentDate = new Date();
let schedules = [];
let nardTreeCache = [];
let editEventId = null;
let renderViewRef = null;

// 하단 탭 다시 클릭 시 '오늘'이 있는 이번 달로 돌아오기
export const onReclick = () => {
    if (!subTabButtons) return;
    
    const now = Date.now();
    if (now - lastReclickTime < 300) return; 
    lastReclickTime = now;
    
    currentTabIndex = (currentTabIndex + 1) % tabIds.length;
    subTabButtons[currentTabIndex].click();
};

export const init = async (container) => {
    if (!auth.currentUser) {
        container.innerHTML = '<div style="text-align:center; padding: 50px; color:#7f8c8d;">로그인이 필요합니다.</div>';
        return;
    }

    // 달력용 CSS 주입
    if (!document.getElementById('schedule-styles')) {
        const style = document.createElement('style');
        style.id = 'schedule-styles';
        style.textContent = `
            .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); border-top: 1px solid #e0e0e0; border-left: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
            .calendar-header-cell { background: #f8f9fa; padding: 10px 5px; text-align: center; font-size: 13px; font-weight: bold; color: #34495e; border-right: 1px solid #e0e0e0; border-bottom: 1px solid #e0e0e0; box-sizing: border-box; }
            .calendar-cell { background: white; min-height: 100px; padding: 5px; display: flex; flex-direction: column; gap: 4px; cursor: pointer; transition: background 0.2s; border-right: 1px solid #e0e0e0; border-bottom: 1px solid #e0e0e0; box-sizing: border-box; }
            .calendar-cell:hover { background: #f0f3f4; }
            .calendar-cell.other-month { background: #fdfefe; color: #bdc3c7; }
            .calendar-cell.today { background: #e8f4f8; }
            .calendar-date { font-size: 13px; font-weight: bold; margin-bottom: 5px; color: #2c3e50; display: inline-block; padding: 2px 6px; border-radius: 50%; }
            .calendar-cell.today .calendar-date { background: #2980b9; color: white; }
            .calendar-cell.other-month .calendar-date { color: #bdc3c7; }
            .calendar-cell.sun .calendar-date { color: #e74c3c; }
            .calendar-cell.sat .calendar-date { color: #2980b9; }
            .calendar-cell.today.sun .calendar-date, .calendar-cell.today.sat .calendar-date { color: white; }
            
            .event-badge { color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.1); transition: transform 0.1s; }
            .event-badge:active { transform: scale(0.95); }
            .event-badge.type-basic { background: #3498db; }
            .event-badge.type-meeting { background: #9b59b6; }
            .event-badge.type-task { background: #e67e22; }
            .event-badge.type-holiday { background: #e74c3c; }
            
            /* 구글 캘린더 스타일 반응형 처리 */
    .grid-column { position: relative; flex: 1; border-right: 1px solid #dadce0; height: 1440px; cursor: pointer; box-sizing: border-box; }
            .grid-column:last-child { border-right: none; }
            .time-grid-wrapper { display: flex; flex: 1; overflow-y: auto; position: relative; border-top: 1px solid #dadce0; background: white; scroll-behavior: smooth; }
            .time-axis { width: 45px; flex-shrink: 0; border-right: 1px solid #dadce0; background: white; position: relative; height: 1440px; z-index: 5; }
            .timed-event-card { position: absolute; border-radius: 4px; padding: 4px; font-size: 11px; color: white; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.2); cursor: pointer; line-height: 1.2; border: 1px solid rgba(0,0,0,0.05); box-sizing: border-box; }
            .timed-event-card:hover { filter: brightness(1.05); z-index: 50 !important; }
    .calendar-cell.drag-over { background-color: rgba(52, 152, 219, 0.1) !important; }
        `;
        document.head.appendChild(style);
    }

    container.innerHTML = `
        <!-- 상단 서브 탭 메뉴 -->
        <div class="sub-tab-menu">
            <button class="sub-tab-btn" data-tab="day">일</button>
            <button class="sub-tab-btn" data-tab="week">주</button>
            <button class="sub-tab-btn active" data-tab="month">월</button>
            <button class="sub-tab-btn" data-tab="year">년</button>
        </div>

        <div style="display: flex; flex-direction: column; height: calc(100vh - 150px); padding-bottom: 15px; box-sizing: border-box;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: white; padding: 10px 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); flex-shrink: 0; flex-wrap: wrap; gap: 10px;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex: 1; min-width: 200px;">
                    <button id="prevMonthBtn" style="background: none; border: none; cursor: pointer; color: #7f8c8d; display: flex; align-items: center; padding: 5px;"><span class="material-symbols-outlined" style="font-size: 28px;">chevron_left</span></button>
                    <div id="monthYearDisplayBtn" style="display: flex; align-items: center; cursor: pointer; padding: 5px 10px; border-radius: 8px; transition: background 0.2s;" onmouseover="this.style.background='#f0f3f4'" onmouseout="this.style.background='transparent'" title="월 이동">
                        <h2 id="monthYearDisplay" style="margin: 0; color: #2c3e50; font-size: 18px; font-weight: bold; text-align: center;"></h2>
                        <span class="material-symbols-outlined" style="font-size: 20px; color: #7f8c8d; margin-left: 4px;">arrow_drop_down</span>
                    </div>
                    <button id="nextMonthBtn" style="background: none; border: none; cursor: pointer; color: #7f8c8d; display: flex; align-items: center; padding: 5px;"><span class="material-symbols-outlined" style="font-size: 28px;">chevron_right</span></button>
                </div>
                <button id="todayBtn" style="background: #f0f3f4; color: #2c3e50; border: 1px solid #dfe6e9; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: bold; cursor: pointer; margin-left: auto; transition: background 0.2s;" onmouseover="this.style.background='#e2e6ea'" onmouseout="this.style.background='#f0f3f4'">오늘</button>
            </div>
            
            <div id="scheduleContent" style="flex: 1; display: flex; flex-direction: column; background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); padding: 10px; overflow-y: auto;">
                <div style="text-align: center; padding: 40px; color: #7f8c8d;">스케쥴을 불러오는 중...</div>
            </div>
        </div>

        <!-- 일정 추가/수정 모달 -->
        <div id="eventModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 6000; justify-content: center; align-items: center;">
            <div style="background: white; padding: 25px; border-radius: 12px; width: 90%; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
                <h3 id="eventModalTitle" style="margin-top: 0; color: #2c3e50; margin-bottom: 20px;">새 일정 추가</h3>
                
                <label style="font-size: 12px; color: #7f8c8d; margin-bottom: 5px; display: block; font-weight: bold;">일정 제목 <span style="color:#e74c3c">*</span></label>
                <input type="text" id="eventTitle" placeholder="일정 제목을 입력하세요" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-bottom: 15px;">
                
                <label style="font-size: 12px; color: #7f8c8d; margin-bottom: 5px; display: block; font-weight: bold;">일시</label>
                <label style="font-size: 13px; display: flex; align-items: center; gap: 4px; cursor: pointer; margin-bottom: 10px; color: #2c3e50;">
                    <input type="checkbox" id="eventIsAllDay" checked style="width: auto; margin: 0;"> 종일 일정 (다중 일 선택 가능)
                </label>
                <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
                    <input type="date" id="eventStartDate" style="flex: 2; margin: 0; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                    <input type="time" id="eventStartTime" style="flex: 1; margin: 0; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; display: none;">
                </div>
                <div style="display: flex; gap: 10px; margin-bottom: 15px; align-items: center;">
                    <input type="date" id="eventEndDate" style="flex: 2; margin: 0; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                    <input type="time" id="eventEndTime" style="flex: 1; margin: 0; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; display: none;">
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <label style="font-size: 12px; color: #7f8c8d; font-weight: bold; margin: 0;">나드 저장 위치</label>
                    <button id="eventSetLocationBtn" style="background: #f39c12; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">위치 설정</button>
                </div>
                <div id="eventLocationDisplay" style="font-size: 13px; color: #2c3e50; margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px; border: 1px solid #eee; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">⚡ 빠른 나드 (기본)</div>
                <select id="eventParentId" style="display: none; width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-bottom: 15px; font-size: 14px;">
                </select>

                <label style="font-size: 12px; color: #7f8c8d; margin-bottom: 5px; display: block; font-weight: bold;">일정 분류</label>
                <select id="eventType" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-bottom: 15px; font-size: 14px;">
                    <option value="basic">📘 기본 일정</option>
                    <option value="meeting">🪪 미팅/회의</option>
                    <option value="task">📙 할 일/마감</option>
                    <option value="holiday">📕 휴일/기념일</option>
                </select>

                <label style="font-size: 12px; color: #7f8c8d; margin-bottom: 5px; display: block; font-weight: bold;">상세 메모 (선택)</label>
                <textarea id="eventMemo" rows="3" placeholder="메모를 입력하세요" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-bottom: 20px; resize: none; font-family: inherit;"></textarea>

                <div style="display: flex; gap: 10px;">
                    <button id="saveEventBtn" style="flex: 2; background: #2980b9; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer;">저장</button>
                    <button id="deleteEventBtn" style="flex: 1; background: #e74c3c; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer; display: none;">삭제</button>
                    <button id="cancelEventBtn" style="flex: 1; background: #95a5a6; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer;">취소</button>
                </div>
            </div>
        </div>

        <!-- 날짜 이동 모달 -->
        <div id="jumpModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 6000; justify-content: center; align-items: center;">
            <div style="background: white; padding: 25px; border-radius: 12px; width: 90%; max-width: 300px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); text-align: center;">
                <h3 style="margin-top: 0; color: #2c3e50; margin-bottom: 20px;">월 이동</h3>
                <div style="display: flex; justify-content: center; gap: 10px; margin-bottom: 20px; align-items: center;">
                    <select id="jumpYearSelect" style="padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 16px; outline: none; flex: 1;"></select>
                    <span style="font-size: 16px; font-weight: bold; color: #2c3e50;">년</span>
                    <select id="jumpMonthSelect" style="padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 16px; outline: none; flex: 1;">
                        ${[...Array(12)].map((_, i) => `<option value="${i}">${i + 1}</option>`).join('')}
                    </select>
                    <span style="font-size: 16px; font-weight: bold; color: #2c3e50;">월</span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="confirmJumpBtn" style="flex: 1; background: #2980b9; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer;">이동</button>
                    <button id="cancelJumpBtn" style="flex: 1; background: #95a5a6; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer;">취소</button>
                </div>
            </div>
        </div>
    `;

    // Firestore에서 일정 데이터 불러오기
    const loadSchedules = async () => {
        try {
            const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
            if (userDoc.exists()) {
                let userData = userDoc.data();
                nardTreeCache = userData.nardTree || userData.memoTree || [];
                
                // 구버전 스케쥴 데이터가 있다면 나드 트리로 자동 마이그레이션(변환)
                let migrated = false;
                if (userData.schedules && userData.schedules.length > 0) {
                    userData.schedules.forEach(s => {
                        if (!nardTreeCache.some(n => n.id === s.id)) {
                            nardTreeCache.push({
                                id: s.id,
                                parentId: 'nard_quick_root',
                                title: s.title,
                                content: s.memo || '',
                                dueDate: s.date,
                                startDate: s.date,
                                endDate: s.date,
                                isAllDay: true,
                                scheduleType: s.type || 'basic',
                                createdAt: s.createdAt || Date.now(),
                                updatedAt: s.updatedAt || Date.now(),
                                isEncrypted: false,
                                isFavorite: false
                            });
                            migrated = true;
                        }
                    });
                    if (migrated) {
                        await updateDoc(doc(db, "users", auth.currentUser.uid), { nardTree: nardTreeCache, schedules: [] });
                    }
                }
                
                const secretKey = auth.currentUser.uid;
                schedules = nardTreeCache.filter(n => n.dueDate || n.startDate).map(n => {
                    let decTitle = n.title;
                    let decMemo = n.content;
                    if (n.isEncrypted) {
                        try {
                            decTitle = CryptoJS.AES.decrypt(n.title, secretKey).toString(CryptoJS.enc.Utf8);
                            if (n.content) decMemo = CryptoJS.AES.decrypt(n.content, secretKey).toString(CryptoJS.enc.Utf8);
                        } catch(e) {}
                    }
                    return {
                        id: n.id,
                        startDate: n.startDate || n.dueDate || '',
                        startTime: n.startTime || '09:00',
                        endDate: n.endDate || n.dueDate || n.startDate || '',
                        endTime: n.endTime || '10:00',
                        isAllDay: n.isAllDay !== false, // 기본값 true
                        title: decTitle || '제목 없음',
                        type: n.scheduleType || 'basic',
                        memo: decMemo || '',
                        parentId: n.parentId || 'nard_quick_root'
                    };
                });
            }
        } catch (error) {
            console.error("일정 로드 실패:", error);
        }
    };

    // 특정 날짜에 걸쳐있는 모든 일정 찾기
    const getEventsForDate = (dateStr) => {
        return schedules.filter(evt => {
            return dateStr >= evt.startDate && dateStr <= evt.endDate;
        });
    };

    // 화면 갱신 렌더러 (서브 탭 분기)
    const renderView = () => {
        updateHeaderDisplay();
        const content = document.getElementById('scheduleContent');
        const tab = tabIds[currentTabIndex];
        
        if (tab === 'day') renderDayView(content);
        else if (tab === 'week') renderWeekView(content);
        else if (tab === 'month') renderMonthView(content);
        else if (tab === 'year') renderYearView(content);
    };
    renderViewRef = renderView;

    // 상단 텍스트 업데이트
    const updateHeaderDisplay = () => {
        const tab = tabIds[currentTabIndex];
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const date = currentDate.getDate();
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = dayNames[currentDate.getDay()];

        const displayEl = document.getElementById('monthYearDisplay');
        if (!displayEl) return;
        
        if (tab === 'day') {
            displayEl.textContent = `${year}년 ${month + 1}월 ${date}일 (${dayName})`;
        } else if (tab === 'week') {
            const startOfMonth = new Date(year, month, 1);
            const pastDays = date + startOfMonth.getDay() - 1;
            const weekNum = Math.ceil(pastDays / 7);
            displayEl.textContent = `${year}년 ${month + 1}월 ${weekNum}주차`;
        } else if (tab === 'month') {
            displayEl.textContent = `${year}년 ${month + 1}월`;
        } else if (tab === 'year') {
            displayEl.textContent = `${year}년`;
        }
    };

    // --- 1. 월간 뷰 (Month) ---
    const renderMonthView = (container) => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        let html = '<div class="calendar-grid">';
        const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
        weekDays.forEach(day => {
            html += `<div class="calendar-header-cell">${day}</div>`;
        });

        // 이전 달 날짜 채우기
        for (let i = 0; i < firstDay; i++) {
            const day = daysInPrevMonth - firstDay + i + 1;
            const dateStr = `${month === 0 ? year - 1 : year}-${String(month === 0 ? 12 : month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            html += generateCellHtml(dateStr, day, true, i % 7);
        }

        // 현재 달 날짜 채우기
        const now = new Date();
        const realTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const isToday = dateStr === realTodayStr;
            const dayOfWeek = (firstDay + i - 1) % 7;
            html += generateCellHtml(dateStr, i, false, dayOfWeek, isToday);
        }

        // 다음 달 날짜 채우기 (마지막 줄 빈칸 채움)
        const totalCells = firstDay + daysInMonth;
        const nextMonthDays = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
        for (let i = 1; i <= nextMonthDays; i++) {
            const dateStr = `${month === 11 ? year + 1 : year}-${String(month === 11 ? 1 : month + 2).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayOfWeek = (totalCells + i - 1) % 7;
            html += generateCellHtml(dateStr, i, true, dayOfWeek);
        }

        html += '</div>';
        container.innerHTML = html;
        bindCalendarEvents(container);
    };

    // --- 2. 주간 뷰 (Week) ---
    const renderWeekView = (container) => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const date = currentDate.getDate();
        const day = currentDate.getDay();
        
        const startOfWeek = new Date(year, month, date - day);
        const nowStr = new Date().toISOString().split('T')[0];
        
        let headerHtml = '<div style="display: flex; border-bottom: 1px solid #e0e0e0; background: #f8f9fa; margin-left: 45px;">';
        const weekDates = [];
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            weekDates.push(dateStr);
            
            const isToday = dateStr === nowStr;
            const color = i === 0 ? '#e74c3c' : (i === 6 ? '#2980b9' : '#34495e');
            headerHtml += `<div style="flex: 1; text-align: center; padding: 8px 4px; font-size: 12px; border-right: 1px solid #e0e0e0; ${isToday ? 'background: #e8f4f8; font-weight:bold;' : ''} color: ${color};">${dayNames[i]} ${d.getDate()}</div>`;
        }
        headerHtml += '</div>';

        // 상단 종일 일정 구역
        let allDaySection = '<div style="display: flex; margin-left: 45px; border-bottom: 1px solid #e0e0e0; background: #fdfefe;">';
        weekDates.forEach(dateStr => {
            const dayEvents = getEventsForDate(dateStr);
            const allDayEvts = dayEvents.filter(e => e.isAllDay || e.startDate !== e.endDate);
            const evtsHtml = allDayEvts.map(e => `<div class="event-badge type-${e.type}" data-id="${e.id}" style="padding:2px 4px; font-size:10px; margin-bottom:2px; cursor:pointer;" title="${escapeHtml(e.title)}">${escapeHtml(e.title)}</div>`).join('');
            allDaySection += `<div style="flex: 1; border-right: 1px solid #e0e0e0; box-sizing: border-box; padding: 2px; min-height: 24px;" class="calendar-cell" data-date="${dateStr}">${evtsHtml}</div>`;
        });
        allDaySection += '</div>';

        // 시간축 및 그리드 생성
        let timeLabels = ''; let gridLines = '';
        for (let i = 0; i < 24; i++) {
            timeLabels += `<div style="height: 60px; position:relative;"><span style="position:absolute; top:-7px; right:8px; font-size:11px; color:#95a5a6;">${i}:00</span></div>`;
            gridLines += `<div class="grid-line-hr"></div>`;
        }

        let gridColumnsHtml = '';
        weekDates.forEach(dateStr => {
            const dayEvents = getEventsForDate(dateStr);
            const timedEvts = dayEvents.filter(e => !e.isAllDay && e.startDate === e.endDate);
            let timedHtml = '';
            timedEvts.forEach(e => {
                const [sH, sM] = e.startTime.split(':').map(Number);
                const [eH, eM] = e.endTime.split(':').map(Number);
                let top = (sH * 60) + sM;
                let height = ((eH * 60) + eM) - top;
                if (height < 20) height = 20;
                const bg = e.type === 'meeting' ? '#9b59b6' : (e.type === 'task' ? '#e67e22' : (e.type === 'holiday' ? '#e74c3c' : '#3498db'));
                timedHtml += `<div class="timed-event-card event-badge type-${e.type}" data-id="${e.id}" style="top: ${top}px; height: ${height}px; background: ${bg}; z-index: 10;" title="${escapeHtml(e.title)}\n${e.startTime}~${e.endTime}"><div style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(e.title)}</div></div>`;
            });
            gridColumnsHtml += `<div class="calendar-cell" style="position: relative; flex: 1; border-right: 1px solid #e0e0e0; min-height: auto; padding: 0;" data-date="${dateStr}">${timedHtml}</div>`;
        });

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; height:100%;">
                ${headerHtml}
                ${allDaySection}
                <div class="time-grid-wrapper">
                    <div class="time-axis">
                        ${timeLabels}
                    </div>
                    <div style="flex: 1; position: relative;">
                        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none;">${gridLines}</div>
                        <div style="display: flex; position: absolute; top: 0; left: 0; right: 0; bottom: 0;">${gridColumnsHtml}</div>
                    </div>
                </div>
            </div>
        `;
        bindCalendarEvents(container);
        const wrapper = container.querySelector('.time-grid-wrapper');
        if (wrapper) wrapper.scrollTop = 9 * 60; // 아침 9시 부근으로 스크롤 이동
    };

    // --- 3. 일간 뷰 (Day) ---
    const renderDayView = (container) => {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        const dayEvents = getEventsForDate(dateStr);
        const allDayEvts = dayEvents.filter(e => e.isAllDay || e.startDate !== e.endDate);
        const timedEvts = dayEvents.filter(e => !e.isAllDay && e.startDate === e.endDate);
        
        let allDayHtml = allDayEvts.map(e => `<div class="event-badge type-${e.type}" data-id="${e.id}" style="padding:4px 8px; font-size:12px; margin-bottom:4px; cursor:pointer;" title="${escapeHtml(e.title)}">[종일] ${escapeHtml(e.title)}</div>`).join('');
        
        let timeLabels = ''; let gridLines = '';
        for(let i=0; i<24; i++) {
            timeLabels += `<div style="height: 60px; position:relative;"><span style="position:absolute; top:-7px; right:8px; font-size:11px; color:#95a5a6;">${i}:00</span></div>`;
            gridLines += `<div class="grid-line-hr"></div>`;
        }

        let timedHtml = '';
        
        const processedEvts = calculateOverlap(timedEvts);
        
        processedEvts.forEach(e => {
            let top = e.startMin;
            let height = e.endMin - top;
            if (height < 20) height = 20;
            const left = (e.colIdx / e.numCols) * 100;
            const width = (1 / e.numCols) * 100;
            const bg = e.type === 'meeting' ? '#9b59b6' : (e.type === 'task' ? '#e67e22' : (e.type === 'holiday' ? '#e74c3c' : '#3498db'));
            timedHtml += `<div class="timed-event-card event-badge type-${e.type}" data-id="${e.id}" style="top: ${top}px; height: ${height}px; left: calc(${left}% + 1px); width: calc(${width}% - 2px); background: ${bg}; z-index: 10;" title="${escapeHtml(e.title)}\n${e.startTime}~${e.endTime}"><div style="font-weight:bold;">${escapeHtml(e.title)}</div><div style="font-size:9px; opacity:0.8;">${e.startTime}~${e.endTime}</div></div>`;
        });

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; height:100%;">
                <div style="padding: 10px; display: flex; flex-direction: column; gap: 5px;">
                    <button id="addEventTodayBtn" data-date="${dateStr}" style="background: #27ae60; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 18px;">add</span> 이 날짜에 새 일정 추가</button>
                </div>
                ${allDayEvts.length > 0 ? `<div class="allday-container" style="margin-left: 45px; border-left: 1px solid #e0e0e0;">${allDayHtml}</div>` : ''}
                <div class="time-grid-wrapper">
                    <div class="time-axis">
                        <div style="height: 30px;"></div>
                        ${timeLabels}
                    </div>
                    <div style="flex: 1; position: relative;">
                        <div style="position: absolute; top: 30px; left: 0; right: 0; bottom: 0; pointer-events: none;">${gridLines}</div>
                        <div class="calendar-cell" style="position: absolute; top: 30px; left: 0; right: 0; bottom: 0; padding: 0; border: none;" data-date="${dateStr}">
                            ${timedHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        bindCalendarEvents(container);
        container.querySelector('#addEventTodayBtn').addEventListener('click', (e) => openModal(e.target.dataset.date));
        const wrapper = container.querySelector('.time-grid-wrapper');
        if (wrapper) wrapper.scrollTop = 9 * 60 - 20;
    };

    // --- 4. 연간 뷰 (Year) ---
    const renderYearView = (container) => {
        const year = currentDate.getFullYear();
        let html = '<div class="year-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 10px;">';
        
        for (let m = 0; m < 12; m++) {
            const monthPrefix = `${year}-${String(m + 1).padStart(2, '0')}`;
            const monthEvents = schedules.filter(s => s.date.startsWith(monthPrefix));
            
            const isCurrentMonth = (year === new Date().getFullYear() && m === new Date().getMonth());
            const bg = isCurrentMonth ? '#e8f4f8' : '#f8f9fa';
            const border = isCurrentMonth ? '1px solid #3498db' : '1px solid #eee';
            
            html += `
                <div class="year-month-card" data-month="${m}" style="background: ${bg}; border: ${border}; border-radius: 8px; padding: 25px 10px; text-align: center; cursor: pointer; transition: transform 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05);" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                    <div style="font-size: 18px; font-weight: bold; color: #2c3e50; margin-bottom: 8px;">${m + 1}월</div>
                    <div style="font-size: 12px; color: ${monthEvents.length > 0 ? '#2980b9' : '#95a5a6'}; font-weight: ${monthEvents.length > 0 ? 'bold' : 'normal'};">
                        ${monthEvents.length > 0 ? `일정 ${monthEvents.length}건` : '일정 없음'}
                    </div>
                </div>
            `;
        }
        html += '</div>';
        container.innerHTML = html;
        
        container.querySelectorAll('.year-month-card').forEach(card => {
            card.addEventListener('click', (e) => {
                currentDate = new Date(year, parseInt(e.currentTarget.dataset.month), 1);
                currentTabIndex = 2; // 클릭하면 '월' 탭으로 자동 이동
                subTabButtons.forEach(b => b.classList.remove('active'));
                subTabButtons[currentTabIndex].classList.add('active');
                renderView();
            });
        });
    };

    // 공통 셀 클릭 이벤트 바인딩
    const bindCalendarEvents = (container) => {
        container.querySelectorAll('.calendar-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                if (e.target.closest('.event-badge')) return; // 일정 배지를 클릭했을 땐 무시
                openModal(cell.dataset.date);
            });
        });
        container.querySelectorAll('.event-badge').forEach(badge => {
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                openModal(null, badge.dataset.id);
            });
        });
    };

    const generateCellHtml = (dateStr, day, isOtherMonth, dayOfWeek, isToday = false) => {
        const cellClasses = ['calendar-cell'];
        if (isOtherMonth) cellClasses.push('other-month');
        if (isToday) cellClasses.push('today');
        if (dayOfWeek === 0) cellClasses.push('sun');
        if (dayOfWeek === 6) cellClasses.push('sat');

        const dayEvents = getEventsForDate(dateStr);
        let eventsHtml = '';
        dayEvents.forEach(evt => {
            eventsHtml += `<div class="event-badge type-${evt.type}" data-id="${evt.id}" title="${escapeHtml(evt.title)}">${escapeHtml(evt.title)}</div>`;
        });

        return `
            <div class="${cellClasses.join(' ')}" data-date="${dateStr}">
                <div style="text-align: center;"><span class="calendar-date">${day}</span></div>
                ${eventsHtml}
            </div>
        `;
    };

    // 나드 위치 설정 버튼 이벤트
    document.getElementById('eventSetLocationBtn').addEventListener('click', () => {
        document.getElementById('eventSetLocationBtn').style.display = 'none';
        document.getElementById('eventLocationDisplay').style.display = 'none';
        document.getElementById('eventParentId').style.display = 'block';
    });

    // 모달창 제어 로직
    const openModal = (dateStr = null, eventId = null, defaultStartTime = null, defaultEndTime = null) => {
        const modal = document.getElementById('eventModal');
        const titleEl = document.getElementById('eventModalTitle');
        
        const isAllDayChk = document.getElementById('eventIsAllDay');
        const stDateInput = document.getElementById('eventStartDate');
        const stTimeInput = document.getElementById('eventStartTime');
        const edDateInput = document.getElementById('eventEndDate');
        const edTimeInput = document.getElementById('eventEndTime');
        
        const titleInput = document.getElementById('eventTitle');
        const typeInput = document.getElementById('eventType');
        const memoInput = document.getElementById('eventMemo');
        const deleteBtn = document.getElementById('deleteEventBtn');
        
        const parentSelect = document.getElementById('eventParentId');
        const locationDisplay = document.getElementById('eventLocationDisplay');
        const setLocBtn = document.getElementById('eventSetLocationBtn');

        editEventId = eventId;

        // 이벤트 리스너 중복 방지 처리
        if (!isAllDayChk.dataset.init) {
            isAllDayChk.dataset.init = "true";
            isAllDayChk.addEventListener('change', (e) => {
                stTimeInput.style.display = e.target.checked ? 'none' : 'block';
                edTimeInput.style.display = e.target.checked ? 'none' : 'block';
            });
            
            stDateInput.addEventListener('change', (e) => {
                if(edDateInput.value < e.target.value) edDateInput.value = e.target.value;
            });
            
            stTimeInput.addEventListener('change', (e) => {
                if(stDateInput.value === edDateInput.value && edTimeInput.value < e.target.value) {
                    let [h, m] = e.target.value.split(':').map(Number);
                    h = (h + 1) % 24;
                    edTimeInput.value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                }
            });
        }
        
        // 나드 트리 폴더 목록 가져오기
        parentSelect.style.display = 'none';
        locationDisplay.style.display = 'block';
        setLocBtn.style.display = 'block';
        
        let optionsHtml = '<option value="nard_quick_root">⚡ 빠른 나드 (기본)</option>';
        const secretKey = auth.currentUser.uid;
        nardTreeCache.forEach(n => {
            if (n.id !== 'nard_quick_root' && n.id !== 'nard_shared_root') {
                let decTitle = n.title;
                if (n.isEncrypted) {
                    try { decTitle = CryptoJS.AES.decrypt(n.title, secretKey).toString(CryptoJS.enc.Utf8); } catch(e){}
                }
                optionsHtml += `<option value="${n.id}">📁 ${escapeHtml(decTitle || '제목 없음')}</option>`;
            }
        });
        parentSelect.innerHTML = optionsHtml;

        if (eventId) {
            const evt = schedules.find(s => s.id === eventId);
            if (evt) {
                titleEl.textContent = '일정 수정';
                titleInput.value = evt.title;
                
                isAllDayChk.checked = evt.isAllDay;
                stDateInput.value = evt.startDate;
                stTimeInput.value = evt.startTime || '09:00';
                edDateInput.value = evt.endDate;
                edTimeInput.value = evt.endTime || '10:00';
                stTimeInput.style.display = evt.isAllDay ? 'none' : 'block';
                edTimeInput.style.display = evt.isAllDay ? 'none' : 'block';

                typeInput.value = evt.type || 'basic';
                memoInput.value = evt.memo || '';
                parentSelect.value = evt.parentId || 'nard_quick_root';
                locationDisplay.textContent = parentSelect.options[parentSelect.selectedIndex]?.text || '⚡ 빠른 나드 (기본)';
                deleteBtn.style.display = 'block';
            }
        } else {
            titleEl.textContent = '새 일정 추가';
            titleInput.value = '';
            
            isAllDayChk.checked = !defaultStartTime; // 시간이 주어지면 종일 일정 체크 해제
            stDateInput.value = dateStr || new Date().toISOString().split('T')[0];
            stTimeInput.value = defaultStartTime || '09:00';
            edDateInput.value = dateStr || new Date().toISOString().split('T')[0];
            edTimeInput.value = defaultEndTime || '10:00';
            stTimeInput.style.display = defaultStartTime ? 'block' : 'none';
            edTimeInput.style.display = defaultStartTime ? 'block' : 'none';

            typeInput.value = 'basic';
            memoInput.value = '';
            parentSelect.value = 'nard_quick_root';
            locationDisplay.textContent = '⚡ 빠른 나드 (기본)';
            deleteBtn.style.display = 'none';
        }

        modal.style.display = 'flex';
        setTimeout(() => titleInput.focus(), 100);
    };

    // 상단 화살표 이동 버튼 로직 (탭에 따라 증감 단위 다름)
    document.getElementById('prevMonthBtn').addEventListener('click', () => {
        const tab = tabIds[currentTabIndex];
        if (tab === 'day') currentDate.setDate(currentDate.getDate() - 1);
        else if (tab === 'week') currentDate.setDate(currentDate.getDate() - 7);
        else if (tab === 'month') currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        else if (tab === 'year') currentDate = new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1);
        renderView();
    });
    document.getElementById('nextMonthBtn').addEventListener('click', () => {
        const tab = tabIds[currentTabIndex];
        if (tab === 'day') currentDate.setDate(currentDate.getDate() + 1);
        else if (tab === 'week') currentDate.setDate(currentDate.getDate() + 7);
        else if (tab === 'month') currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        else if (tab === 'year') currentDate = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1);
        renderView();
    });

    // 오늘 버튼 이벤트
    document.getElementById('todayBtn').addEventListener('click', () => {
        currentDate = new Date();
        renderView();
    });

    // 월 이동 모달 이벤트
    const jumpModal = document.getElementById('jumpModal');
    const jumpYearSelect = document.getElementById('jumpYearSelect');
    const jumpMonthSelect = document.getElementById('jumpMonthSelect');

    // 연도 옵션 채우기 (현재 연도 기준 +- 10년)
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 10; i <= currentYear + 10; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
        jumpYearSelect.appendChild(opt);
    }

    document.getElementById('monthYearDisplayBtn').addEventListener('click', () => {
        jumpYearSelect.value = currentDate.getFullYear();
        jumpMonthSelect.value = currentDate.getMonth();
        jumpModal.style.display = 'flex';
    });

    document.getElementById('cancelJumpBtn').addEventListener('click', () => {
        jumpModal.style.display = 'none';
    });

    document.getElementById('confirmJumpBtn').addEventListener('click', () => {
        const year = parseInt(jumpYearSelect.value);
        const month = parseInt(jumpMonthSelect.value);
        const tab = tabIds[currentTabIndex];
        
        // 일/주간 뷰인 경우 기존 '일(Date)' 정보를 유지, 월/년 뷰인 경우 1일로 초기화
        if (tab === 'day' || tab === 'week') {
            const d = currentDate.getDate();
            currentDate = new Date(year, month, d);
        } else {
            currentDate = new Date(year, month, 1);
        }
        renderView();
        jumpModal.style.display = 'none';
    });

    // 모달창 저장/삭제/취소 버튼 이벤트
    document.getElementById('cancelEventBtn').addEventListener('click', () => {
        document.getElementById('eventModal').style.display = 'none';
    });

    document.getElementById('saveEventBtn').addEventListener('click', async () => {
        const title = document.getElementById('eventTitle').value.trim();
        
        const isAllDay = document.getElementById('eventIsAllDay').checked;
        const startDate = document.getElementById('eventStartDate').value;
        const startTime = document.getElementById('eventStartTime').value || '09:00';
        const endDate = document.getElementById('eventEndDate').value;
        const endTime = document.getElementById('eventEndTime').value || '10:00';

        const type = document.getElementById('eventType').value;
        const memo = document.getElementById('eventMemo').value.trim();
        const parentId = document.getElementById('eventParentId').value || 'nard_quick_root';

        if (!startDate || !title) return alert('시작 날짜와 일정 제목을 입력해주세요.');
        if (startDate > endDate) return alert('종료 날짜가 시작 날짜보다 빠를 수 없습니다.');
        if (!isAllDay && startDate === endDate && startTime > endTime) return alert('종료 시간이 시작 시간보다 빠를 수 없습니다.');

        const btn = document.getElementById('saveEventBtn');
        btn.disabled = true; btn.textContent = '저장 중...';

        const targetId = editEventId || ('evt_' + Date.now());
        const secretKey = auth.currentUser.uid;
        const existingIdx = nardTreeCache.findIndex(n => n.id === targetId);

        let finalTitle = title;
        let finalMemo = memo;
        let isEncrypted = false;
        
        // 기존 나드가 암호화되어 있었다면 동일하게 암호화 유지
        if (existingIdx > -1 && nardTreeCache[existingIdx].isEncrypted) {
            finalTitle = CryptoJS.AES.encrypt(title, secretKey).toString();
            finalMemo = memo ? CryptoJS.AES.encrypt(memo, secretKey).toString() : '';
            isEncrypted = true;
        }

        const nardItem = {
            id: targetId,
            parentId: parentId,
            title: finalTitle,
            content: finalMemo,
            dueDate: startDate, // 과거 버전 호환 유지용
            startDate: startDate,
            startTime: isAllDay ? '' : startTime,
            endDate: endDate,
            endTime: isAllDay ? '' : endTime,
            isAllDay: isAllDay,
            scheduleType: type,
            updatedAt: Date.now(),
            isEncrypted: isEncrypted
        };

        if (existingIdx > -1) {
            nardTreeCache[existingIdx] = { ...nardTreeCache[existingIdx], ...nardItem };
        } else {
            nardItem.createdAt = Date.now();
            nardItem.isFavorite = false;
            nardTreeCache.push(nardItem);
        }

        try {
            await updateDoc(doc(db, "users", auth.currentUser.uid), { nardTree: nardTreeCache });
            await loadSchedules();
            document.getElementById('eventModal').style.display = 'none';
            renderView();
        } catch (error) {
            console.error("일정 저장 실패:", error);
            alert("저장 중 오류가 발생했습니다.");
        } finally {
            btn.disabled = false; btn.textContent = '저장';
        }
    });

    document.getElementById('deleteEventBtn').addEventListener('click', async () => {
        if (confirm('이 일정을 정말 삭제하시겠습니까?\n(해당 일정과 연결된 하위 나드들도 함께 삭제됩니다)')) {
            const idsToDelete = new Set([editEventId]);
            const findChildren = (pId) => { nardTreeCache.forEach(m => { if (m.parentId === pId && !idsToDelete.has(m.id)) { idsToDelete.add(m.id); findChildren(m.id); } }); };
            findChildren(editEventId);
            nardTreeCache = nardTreeCache.filter(m => !idsToDelete.has(m.id));
            
            try {
                await updateDoc(doc(db, "users", auth.currentUser.uid), { nardTree: nardTreeCache });
                await loadSchedules();
                document.getElementById('eventModal').style.display = 'none';
                renderView();
            } catch (error) {
                console.error("삭제 실패:", error);
                alert("삭제 중 오류가 발생했습니다.");
            }
        }
    });

    // 서브 탭 클릭 이벤트 등록
    subTabButtons = container.querySelectorAll('.sub-tab-btn');
    subTabButtons.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            currentTabIndex = parseInt(e.currentTarget.dataset.idx);
            subTabButtons.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            renderView();
            e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    });

    // 시작 시 데이터 로드 후 렌더링 (초기 탭은 '월')
    await loadSchedules();
    subTabButtons.forEach(b => b.classList.remove('active'));
    const activeBtn = subTabButtons[currentTabIndex];
    activeBtn.classList.add('active');
    renderView();
};