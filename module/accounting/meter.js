import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../../js/main.js";

let currentMeterMonth = '';
let currentMeterTab = 'electric';
let metersData = {};
let sortedRoomsForMeter = [];

const getPrevMonthStr = (monthStr, offset = 1) => {
    let [y, m] = monthStr.split('-').map(Number);
    m -= offset;
    while (m <= 0) {
        m += 12;
        y -= 1;
    }
    return `${y}-${String(m).padStart(2, '0')}`;
};

export const render = async (container) => {
    container.innerHTML = `
        <div class="module-card">
            <div id="meterContent">
                <div style="text-align: center; padding: 20px; color: #7f8c8d;">데이터를 불러오는 중...</div>
            </div>
        </div>
    `;
    await loadMeterManagement();
};

const loadMeterManagement = async () => {
    const bId = localStorage.getItem('selectedBuildingId');
    const meterContent = document.getElementById('meterContent');
    
    if (!bId) {
        meterContent.innerHTML = '<div style="color:#e74c3c; padding: 20px; text-align: center; font-weight: bold;">선택된 건물이 없습니다.<br><span style="font-size:13px; font-weight:normal; color:#7f8c8d;">사이드바의 "건물선택" 메뉴에서 건물을 먼저 선택해주세요.</span></div>';
        return;
    }

    try {
        const docSnap = await getDoc(doc(db, "buildings", bId));
        if (!docSnap.exists()) return;
        
        const bData = docSnap.data();
        metersData = bData.meters || {};
        const roomsList = bData.roomsList || [];
        sortedRoomsForMeter = [...roomsList].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        if (!currentMeterMonth) {
            const now = new Date();
            currentMeterMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }

        renderMeterView();
    } catch (err) {
        console.error(err);
        meterContent.innerHTML = '<div style="color:red; padding: 20px; text-align: center;">데이터를 불러오는 중 오류가 발생했습니다.</div>';
    }
};

const renderMeterView = () => {
    const bId = localStorage.getItem('selectedBuildingId');
    const meterContent = document.getElementById('meterContent');
    if (!meterContent) return;

    if (sortedRoomsForMeter.length === 0) {
        meterContent.innerHTML = '<div style="color:#7f8c8d; padding:20px; text-align:center; background:#f8f9fa; border-radius:8px;">등록된 호실이 없습니다.<br>사이드바의 [건물등록] 메뉴에서 건물의 호실을 먼저 세팅해주세요.</div>';
        return;
    }

    if (!metersData[currentMeterMonth]) {
        metersData[currentMeterMonth] = { status: 'open', electric: {}, water: {}, gas: {} };
    }
    
    const currentData = metersData[currentMeterMonth];
    if (!currentData[currentMeterTab]) currentData[currentMeterTab] = {};
    
    const isFinalized = currentData.status === 'finalized';

    const prev1M = getPrevMonthStr(currentMeterMonth, 1);
    const prev2M = getPrevMonthStr(currentMeterMonth, 2);
    const prev3M = getPrevMonthStr(currentMeterMonth, 3);

    const getMeterVal = (month, type, room) => {
        if (metersData[month] && metersData[month][type] && metersData[month][type][room]) {
            return metersData[month][type][room];
        }
        return null;
    };

    const thBase = 'padding: 10px; border-bottom: 1px solid #bdc3c7; border-right: 1px solid #34495e; position: sticky; top: 0; z-index: 2; background-color: #2c3e50; color: white;';
    const thLast = 'padding: 10px; border-bottom: 1px solid #bdc3c7; position: sticky; top: 0; z-index: 2; background-color: #2c3e50; color: white;';
    const thCol1 = 'padding: 10px; border-bottom: 1px solid #bdc3c7; border-right: 1px solid #34495e; position: sticky; top: 0; left: 0; z-index: 3; background-color: #1a252f; color: white; width: 50px; min-width: 50px; box-sizing: border-box;';
    const thCol2 = 'padding: 10px; border-bottom: 1px solid #bdc3c7; border-right: 2px solid #95a5a6; position: sticky; top: 0; left: 50px; z-index: 3; background-color: #1a252f; color: white; width: 80px; min-width: 80px; box-sizing: border-box; box-shadow: 2px 0 5px rgba(0,0,0,0.1);';
    const tdBase = 'padding: 10px; border-bottom: 1px solid #eee; border-right: 1px solid #eee;';
    const tdLast = 'padding: 10px; border-bottom: 1px solid #eee;';
    const tdCol1 = 'padding: 10px; border-bottom: 1px solid #eee; border-right: 1px solid #eee; position: sticky; left: 0; z-index: 1; background-color: inherit; width: 50px; min-width: 50px; box-sizing: border-box; text-align: center;';
    const tdCol2 = 'padding: 10px; border-bottom: 1px solid #eee; border-right: 2px solid #bdc3c7; position: sticky; left: 50px; z-index: 1; background-color: inherit; font-weight: bold; color: #2980b9; width: 80px; min-width: 80px; box-sizing: border-box; box-shadow: 2px 0 5px rgba(0,0,0,0.05); text-align: center;';

    let rowsHtml = '';
    sortedRoomsForMeter.forEach((room, idx) => {
        const prev1Data = getMeterVal(prev1M, currentMeterTab, room) || {};
        const prev2Data = getMeterVal(prev2M, currentMeterTab, room) || {};
        const prev3Data = getMeterVal(prev3M, currentMeterTab, room) || {};

        const usage1 = Number(prev1Data.usage) || 0;
        const usage2 = Number(prev2Data.usage) || 0;
        const usage3 = Number(prev3Data.usage) || 0;

        let roomData = currentData[currentMeterTab][room];
        if (!roomData) {
            roomData = { prev: prev1Data.current !== undefined ? prev1Data.current : '', current: '', usage: '', note: '' };
            currentData[currentMeterTab][room] = roomData;
        }

        const { prev: rPrev, current: rCurr, usage: rUsage, note: rNote = '' } = roomData;
        const increase = rUsage !== '' && prev1Data.usage !== undefined ? (Number(rUsage) - usage1) : '';
        const increaseStr = increase !== '' ? (increase > 0 ? `+${increase}` : increase) : '-';
        const increaseColor = increase !== '' ? (increase > 0 ? '#e74c3c' : (increase < 0 ? '#27ae60' : '#7f8c8d')) : '#7f8c8d';

        let sum = 0, count = 0;
        if (prev1Data.usage !== undefined) { sum += usage1; count++; }
        if (prev2Data.usage !== undefined) { sum += usage2; count++; }
        if (prev3Data.usage !== undefined) { sum += usage3; count++; }
        
        let avgStr = '-';
        if (rUsage !== '') { sum += Number(rUsage); count++; }
        if (count > 0) { avgStr = (sum / count).toFixed(1); }

        rowsHtml += `
            <tr class="meter-row" data-room="${escapeHtml(room)}" style="background-color: #fff; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f4f6f8'" onmouseout="this.style.backgroundColor='#fff'">
                <td style="${tdCol1}">${idx + 1}</td>
                <td style="${tdCol2}">${escapeHtml(room)}</td>
                <td style="${tdBase} text-align:right;">${isFinalized ? escapeHtml(rPrev) : `<input type="number" class="m-prev" value="${escapeHtml(rPrev)}" style="width:70px; margin:0; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px; text-align:right; box-sizing:border-box;">`}</td>
                <td style="${tdBase} text-align:right; background:#e8f4f8;">${isFinalized ? escapeHtml(rCurr) : `<input type="number" class="m-curr" value="${escapeHtml(rCurr)}" style="width:70px; margin:0; padding:6px; font-size:12px; border:1px solid #3498db; border-radius:4px; text-align:right; box-sizing:border-box; font-weight:bold; color:#2980b9;">`}</td>
                <td style="${tdBase} text-align:right; font-weight:bold; color:#2c3e50;" class="m-usage-disp">${rUsage !== '' ? escapeHtml(rUsage) : '-'}</td>
                <td style="${tdBase} text-align:right; color:${increaseColor}; font-weight:bold;" class="m-inc-disp">${increaseStr}</td>
                <td style="${tdBase} text-align:right; color:#7f8c8d;" class="m-avg-disp">${avgStr}</td>
                <td style="${tdLast} text-align:left;">${isFinalized ? escapeHtml(rNote) : `<input type="text" class="m-note" value="${escapeHtml(rNote)}" placeholder="메모" style="width:100%; min-width: 80px; margin:0; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;">`}</td>
            </tr>
        `;
    });

    const getMeterTabStyle = (type) => `background:none; border:none; padding:8px 16px; color:${currentMeterTab === type ? '#2980b9' : '#bdc3c7'}; font-weight:${currentMeterTab === type ? 'bold' : 'normal'}; border-bottom:${currentMeterTab === type ? '3px solid #2980b9' : '3px solid transparent'}; cursor:pointer; font-size:15px; flex:1; transition: 0.2s;`;
    const meterTabIcons = { 'electric': '⚡ 전기', 'water': '💧 수도', 'gas': '🔥 가스' };

    meterContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; background:#f8f9fa; padding:10px 15px; border-radius:8px; border:1px solid #e0e0e0;">
            <button id="prevMeterMonthBtn" style="background:none; border:none; color:#2c3e50; cursor:pointer; padding:5px; border-radius: 50%;"><span class="material-symbols-outlined" style="vertical-align:middle;">chevron_left</span></button>
            <div style="font-size:16px; font-weight:bold; color:#2c3e50; display:flex; align-items:center; gap:8px;">${currentMeterMonth} 검침 기록 ${isFinalized ? '<span style="font-size:12px; background:#27ae60; color:white; padding:2px 8px; border-radius:12px;">확정됨</span>' : '<span style="font-size:12px; background:#f39c12; color:white; padding:2px 8px; border-radius:12px;">입력중</span>'}</div>
            <button id="nextMeterMonthBtn" style="background:none; border:none; color:#2c3e50; cursor:pointer; padding:5px; border-radius: 50%;"><span class="material-symbols-outlined" style="vertical-align:middle;">chevron_right</span></button>
        </div>

        <div style="display:flex; border-bottom:1px solid #e0e0e0; margin-bottom:15px; text-align: center;">
            <button class="meter-tab-btn" data-type="electric" style="${getMeterTabStyle('electric')}">${meterTabIcons['electric']}</button>
            <button class="meter-tab-btn" data-type="water" style="${getMeterTabStyle('water')}">${meterTabIcons['water']}</button>
            <button class="meter-tab-btn" data-type="gas" style="${getMeterTabStyle('gas')}">${meterTabIcons['gas']}</button>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="display:flex; gap:8px;">
                ${isFinalized ? '' : `
                    <button id="downloadCsvBtn" style="background:#8e44ad; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;" title="엑셀 양식 다운로드"><span class="material-symbols-outlined" style="font-size:20px;">download</span></button>
                    <button id="uploadCsvBtn" style="background:#d35400; color:white; border:none; padding:8px; border-radius:4px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;" title="엑셀(CSV) 업로드"><span class="material-symbols-outlined" style="font-size:20px;">upload</span></button>
                    <input type="file" id="csvFileInput" accept=".csv" style="display:none;">
                `}
            </div>
            <div style="text-align:right;">
                ${isFinalized ? 
                    `<button id="unfinalizeMeterBtn" style="background:#e74c3c; color:white; border:none; padding:8px 12px; border-radius:4px; font-size:13px; cursor:pointer; font-weight:bold; display:inline-flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:16px;">edit</span> 수정 모드로 전환</button>` : 
                    `<div style="display:flex; justify-content:flex-end; gap:8px;">
                        <button id="saveMeterBtn" style="background:#95a5a6; color:white; border:none; padding:8px 16px; border-radius:4px; font-size:13px; cursor:pointer; font-weight:bold;">임시 저장</button>
                        <button id="finalizeMeterBtn" style="background:#27ae60; color:white; border:none; padding:8px 16px; border-radius:4px; font-size:13px; cursor:pointer; font-weight:bold; display:inline-flex; align-items:center; gap:4px;"><span class="material-symbols-outlined" style="font-size:16px;">task_alt</span> 당월 확정</button>
                     </div>`
                }
            </div>
        </div>

        <div style="overflow: auto; max-height: 500px; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); position: relative;">
            <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px; white-space: nowrap;">
                <thead><tr><th style="${thCol1}">No</th><th style="${thCol2}">호수</th><th style="${thBase}">이전달 지침</th><th style="${thBase}">당월 지침</th><th style="${thBase}">사용량</th><th style="${thBase}">전월 증감</th><th style="${thBase}">3개월 평균</th><th style="${thLast}">비고</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
    `;

    document.getElementById('prevMeterMonthBtn').addEventListener('click', () => { currentMeterMonth = getPrevMonthStr(currentMeterMonth, 1); renderMeterView(); });
    document.getElementById('nextMeterMonthBtn').addEventListener('click', () => { currentMeterMonth = getPrevMonthStr(currentMeterMonth, -1); renderMeterView(); });
    meterContent.querySelectorAll('.meter-tab-btn').forEach(btn => { btn.addEventListener('click', (e) => { currentMeterTab = e.currentTarget.dataset.type; renderMeterView(); }); });

    if (!isFinalized) {
        meterContent.querySelectorAll('.meter-row').forEach(row => {
            const prevInput = row.querySelector('.m-prev');
            const currInput = row.querySelector('.m-curr');
            const usageDisp = row.querySelector('.m-usage-disp');
            const incDisp = row.querySelector('.m-inc-disp');
            const avgDisp = row.querySelector('.m-avg-disp');
            const roomName = row.dataset.room;

            const prev1Data = getMeterVal(prev1M, currentMeterTab, roomName) || {};
            const prev2Data = getMeterVal(prev2M, currentMeterTab, roomName) || {};
            const prev3Data = getMeterVal(prev3M, currentMeterTab, roomName) || {};

            const recalc = () => {
                const pVal = prevInput.value, cVal = currInput.value;
                if (pVal !== '' && cVal !== '') {
                    const usage = Number(cVal) - Number(pVal);
                    usageDisp.textContent = usage;
                    const increase = prev1Data.usage !== undefined ? usage - (Number(prev1Data.usage) || 0) : '';
                    incDisp.textContent = increase !== '' ? (increase > 0 ? `+${increase}` : increase) : '-';
                    incDisp.style.color = increase !== '' ? (increase > 0 ? '#e74c3c' : (increase < 0 ? '#27ae60' : '#7f8c8d')) : '#7f8c8d';
                    let sum = usage, count = 1;
                    if (prev1Data.usage !== undefined) { sum += Number(prev1Data.usage); count++; }
                    if (prev2Data.usage !== undefined) { sum += Number(prev2Data.usage); count++; }
                    if (prev3Data.usage !== undefined) { sum += Number(prev3Data.usage); count++; }
                    avgDisp.textContent = (sum / count).toFixed(1);
                } else {
                    usageDisp.textContent = '-'; incDisp.textContent = '-'; incDisp.style.color = '#7f8c8d';
                    let sum = 0, count = 0;
                    if (prev1Data.usage !== undefined) { sum += Number(prev1Data.usage); count++; }
                    if (prev2Data.usage !== undefined) { sum += Number(prev2Data.usage); count++; }
                    if (prev3Data.usage !== undefined) { sum += Number(prev3Data.usage); count++; }
                    avgDisp.textContent = count > 0 ? (sum / count).toFixed(1) : '-';
                }
            };
            prevInput.addEventListener('input', recalc); currInput.addEventListener('input', recalc);
        });

        document.getElementById('downloadCsvBtn')?.addEventListener('click', () => {
            let csvContent = '\uFEFF호수,이전지침,당월지침,비고\n';
            meterContent.querySelectorAll('.meter-row').forEach(row => {
                const room = row.dataset.room;
                const prev = row.querySelector('.m-prev').value, curr = row.querySelector('.m-curr').value;
                const note = row.querySelector('.m-note').value.replace(/,/g, ' ');
                csvContent += `${room},${prev},${curr},${note}\n`;
            });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
            link.download = `검침양식_${currentMeterMonth}_${currentMeterTab}.csv`;
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
        });

        const uploadCsvBtn = document.getElementById('uploadCsvBtn'), csvFileInput = document.getElementById('csvFileInput');
        if (uploadCsvBtn && csvFileInput) {
            uploadCsvBtn.addEventListener('click', () => csvFileInput.click());
            csvFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    const lines = event.target.result.split('\n'); let successCount = 0;
                    for (let i = 1; i < lines.length; i++) {
                        if (!lines[i].trim()) continue;
                        const cols = lines[i].split(',');
                        if (cols.length >= 3) {
                            const row = meterContent.querySelector(`.meter-row[data-room="${cols[0].trim()}"]`);
                            if (row) {
                                const prevInput = row.querySelector('.m-prev'), currInput = row.querySelector('.m-curr'), noteInput = row.querySelector('.m-note');
                                if (prevInput) { prevInput.value = cols[1].trim(); prevInput.dispatchEvent(new Event('input')); }
                                if (currInput) { currInput.value = cols[2].trim(); currInput.dispatchEvent(new Event('input')); }
                                if (noteInput) { noteInput.value = cols[3] ? cols[3].trim() : ''; }
                                successCount++;
                            }
                        }
                    }
                    alert(`${successCount}개 호실의 데이터가 업로드되었습니다.`); csvFileInput.value = '';
                };
                reader.readAsText(file, 'utf-8');
            });
        }
    }

    const collectData = () => {
        if (isFinalized) return;
        meterContent.querySelectorAll('.meter-row').forEach(row => {
            const room = row.dataset.room, prev = row.querySelector('.m-prev').value, curr = row.querySelector('.m-curr').value;
            let usage = ''; if (prev !== '' && curr !== '') usage = Number(curr) - Number(prev);
            currentData[currentMeterTab][room] = { prev, current: curr, usage, note: row.querySelector('.m-note').value };
        });
    };

    const saveToDB = async (statusMsg) => {
        try {
            await updateDoc(doc(db, "buildings", bId), { meters: metersData });
            if (statusMsg) alert(statusMsg);
            renderMeterView();
        } catch (err) { alert("오류가 발생했습니다."); }
    };

    document.getElementById('saveMeterBtn')?.addEventListener('click', () => { collectData(); saveToDB("임시 저장되었습니다."); });
    document.getElementById('finalizeMeterBtn')?.addEventListener('click', () => {
        if (confirm(`${currentMeterMonth}월 검침 데이터를 확정하시겠습니까?`)) { collectData(); currentData.status = 'finalized'; saveToDB("확정되었습니다!"); }
    });
    document.getElementById('unfinalizeMeterBtn')?.addEventListener('click', () => {
        if (confirm('수정 모드로 전환하시겠습니까?')) { currentData.status = 'open'; saveToDB(); }
    });
};