import { auth, escapeHtml } from "../js/main.js";
import CryptoJS from "https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/+esm";
import { state, loadSchedules, saveSchedules } from "./schedule/store.js";
import { renderMonthView, renderWeekView, renderDayView, renderYearView } from "./schedule/views.js";

const tabIds = ['day', 'week', 'month', 'year'];
let subTabButtons = null;
let lastReclickTime = 0;

export const onReclick = () => {
    if (!subTabButtons) return;
    const now = Date.now();
    if (now - lastReclickTime < 300) return; 
    lastReclickTime = now;
    state.currentTabIndex = (state.currentTabIndex + 1) % tabIds.length;
    subTabButtons[state.currentTabIndex].click();
};

export const init = async (container) => {
    if (!auth.currentUser) {
        container.innerHTML = '<div style="text-align:center; padding: 50px; color:#7f8c8d;">로그인이 필요합니다.</div>';
        return;
    }

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
            .grid-column { position: relative; flex: 1; height: 1440px; cursor: pointer; box-sizing: border-box; }
            .time-grid-wrapper { display: flex; flex: 1; overflow-y: auto; position: relative; background: white; scroll-behavior: smooth; flex-direction: column; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); -ms-overflow-style: none; scrollbar-width: none; }
            .time-grid-wrapper::-webkit-scrollbar { display: none; }
            .time-axis { width: 45px; min-width: 45px; flex-shrink: 0; border-right: 1px solid #dadce0; background: white; position: relative; z-index: 5; height: 1440px; box-sizing: border-box; }
            .timed-event-card { position: absolute; border-radius: 4px; padding: 4px; font-size: 11px; color: white; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.2); cursor: pointer; line-height: 1.2; border: 1px solid rgba(0,0,0,0.05); box-sizing: border-box; transition: transform 0.1s; }
            .timed-event-card:hover { filter: brightness(1.05); z-index: 50 !important; transform: scale(1.02); }
            .drag-over { background-color: rgba(52, 152, 219, 0.1) !important; }
            .dragging { opacity: 0.5; }
            
            @media (max-width: 768px) {
                .calendar-cell { min-height: 70px; padding: 2px; }
                .calendar-header-cell { padding: 5px 2px; font-size: 11px; }
                .calendar-date { font-size: 11px; margin-bottom: 2px; padding: 1px 4px; }
                .event-badge { font-size: 9px; padding: 1px 3px; margin-bottom: 1px; }
                .time-axis { width: 35px; font-size: 9px !important; }
            }
            @media (max-width: 500px) {
                .year-grid { grid-template-columns: repeat(2, 1fr) !important; }
            }
        `;
        document.head.appendChild(style);
    }

    let customRecRule = null;
    let previousRecValue = 'none';

    container.innerHTML = `
        <div class="sub-tab-menu">
            <button class="sub-tab-btn" data-tab="day" data-idx="0">일</button>
            <button class="sub-tab-btn" data-tab="week" data-idx="1">주</button>
            <button class="sub-tab-btn active" data-tab="month" data-idx="2">월</button>
            <button class="sub-tab-btn" data-tab="year" data-idx="3">년</button>
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

                <div style="display: flex; gap: 10px; margin-bottom: 15px; align-items: center;" id="recurrenceWrapper">
                    <div style="flex: 1;">
                        <label style="font-size: 12px; color: #7f8c8d; margin-bottom: 5px; display: block; font-weight: bold;">반복 설정</label>
                        <select id="eventRecurrence" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 13px;">
                            <option value="none">반복 안함</option>
                            <option value="daily">매일</option>
                            <option value="weekly">매주</option>
                            <option value="biweekly">격주</option>
                            <option value="monthly">매월</option>
                            <option value="yearly">매년</option>
                            <option value="custom" style="font-weight: bold; color: #2980b9;">사용자 정의...</option>
                        </select>
                        <div id="customRecSummary" style="font-size:11px; color:#2980b9; margin-top:6px; display:none; font-weight:bold; line-height: 1.4;"></div>
                    </div>
                    <div style="flex: 1; display: none;" id="eventRecurrenceEndGroup">
                        <label style="font-size: 12px; color: #7f8c8d; margin-bottom: 5px; display: block; font-weight: bold;">반복 종료일</label>
                        <input type="date" id="eventRecurrenceEnd" style="width: 100%; padding: 10px; margin: 0; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <label style="font-size: 12px; color: #7f8c8d; font-weight: bold; margin: 0;">나드 저장 위치</label>
                    <button id="eventSetLocationBtn" style="background: #f39c12; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">위치 설정</button>
                </div>
                <div id="eventLocationDisplay" style="font-size: 13px; color: #2c3e50; margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px; border: 1px solid #eee; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">⚡ 빠른 나드 (기본)</div>
                <input type="hidden" id="eventParentId">

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

        <!-- 월 이동 모달 -->
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

        <!-- 사용자 정의 반복 모달 -->
        <div id="customRecModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 6500; justify-content: center; align-items: center;">
            <div style="background: white; padding: 25px; border-radius: 12px; width: 90%; max-width: 350px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
                <h3 style="margin-top: 0; margin-bottom: 20px; color: #2c3e50; font-size: 16px;">사용자 정의 반복</h3>
                
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                    <span style="font-size: 13px; color: #34495e; font-weight: bold;">반복 간격:</span>
                    <input type="number" id="crInterval" value="1" min="1" style="width: 60px; padding: 8px; margin: 0; border: 1px solid #ccc; border-radius: 4px; outline: none;">
                    <select id="crFreq" style="padding: 8px; margin: 0; border: 1px solid #ccc; border-radius: 4px; flex: 1; outline: none; font-size: 13px;">
                        <option value="daily">일</option>
                        <option value="weekly">주</option>
                        <option value="monthly">개월</option>
                        <option value="yearly">년</option>
                    </select>
                </div>

                <div id="crWeekDaysGroup" style="display: none; margin-bottom: 20px;">
                    <div style="font-size: 13px; color: #34495e; font-weight: bold; margin-bottom: 8px;">반복 요일:</div>
                    <div style="display: flex; gap: 5px; justify-content: space-between;">
                        ${['일','월','화','수','목','금','토'].map((day, i) => `<label style="cursor:pointer; display:flex; flex-direction:column; align-items:center; font-size:12px; gap:4px;"><input type="checkbox" class="cr-weekday-chk" value="${i}" style="margin:0;"><span>${day}</span></label>`).join('')}
                    </div>
                </div>

                <div style="margin-bottom: 25px;">
                    <div style="font-size: 13px; color: #34495e; font-weight: bold; margin-bottom: 10px;">종료 조건:</div>
                    <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px; color: #2c3e50;">
                        <label style="display:flex; align-items:center; gap:8px; cursor: pointer;"><input type="radio" name="crEndType" value="never" checked style="margin:0;"> 계속 반복 (최대 100회)</label>
                        <label style="display:flex; align-items:center; gap:8px; cursor: pointer;"><input type="radio" name="crEndType" value="date" style="margin:0;"> 날짜 <input type="date" id="crEndDate" style="margin:0; padding:6px; border:1px solid #ccc; border-radius:4px; flex:1;" disabled></label>
                        <label style="display:flex; align-items:center; gap:8px; cursor: pointer;"><input type="radio" name="crEndType" value="count" style="margin:0;"> 횟수 <input type="number" id="crEndCount" value="10" min="1" max="100" style="margin:0; padding:6px; border:1px solid #ccc; border-radius:4px; width:80px;" disabled> 회</label>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button id="crCancelBtn" style="flex: 1; background: #95a5a6; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold;">취소</button>
                    <button id="crSaveBtn" style="flex: 1; background: #2980b9; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold;">완료</button>
                </div>
            </div>
        </div>
        
        <!-- 나드 위치 선택 모달 -->
        <div id="locationSelectModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #f4f6f8; z-index: 7000; flex-direction: column;">
            <div style="background: #ffeaa7; padding: 15px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="display: flex; align-items: center; gap: 8px; color: #d35400; font-weight: bold; font-size: 14px;"><span class="material-symbols-outlined">ads_click</span> 부모 나드로 지정할 항목을 선택하세요.</div>
                <div style="display: flex; gap: 8px;">
                    <button id="locSelectRootBtn" style="background: #27ae60; padding: 6px 12px; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">최상위로 지정</button>
                    <button id="locSelectCancelBtn" style="background: #c0392b; padding: 6px 12px; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">취소</button>
                </div>
            </div>
            <div id="locSelectTreeContainer" style="flex: 1; overflow-y: auto; padding: 20px; background: white;"></div>
        </div>
    `;

    const updateHeaderDisplay = () => {
        const tab = tabIds[state.currentTabIndex];
        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();
        const date = state.currentDate.getDate();
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const displayEl = document.getElementById('monthYearDisplay');
        if (!displayEl) return;
        if (tab === 'day') displayEl.textContent = `${year}년 ${month + 1}월 ${date}일 (${dayNames[state.currentDate.getDay()]})`;
        else if (tab === 'week') {
            const startOfMonth = new Date(year, month, 1);
            const pastDays = date + startOfMonth.getDay() - 1;
            displayEl.textContent = `${year}년 ${month + 1}월 ${Math.ceil(pastDays / 7)}주차`;
        }
        else if (tab === 'month') displayEl.textContent = `${year}년 ${month + 1}월`;
        else if (tab === 'year') displayEl.textContent = `${year}년`;
    };

    const changeTab = (index) => {
        state.currentTabIndex = index;
        subTabButtons.forEach(b => b.classList.remove('active'));
        const activeBtn = subTabButtons[state.currentTabIndex];
        activeBtn.classList.add('active');
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        renderView();
    };

    const bindCalendarEvents = (container) => {
        container.querySelectorAll('.calendar-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                if (e.target.closest('.event-badge')) return;
                openModal(cell.dataset.date);
            });
        });
        container.querySelectorAll('.event-badge').forEach(badge => {
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                openModal(null, badge.dataset.id);
            });
            
            // 드래그 앤 드롭 시작
            badge.setAttribute('draggable', 'true');
            badge.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                e.dataTransfer.setData('text/plain', badge.dataset.id);
                setTimeout(() => badge.style.opacity = '0.5', 0);
            });
            badge.addEventListener('dragend', (e) => {
                badge.style.opacity = '1';
                container.querySelectorAll('.drag-over').forEach(el => { el.classList.remove('drag-over'); el.style.backgroundColor = ''; });
            });
        });

        // 드롭 대상 (종일/월간 셀)
        container.querySelectorAll('.calendar-cell:not(.grid-column)').forEach(cell => {
            cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drag-over'); });
            cell.addEventListener('dragleave', (e) => { cell.classList.remove('drag-over'); });
            cell.addEventListener('drop', (e) => {
                e.preventDefault(); e.stopPropagation(); cell.classList.remove('drag-over');
                const eventId = e.dataTransfer.getData('text/plain');
                if (eventId) updateEventTime(eventId, cell.dataset.date, null);
            });
        });

        // 드롭 대상 (시간대 그리드 칼럼) 및 클릭 시 새 일정 추가
        container.querySelectorAll('.grid-column').forEach(col => {
            col.addEventListener('click', (e) => {
                if (e.target.closest('.event-badge')) return;
                const rect = col.getBoundingClientRect(); const y = e.clientY - rect.top; const clickedMinute = Math.floor(y);
                const h = Math.floor(clickedMinute / 60); const m = clickedMinute % 60; const roundedM = m < 30 ? 0 : 30;
                const timeStr = `${String(h).padStart(2, '0')}:${String(roundedM).padStart(2, '0')}`;
                const endH = h + 1; const endTimeStr = `${String(endH % 24).padStart(2, '0')}:${String(roundedM).padStart(2, '0')}`;
                openModal(col.dataset.date, null, timeStr, endTimeStr);
            });

            col.addEventListener('dragover', (e) => { e.preventDefault(); col.style.backgroundColor = 'rgba(52, 152, 219, 0.1)'; });
            col.addEventListener('dragleave', (e) => { col.style.backgroundColor = 'transparent'; });
            col.addEventListener('drop', (e) => {
                e.preventDefault(); e.stopPropagation(); col.style.backgroundColor = 'transparent';
                const eventId = e.dataTransfer.getData('text/plain');
                if (eventId) {
                    const rect = col.getBoundingClientRect(); const y = e.clientY - rect.top; const clickedMinute = Math.floor(y);
                    const h = Math.floor(clickedMinute / 60); const m = clickedMinute % 60; const roundedM = m < 30 ? 0 : 30;
                    updateEventTime(eventId, col.dataset.date, h * 60 + roundedM);
                }
            });
        });
    };

    const updateEventTime = async (eventId, newDate, newStartMin = null) => {
        const existingIdx = state.nardTreeCache.findIndex(n => n.id === eventId);
        if (existingIdx > -1) {
            const item = state.nardTreeCache[existingIdx];
            item.dueDate = newDate; item.startDate = newDate; item.endDate = newDate;
            if (newStartMin === null) {
                item.isAllDay = true; item.startTime = ''; item.endTime = '';
            } else {
                const parseTime = (t) => { const [h, m] = (t||'09:00').split(':').map(Number); return h * 60 + m; };
                const startMin = parseTime(item.startTime); const endMin = parseTime(item.endTime);
                let duration = endMin - startMin; if (duration <= 0 || item.isAllDay) duration = 60;
                let newEndMin = newStartMin + duration; if (newEndMin >= 24 * 60) newEndMin = 24 * 60 - 1;
                const formatTime = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
                item.startTime = formatTime(newStartMin); item.endTime = formatTime(newEndMin); item.isAllDay = false;
            }
            item.updatedAt = Date.now();
            try { 
                await saveSchedules(); 
                await loadSchedules(); 
                renderView(); 
            } 
            catch(e) { console.error("시간 변경 실패:", e); }
        }
    };

    const renderView = () => {
        updateHeaderDisplay();
        const content = document.getElementById('scheduleContent');
        const tab = tabIds[state.currentTabIndex];
        const ctx = { bindCalendarEvents, openModal, changeTab };
        if (tab === 'day') renderDayView(content, ctx);
        else if (tab === 'week') renderWeekView(content, ctx);
        else if (tab === 'month') renderMonthView(content, ctx);
        else if (tab === 'year') renderYearView(content, ctx);
    };

    let locCollapsedStates = {};
    const renderLocTree = () => {
        const container = document.getElementById('locSelectTreeContainer');
        const buildTree = (parentId, depth) => {
            const children = state.nardTreeCache.filter(m => m.parentId === parentId);
            if (children.length === 0) return '';
            
            let html = `<ul style="list-style: none; padding-left: ${depth === 0 ? '0' : '20px'}; margin: 0;">`;
            children.forEach(item => {
                if (state.editEventId && item.id === state.editEventId) return;
                const hasChildren = state.nardTreeCache.some(m => m.parentId === item.id);
                const isCollapsed = locCollapsedStates[item.id] !== false && depth !== 0; 
                let decTitle = item.title;
                if (item.isEncrypted) { try { decTitle = CryptoJS.AES.decrypt(item.title, auth.currentUser.uid).toString(CryptoJS.enc.Utf8); } catch(e){} }
                
                let icon = item.id === 'nard_quick_root' ? 'bolt' : (item.id === 'nard_shared_root' ? 'share' : (item.id.startsWith('nard_bldg_') ? 'domain' : (item.id.startsWith('nard_fac_sub_') ? 'folder' : (item.id.startsWith('nard_fac_item_') ? 'article' : (item.id.startsWith('nard_plaza_item_') ? 'chat_bubble' : (item.id.startsWith('nard_fac_') ? 'handyman' : (item.id.startsWith('nard_plaza_') ? 'forum' : (hasChildren ? (isCollapsed ? 'folder' : 'folder_open') : 'description'))))))));
                let iconColor = '#7f8c8d';
                if (item.id === 'nard_quick_root') iconColor = '#f39c12'; else if (item.id === 'nard_shared_root') iconColor = '#8e44ad';
                
                html += `
                    <li style="margin: 6px 0;">
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: 6px; border: 1px solid #e0e0e0; background: white; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                            <div style="display: flex; align-items: center; gap: 8px; flex: 1; cursor: pointer; overflow: hidden;" class="loc-tree-node" data-id="${item.id}">
                                <span class="material-symbols-outlined" style="color: ${iconColor}; font-size: 20px;">${icon}</span>
                                <span style="font-size: 14px; color: #2c3e50; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(decTitle || '제목 없음')}</span>
                            </div>
                            <button class="loc-select-btn" data-id="${item.id}" data-title="${escapeHtml(decTitle || '제목 없음')}" style="background: transparent; color: #27ae60; border: none; padding: 4px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; transition: background 0.2s;" onmouseover="this.style.background='#eafaf1'" onmouseout="this.style.background='transparent'" title="이 나드의 하위로 지정">
                                <span class="material-symbols-outlined" style="font-size: 24px;">check_circle</span>
                            </button>
                        </div>
                        <div style="display: ${isCollapsed ? 'none' : 'block'}; border-left: 2px solid #ecf0f1; margin-left: 10px; margin-top: 6px;">
                            ${buildTree(item.id, depth + 1)}
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
            return html;
        };
        container.innerHTML = buildTree(null, 0) || '<div style="text-align: center; color: #7f8c8d; padding: 20px;">항목이 없습니다.</div>';
        
        container.querySelectorAll('.loc-tree-node').forEach(node => {
            node.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                locCollapsedStates[id] = locCollapsedStates[id] === false ? true : false;
                renderLocTree();
            });
        });
        
        container.querySelectorAll('.loc-select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.getElementById('eventParentId').value = e.currentTarget.dataset.id;
                document.getElementById('eventLocationDisplay').innerHTML = `📁 ${e.currentTarget.dataset.title}`;
                document.getElementById('locationSelectModal').style.display = 'none';
            });
        });
    };

    document.getElementById('eventSetLocationBtn').addEventListener('click', () => {
        document.getElementById('locationSelectModal').style.display = 'flex';
        locCollapsedStates = {};
        renderLocTree();
    });
    document.getElementById('locSelectRootBtn').addEventListener('click', () => { document.getElementById('eventParentId').value = 'nard_quick_root'; document.getElementById('eventLocationDisplay').textContent = '⚡ 빠른 나드 (기본)'; document.getElementById('locationSelectModal').style.display = 'none'; });
    document.getElementById('locSelectCancelBtn').addEventListener('click', () => document.getElementById('locationSelectModal').style.display = 'none');

    const openModal = (dateStr = null, eventId = null, defaultStartTime = null, defaultEndTime = null) => {
        const modal = document.getElementById('eventModal');
        const isAllDayChk = document.getElementById('eventIsAllDay');
        const stDateInput = document.getElementById('eventStartDate'); const stTimeInput = document.getElementById('eventStartTime');
        const edDateInput = document.getElementById('eventEndDate'); const edTimeInput = document.getElementById('eventEndTime');
        const titleInput = document.getElementById('eventTitle');
        const typeInput = document.getElementById('eventType'); const memoInput = document.getElementById('eventMemo');
        const parentInput = document.getElementById('eventParentId');
        
        state.editEventId = eventId;

        if (!isAllDayChk.dataset.init) {
            isAllDayChk.dataset.init = "true";
            isAllDayChk.addEventListener('change', (e) => { stTimeInput.style.display = e.target.checked ? 'none' : 'block'; edTimeInput.style.display = e.target.checked ? 'none' : 'block'; });
            stDateInput.addEventListener('change', (e) => { if(edDateInput.value < e.target.value) edDateInput.value = e.target.value; });
            stTimeInput.addEventListener('change', (e) => {
                if(stDateInput.value === edDateInput.value && edTimeInput.value < e.target.value) {
                    let [h, m] = e.target.value.split(':').map(Number);
                    edTimeInput.value = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                }
            });
        }
        
        const recSelect = document.getElementById('eventRecurrence');
        const recEndGroup = document.getElementById('eventRecurrenceEndGroup');
        const recEndInput = document.getElementById('eventRecurrenceEnd');
        const recWrapper = document.getElementById('recurrenceWrapper');

        // --- 사용자 정의 반복 모달 제어 로직 ---
        const crFreq = document.getElementById('crFreq');
        const crWeekDaysGroup = document.getElementById('crWeekDaysGroup');
        const crEndRadios = document.getElementsByName('crEndType');
        const crEndDate = document.getElementById('crEndDate');
        const crEndCount = document.getElementById('crEndCount');
        const customRecModal = document.getElementById('customRecModal');
        const customRecSummary = document.getElementById('customRecSummary');

        if (!crFreq.dataset.init) {
            crFreq.dataset.init = "true";
            crFreq.addEventListener('change', (e) => { crWeekDaysGroup.style.display = e.target.value === 'weekly' ? 'flex' : 'none'; });
            crEndRadios.forEach(r => r.addEventListener('change', (e) => {
                crEndDate.disabled = e.target.value !== 'date';
                crEndCount.disabled = e.target.value !== 'count';
            }));

            document.getElementById('crCancelBtn').addEventListener('click', () => {
                customRecModal.style.display = 'none';
                recSelect.value = previousRecValue;
            });

            document.getElementById('crSaveBtn').addEventListener('click', () => {
                const interval = parseInt(document.getElementById('crInterval').value) || 1;
                const freq = crFreq.value;
                const endType = document.querySelector('input[name="crEndType"]:checked').value;
                const endValue = endType === 'date' ? crEndDate.value : (endType === 'count' ? crEndCount.value : null);
                
                let byDay = [];
                if (freq === 'weekly') {
                    document.querySelectorAll('.cr-weekday-chk:checked').forEach(chk => byDay.push(parseInt(chk.value)));
                    if (byDay.length === 0 && stDateInput.value) {
                        const [sy, sm, sd] = stDateInput.value.split('-').map(Number);
                        byDay.push(new Date(sy, sm - 1, sd).getDay());
                    }
                }
                customRecRule = { interval, freq, byDay, endType, endValue };
                
                let summary = `매 ${interval > 1 ? interval + ' ' : ''}`;
                const freqMap = { daily: '일', weekly: '주', monthly: '개월', yearly: '년' };
                summary += freqMap[freq] + '마다';
                if (freq === 'weekly' && byDay.length > 0) {
                    const dayNames = ['일','월','화','수','목','금','토'];
                    summary += ` (${byDay.map(d => dayNames[d]).join(', ')})`;
                }
                if (endType === 'date' && endValue) summary += `, ${endValue} 까지`;
                else if (endType === 'count' && endValue) summary += `, ${endValue}회`;
                else summary += `, 계속`;

                customRecSummary.textContent = summary; customRecSummary.style.display = 'block';
                customRecModal.style.display = 'none'; recEndGroup.style.display = 'none';
            });
        }

        if (!recSelect.dataset.init) {
            recSelect.dataset.init = "true";
            recSelect.addEventListener('click', () => { previousRecValue = recSelect.value; });
            recSelect.addEventListener('change', (e) => {
                customRecSummary.style.display = 'none';
                if (e.target.value === 'none') {
                    recEndGroup.style.display = 'none';
                    customRecRule = null;
                } else if (e.target.value === 'custom') {
                    recEndGroup.style.display = 'none';
                    customRecModal.style.display = 'flex';
                    if (!crEndDate.value) {
                        const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1);
                        crEndDate.value = nextYear.toISOString().split('T')[0];
                    }
                    if (stDateInput.value && crFreq.value === 'weekly') {
                        const d = new Date(stDateInput.value).getDay();
                        document.querySelectorAll('.cr-weekday-chk').forEach(chk => { chk.checked = parseInt(chk.value) === d; });
                    }
                } else {
                    recEndGroup.style.display = 'block';
                    customRecRule = null;
                    if (!recEndInput.value) {
                        const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1);
                        recEndInput.value = nextYear.toISOString().split('T')[0];
                    }
                }
            });
        }
        
    

        if (eventId) {
            const evt = state.schedules.find(s => s.id === eventId);
            if (evt) {
                document.getElementById('eventModalTitle').textContent = '일정 수정';
                titleInput.value = evt.title; isAllDayChk.checked = evt.isAllDay;
                stDateInput.value = evt.startDate; stTimeInput.value = evt.startTime || '09:00';
                edDateInput.value = evt.endDate; edTimeInput.value = evt.endTime || '10:00';
                stTimeInput.style.display = evt.isAllDay ? 'none' : 'block'; edTimeInput.style.display = evt.isAllDay ? 'none' : 'block';
                typeInput.value = evt.type || 'basic'; memoInput.value = evt.memo || '';
                parentInput.value = evt.parentId || 'nard_quick_root';
                
                let pName = '⚡ 빠른 나드 (기본)';
                if (evt.parentId && evt.parentId !== 'nard_quick_root') {
                    const pNode = state.nardTreeCache.find(n => n.id === evt.parentId);
                    if (pNode) {
                        let decTitle = pNode.title;
                        if (pNode.isEncrypted) try { decTitle = CryptoJS.AES.decrypt(pNode.title, auth.currentUser.uid).toString(CryptoJS.enc.Utf8); } catch(e){}
                        pName = `📁 ${escapeHtml(decTitle || '제목 없음')}`;
                    }
                }
                document.getElementById('eventLocationDisplay').innerHTML = pName;
                document.getElementById('deleteEventBtn').style.display = 'block';
                recWrapper.style.display = 'none'; // 수정 시에는 개별 수정만 지원
                customRecSummary.style.display = 'none';
            }
        } else {
            document.getElementById('eventModalTitle').textContent = '새 일정 추가';
            titleInput.value = ''; isAllDayChk.checked = !defaultStartTime;
            stDateInput.value = dateStr || new Date().toISOString().split('T')[0]; stTimeInput.value = defaultStartTime || '09:00';
            edDateInput.value = dateStr || new Date().toISOString().split('T')[0]; edTimeInput.value = defaultEndTime || '10:00';
            stTimeInput.style.display = defaultStartTime ? 'block' : 'none'; edTimeInput.style.display = defaultStartTime ? 'block' : 'none';
            typeInput.value = 'basic'; memoInput.value = ''; parentInput.value = 'nard_quick_root';
            document.getElementById('eventLocationDisplay').textContent = '⚡ 빠른 나드 (기본)';
            document.getElementById('deleteEventBtn').style.display = 'none';
            recWrapper.style.display = 'flex';
            recSelect.value = 'none';
            recEndGroup.style.display = 'none';
            customRecSummary.style.display = 'none';
            customRecRule = null;
        }
        modal.style.display = 'flex';
        setTimeout(() => titleInput.focus(), 100);
    };

    document.getElementById('prevMonthBtn').addEventListener('click', () => {
        const tab = tabIds[state.currentTabIndex];
        if (tab === 'day') state.currentDate.setDate(state.currentDate.getDate() - 1);
        else if (tab === 'week') state.currentDate.setDate(state.currentDate.getDate() - 7);
        else if (tab === 'month') state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() - 1, 1);
        else if (tab === 'year') state.currentDate = new Date(state.currentDate.getFullYear() - 1, state.currentDate.getMonth(), 1);
        renderView();
    });
    document.getElementById('nextMonthBtn').addEventListener('click', () => {
        const tab = tabIds[state.currentTabIndex];
        if (tab === 'day') state.currentDate.setDate(state.currentDate.getDate() + 1);
        else if (tab === 'week') state.currentDate.setDate(state.currentDate.getDate() + 7);
        else if (tab === 'month') state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1, 1);
        else if (tab === 'year') state.currentDate = new Date(state.currentDate.getFullYear() + 1, state.currentDate.getMonth(), 1);
        renderView();
    });
    document.getElementById('todayBtn').addEventListener('click', () => { state.currentDate = new Date(); renderView(); });

    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 10; i <= currentYear + 10; i++) {
        document.getElementById('jumpYearSelect').appendChild(new Option(i, i));
    }
    document.getElementById('monthYearDisplayBtn').addEventListener('click', () => {
        document.getElementById('jumpYearSelect').value = state.currentDate.getFullYear();
        document.getElementById('jumpMonthSelect').value = state.currentDate.getMonth();
        document.getElementById('jumpModal').style.display = 'flex';
    });
    document.getElementById('cancelJumpBtn').addEventListener('click', () => document.getElementById('jumpModal').style.display = 'none');
    document.getElementById('confirmJumpBtn').addEventListener('click', () => {
        const y = parseInt(document.getElementById('jumpYearSelect').value); const m = parseInt(document.getElementById('jumpMonthSelect').value);
        const tab = tabIds[state.currentTabIndex];
        if (tab === 'day' || tab === 'week') state.currentDate = new Date(y, m, state.currentDate.getDate());
        else state.currentDate = new Date(y, m, 1);
        renderView(); document.getElementById('jumpModal').style.display = 'none';
    });

    document.getElementById('cancelEventBtn').addEventListener('click', () => document.getElementById('eventModal').style.display = 'none');
    document.getElementById('saveEventBtn').addEventListener('click', async () => {
        const title = document.getElementById('eventTitle').value.trim();
        
        const recType = document.getElementById('eventRecurrence').value;
        
        const isAllDay = document.getElementById('eventIsAllDay').checked;
        const startDate = document.getElementById('eventStartDate').value; const startTime = document.getElementById('eventStartTime').value || '09:00';
        const endDate = document.getElementById('eventEndDate').value; const endTime = document.getElementById('eventEndTime').value || '10:00';
        if (!startDate || !title) return alert('시작 날짜와 일정 제목을 입력해주세요.');
        if (startDate > endDate) return alert('종료 날짜가 시작 날짜보다 빠를 수 없습니다.');
        if (!isAllDay && startDate === endDate && startTime > endTime) return alert('종료 시간이 시작 시간보다 빠를 수 없습니다.');

        const btn = document.getElementById('saveEventBtn'); btn.disabled = true; btn.textContent = '저장 중...';
        const targetId = state.editEventId || ('evt_' + Date.now());
        const existingIdx = state.nardTreeCache.findIndex(n => n.id === targetId);
        let finalTitle = title; let finalMemo = document.getElementById('eventMemo').value.trim(); let isEncrypted = false;
        if (existingIdx > -1 && state.nardTreeCache[existingIdx].isEncrypted) {
            finalTitle = CryptoJS.AES.encrypt(title, auth.currentUser.uid).toString();
            finalMemo = finalMemo ? CryptoJS.AES.encrypt(finalMemo, auth.currentUser.uid).toString() : '';
            isEncrypted = true;
        }

        const itemsToSave = [];
        if (!state.editEventId && recType !== 'none') {
            const [sY, sM, sD] = startDate.split('-').map(Number);
            let currStart = new Date(sY, sM - 1, sD);
            const [eY, eM, eD] = endDate.split('-').map(Number);
            let currEnd = new Date(eY, eM - 1, eD);
            const durationTime = currEnd.getTime() - currStart.getTime();
            
            let safetyCount = 0;
            const maxLimit = 100;
            const recurrenceGroupId = 'recGrp_' + Date.now();
            
            let interval = 1; let freq = recType; let endType = 'date';
            let limitDate = new Date(2099, 11, 31); let limitCount = maxLimit; let byDay = [];

            if (recType === 'custom' && customRecRule) {
                interval = customRecRule.interval; freq = customRecRule.freq; byDay = customRecRule.byDay; endType = customRecRule.endType;
                if (endType === 'date' && customRecRule.endValue) {
                    const [ly, lm, ld] = customRecRule.endValue.split('-').map(Number);
                    limitDate = new Date(ly, lm - 1, ld);
                }
                else if (endType === 'count' && customRecRule.endValue) limitCount = parseInt(customRecRule.endValue);
                else if (endType === 'never') limitCount = maxLimit;
            } else {
                const recEndDateStr = document.getElementById('eventRecurrenceEnd').value;
                if (recEndDateStr) {
                    const [ly, lm, ld] = recEndDateStr.split('-').map(Number);
                    limitDate = new Date(ly, lm - 1, ld);
                }
            }
            limitDate.setHours(23, 59, 59, 999);
            
            while (currStart <= limitDate && safetyCount < limitCount && safetyCount < maxLimit) {
                let shouldSave = true;
                if (freq === 'weekly' && recType === 'custom' && byDay.length > 0) {
                    if (!byDay.includes(currStart.getDay())) {
                        shouldSave = false;
                    }
                }

                if (shouldSave) {
                    const sDate = `${currStart.getFullYear()}-${String(currStart.getMonth() + 1).padStart(2, '0')}-${String(currStart.getDate()).padStart(2, '0')}`;
                    const eDate = `${currEnd.getFullYear()}-${String(currEnd.getMonth() + 1).padStart(2, '0')}-${String(currEnd.getDate()).padStart(2, '0')}`;
                    
                    itemsToSave.push({
                        id: 'evt_' + Date.now() + '_' + safetyCount, parentId: document.getElementById('eventParentId').value || 'nard_quick_root',
                        title: finalTitle, content: finalMemo, dueDate: sDate, startDate: sDate, startTime: isAllDay ? '' : startTime,
                        endDate: eDate, endTime: isAllDay ? '' : endTime, isAllDay, scheduleType: document.getElementById('eventType').value,
                        updatedAt: Date.now(), createdAt: Date.now(), isFavorite: false, isEncrypted, recurrenceGroupId
                    });
                    
                    safetyCount++;
                }

                if (freq === 'daily') { currStart.setDate(currStart.getDate() + interval); }
                else if (freq === 'weekly') { if (recType === 'custom' && byDay.length > 0) { currStart.setDate(currStart.getDate() + 1); if (currStart.getDay() === 0 && interval > 1) currStart.setDate(currStart.getDate() + (interval - 1) * 7); } else { currStart.setDate(currStart.getDate() + (interval * 7)); } }
                else if (freq === 'biweekly') { currStart.setDate(currStart.getDate() + 14); }
                else if (freq === 'monthly') { currStart.setMonth(currStart.getMonth() + interval); }
                else if (freq === 'yearly') { currStart.setFullYear(currStart.getFullYear() + interval); }
                currEnd = new Date(currStart.getTime() + durationTime);
            }
        } else {
            itemsToSave.push({
                id: targetId, parentId: document.getElementById('eventParentId').value || 'nard_quick_root',
                title: finalTitle, content: finalMemo, dueDate: startDate, startDate, startTime: isAllDay ? '' : startTime,
                endDate, endTime: isAllDay ? '' : endTime, isAllDay, scheduleType: document.getElementById('eventType').value,
                updatedAt: Date.now(), isEncrypted, createdAt: existingIdx > -1 ? state.nardTreeCache[existingIdx].createdAt : Date.now(),
                isFavorite: existingIdx > -1 ? state.nardTreeCache[existingIdx].isFavorite : false
            });
        }

        if (existingIdx > -1) state.nardTreeCache[existingIdx] = { ...state.nardTreeCache[existingIdx], ...itemsToSave[0] };
        else state.nardTreeCache.push(...itemsToSave);

        try { await saveSchedules(); await loadSchedules(); document.getElementById('eventModal').style.display = 'none'; renderView(); } 
        catch (error) { console.error("일정 저장 실패:", error); alert("저장 중 오류가 발생했습니다."); } 
        finally { btn.disabled = false; btn.textContent = '저장'; }
    });

    document.getElementById('deleteEventBtn').addEventListener('click', async () => {
        if (confirm('이 일정을 정말 삭제하시겠습니까?\n(해당 일정과 연결된 하위 나드들도 함께 삭제됩니다)')) {
            const idsToDelete = new Set([state.editEventId]);
            const findChildren = (pId) => { state.nardTreeCache.forEach(m => { if (m.parentId === pId && !idsToDelete.has(m.id)) { idsToDelete.add(m.id); findChildren(m.id); } }); };
            findChildren(state.editEventId);
            state.nardTreeCache = state.nardTreeCache.filter(m => !idsToDelete.has(m.id));
            try { await saveSchedules(); await loadSchedules(); document.getElementById('eventModal').style.display = 'none'; renderView(); } 
            catch (error) { console.error("삭제 실패:", error); alert("삭제 중 오류가 발생했습니다."); }
        }
    });

    subTabButtons = container.querySelectorAll('.sub-tab-btn');
    subTabButtons.forEach((btn, index) => btn.addEventListener('click', () => changeTab(index)));
    
    await loadSchedules();
    subTabButtons.forEach(b => b.classList.remove('active'));
    subTabButtons[state.currentTabIndex].classList.add('active');
    renderView();
};