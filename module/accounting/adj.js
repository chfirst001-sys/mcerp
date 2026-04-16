import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../../js/main.js";

let currentExpenseConfig = {};
let otherExpensesConfig = {};
let currentEditGroupId = null;

export const render = async (container) => {
    const bId = localStorage.getItem('selectedBuildingId');
    
    if (!bId) {
        container.innerHTML = '<div style="color:#e74c3c; padding: 20px; text-align: center; font-weight: bold;">선택된 건물이 없습니다.</div>';
        return;
    }

    container.innerHTML = `
        <div>
            <div style="display:flex; gap:15px; margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px; overflow-x: auto; white-space: nowrap;">
                <button class="adj-sub-btn" data-group="current_bill" style="background:none; border:none; padding:0; color:#2980b9; font-weight:bold; cursor:pointer; font-size:14px;">당월부과</button>
                <button class="adj-sub-btn" data-group="past_records" style="background:none; border:none; padding:0; color:#7f8c8d; cursor:pointer; font-size:14px;">부과기록</button>
                <button class="adj-sub-btn" data-group="fixed" style="background:none; border:none; padding:0; color:#7f8c8d; cursor:pointer; font-size:14px;">고정지출</button>
                <button class="adj-sub-btn" data-group="variable" style="background:none; border:none; padding:0; color:#7f8c8d; cursor:pointer; font-size:14px;">변동지출</button>
                <button class="adj-sub-btn" data-group="periodic" style="background:none; border:none; padding:0; color:#7f8c8d; cursor:pointer; font-size:14px;">주기지출</button>
                <button class="adj-sub-btn" data-group="other_expense" style="background:none; border:none; padding:0; color:#7f8c8d; cursor:pointer; font-size:14px;">기타지출</button>
            </div>
            <div id="adjContent">
                <div style="text-align: center; padding: 20px; color: #7f8c8d;">데이터를 불러오는 중...</div>
            </div>
        </div>

        <!-- 상세 정보 입력 모달 -->
        <div id="expenseModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 4000; justify-content: center; align-items: center;">
            <div style="background: white; padding: 25px; border-radius: 12px; width: 90%; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
                <h3 id="expenseModalTitle" style="margin-top: 0; color: #2c3e50; margin-bottom: 20px;">상세 정보</h3>
                <input type="hidden" id="expItemName">
                
                <label style="font-size: 12px; color: #7f8c8d;">1. 업체명</label>
                <input type="text" id="expCompany" placeholder="예: MC환경" style="margin-bottom: 10px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                
                <label style="font-size: 12px; color: #7f8c8d;">2. 연락처</label>
                <input type="text" id="expContact" placeholder="예: 02-1234-5678" style="margin-bottom: 10px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                
                <label style="font-size: 12px; color: #7f8c8d;">3. 금액</label>
                <input type="text" id="expAmount" placeholder="금액 (원)" style="margin-bottom: 10px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                
                <label style="font-size: 12px; color: #7f8c8d;">4. 납부주기</label>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <input type="number" id="expCycleNum" value="1" style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 0; box-sizing: border-box;">
                    <select id="expCycleUnit" style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                        <option value="개월">개월</option>
                        <option value="년">년</option>
                    </select>
                </div>
                
                <label style="font-size: 12px; color: #7f8c8d;">5. 비고</label>
                <input type="text" id="expNote" placeholder="특이사항 입력" style="margin-bottom: 10px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">

                <label style="font-size: 12px; color: #7f8c8d;">6. 예외 호수</label>
                <input type="text" id="expExceptions" placeholder="예: 101호, 1층" style="margin-bottom: 20px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                
                <div style="display: flex; gap: 10px;">
                    <button id="saveExpModalBtn" style="flex: 1; background: #2980b9; padding: 12px; font-size: 14px;">임시 적용</button>
                    <button id="cancelExpModalBtn" style="flex: 1; background: #95a5a6; padding: 12px; font-size: 14px;">취소</button>
                </div>
            </div>
        </div>

        <!-- 항목 편집 모달 -->
        <div id="editItemsModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 4500; justify-content: center; align-items: center;">
            <div style="background: white; padding: 25px; border-radius: 12px; width: 90%; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex; flex-direction: column; max-height: 80vh;">
                <h3 id="editItemsModalTitle" style="margin-top: 0; color: #2c3e50; margin-bottom: 15px;">항목 추가/삭제</h3>
                <div id="editItemsContainer" style="overflow-y: auto; flex: 1; margin-bottom: 15px; padding-right: 5px;"></div>
                <div style="display: flex; gap: 10px;">
                    <button id="saveEditItemsBtn" style="flex: 1; background: #27ae60; padding: 12px; font-size: 14px; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">저장</button>
                    <button id="cancelEditItemsBtn" style="flex: 1; background: #95a5a6; padding: 12px; font-size: 14px; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold;">취소</button>
                </div>
            </div>
        </div>
    `;

    const adjContent = document.getElementById('adjContent');

    try {
        const docSnap = await getDoc(doc(db, "buildings", bId));
        if (!docSnap.exists()) return;
        
        let savedItems = docSnap.data().expenseItems || [];
        currentExpenseConfig = docSnap.data().expenseConfig || {}; 
        otherExpensesConfig = docSnap.data().otherExpenses || {}; 

        const masterGroups = {
            fixed: [{ title: 'A. 일반관리', items: ['위탁관리', '인건비(관리소장)', '인건비(경리)', '인건비(경비)', '인건비(미화)'] }, { title: 'B. 안전관리', items: ['승강기안전', '소방안전', '전기안전', '주차기안전'] }, { title: 'C. 미화ㆍ위생', items: ['청소ㆍ미화', '저수조청소', '수질검사', '방역', '정화조청소'] }, { title: 'D. 보안', items: ['CCTV', '보안업체'] }, { title: 'E. 주차비', items: ['주차비'] }],
            variable: [{ title: 'A. 전기', items: ['공용전기', '세대전기'] }, { title: 'B. 수도', items: ['공용수도', '세대수도'] }, { title: 'C. 가스', items: ['가스'] }, { title: 'D. 통신비', items: ['전화', '인터넷', '비상통화장치'] }],
            periodic: [{ title: 'A. 보험', items: ['승강기보험', '주차기안전보험', '화재보험', '영업배상책임보험', '어린이놀이시설보험', '시설물배상보험'] }, { title: 'B. 검사비', items: ['승강기 정기검사', '승강기 정밀검사', '발전기검사', '전기안전검사', '주차기 검사', '주차기 정밀검사', '건축물안전검사'] }, { title: 'C. 예치', items: ['장기수선충당금', '수선적립금', '건물수선비'] }]
        };

        const getCategory = (itemName) => {
            for (const [cat, groups] of Object.entries(masterGroups)) {
                for (const g of groups) {
                    if (g.items.includes(itemName)) return cat;
                }
            }
            if (currentExpenseConfig[itemName] && currentExpenseConfig[itemName].customCategory) {
                return currentExpenseConfig[itemName].customCategory;
            }
            return 'fixed';
        };

        const renderGroup = async (groupId) => {
            if (groupId === 'current_bill') {
                const now = new Date();
                let selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

                const updateSummaryView = async () => {
                    const container = document.getElementById('summaryContainer');
                    if (!container) return;
                    container.innerHTML = '<div style="padding: 20px; text-align: center; color: #7f8c8d;">요약 데이터를 불러오는 중...</div>';
                    
                    try {
                        const bDocSnap = await getDoc(doc(db, "buildings", bId));
                        const billingHistory = bDocSnap.exists() && bDocSnap.data().billingHistory ? bDocSnap.data().billingHistory : {};
                        const isFinalized = !!billingHistory[selectedMonth];
                        const histData = billingHistory[selectedMonth];

                        let fixedSum = 0, variableSum = 0, periodicSum = 0, otherSum = 0, totalSum = 0;
                        let finalizedDateStr = '';

                        if (isFinalized) {
                            fixedSum = histData.fixedSum || 0;
                            variableSum = histData.variableSum || 0;
                            periodicSum = histData.periodicSum || 0;
                            otherSum = histData.otherSum || 0;
                            totalSum = histData.totalSum || 0;
                            finalizedDateStr = `<div style="font-size:12px; color:#27ae60; margin-top:5px; font-weight:bold;">✅ 확정일시: ${new Date(histData.finalizedAt).toLocaleString()}</div>`;
                        } else {
                            for (const [itemName, config] of Object.entries(currentExpenseConfig)) {
                                const amt = Number(config.monthlyAmount) || 0;
                                const cat = getCategory(itemName);
                                if (cat === 'fixed') fixedSum += amt;
                                else if (cat === 'variable') variableSum += amt;
                                else if (cat === 'periodic') periodicSum += amt;
                            }
                            
                            const otherItems = otherExpensesConfig[selectedMonth] || [];
                            otherItems.forEach(i => otherSum += Number(i.amount));

                            totalSum = fixedSum + variableSum + periodicSum + otherSum;
                        }

                        container.innerHTML = `
                            <div style="border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background: #fff; margin-bottom: 15px;">
                                <div style="background: ${isFinalized ? '#27ae60' : '#2980b9'}; color: white; padding: 15px; font-weight: bold; font-size: 15px; display: flex; justify-content: space-between; align-items: center;">
                                    <span>${selectedMonth} 부과 ${isFinalized ? '확정' : '예정'} 금액 요약</span>
                                    ${isFinalized ? '<span style="background: white; color: #27ae60; padding: 2px 8px; border-radius: 12px; font-size: 11px;">확정됨</span>' : '<span style="background: #f39c12; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">예정</span>'}
                                </div>
                                <div style="padding: 15px; display: flex; flex-direction: column; gap: 10px; font-size: 14px;">
                                    ${finalizedDateStr}
                                    <div style="display: flex; justify-content: space-between; margin-top: ${isFinalized ? '10px' : '0'};">
                                        <span style="color: #7f8c8d;">고정지출 합계:</span>
                                        <strong>${fixedSum.toLocaleString()} 원</strong>
                                    </div>
                                    <div style="display: flex; justify-content: space-between;">
                                        <span style="color: #7f8c8d;">변동지출 합계:</span>
                                        <strong>${variableSum.toLocaleString()} 원</strong>
                                    </div>
                                    <div style="display: flex; justify-content: space-between;">
                                        <span style="color: #7f8c8d;">주기지출 합계:</span>
                                        <strong>${periodicSum.toLocaleString()} 원</strong>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; border-top: 1px dashed #eee; padding-top: 10px;">
                                        <span style="color: #7f8c8d;">기타지출 합계:</span>
                                        <strong style="color: #2c3e50;">${otherSum.toLocaleString()} 원</strong>
                                    </div>
                                    <hr style="border: 0; border-top: 1px dashed #ccc; margin: 10px 0;">
                                    <div style="display: flex; justify-content: space-between; font-size: 16px; color: #e74c3c;">
                                        <strong>총 부과 ${isFinalized ? '확정액' : '예정액'}:</strong>
                                        <strong>${totalSum.toLocaleString()} 원</strong>
                                    </div>
                                </div>
                            </div>
                            ${isFinalized 
                                ? `<button id="unfinalizeBillBtn" style="background: #e74c3c; color: white; border: none; padding: 12px 20px; font-size: 14px; border-radius: 4px; font-weight: bold; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><span class="material-symbols-outlined" style="font-size: 18px;">edit</span> 수정 모드로 전환 (확정 취소)</button>` 
                                : `<button id="finalizeBillBtn" style="background: #27ae60; color: white; border: none; padding: 12px 20px; font-size: 14px; border-radius: 4px; font-weight: bold; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><span class="material-symbols-outlined" style="font-size: 18px;">check_circle</span> 이 달의 부과내역 확정하기</button>`
                            }
                        `;
                        attachSummaryEvents();
                    } catch(err) {
                        container.innerHTML = '<div style="color:red; text-align: center;">데이터를 불러오는 중 오류가 발생했습니다.</div>';
                    }
                };

                const attachSummaryEvents = () => {
                    const finalizeBtn = document.getElementById('finalizeBillBtn');
                    if (finalizeBtn) {
                        finalizeBtn.addEventListener('click', async () => {
                            const monthVal = selectedMonth;
                            if (!monthVal) { alert('월을 선택해주세요.'); return; }
                            if (!confirm(`[${monthVal}] 월의 부과내역을 이대로 확정하시겠습니까?`)) return;

                            finalizeBtn.disabled = true; finalizeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">sync</span> 확정 중...';

                            try {
                                const snap = await getDoc(doc(db, "buildings", bId));
                                let billingHistory = snap.exists() && snap.data().billingHistory ? snap.data().billingHistory : {};

                                let fSum = 0, vSum = 0, pSum = 0;
                                for (const [itemName, config] of Object.entries(currentExpenseConfig)) {
                                    const amt = Number(config.monthlyAmount) || 0;
                                    const cat = getCategory(itemName);
                                    if (cat === 'fixed') fSum += amt;
                                    else if (cat === 'variable') vSum += amt;
                                    else if (cat === 'periodic') pSum += amt;
                                }
                                let oSum = 0;
                                const oItems = otherExpensesConfig[monthVal] || [];
                                oItems.forEach(i => oSum += Number(i.amount));
                                
                                billingHistory[monthVal] = {
                                    fixedSum: fSum, variableSum: vSum, periodicSum: pSum, otherSum: oSum, totalSum: fSum + vSum + pSum + oSum,
                                    items: currentExpenseConfig,
                                    otherItems: oItems,
                                    finalizedAt: new Date().toISOString()
                                };

                                await updateDoc(doc(db, "buildings", bId), { billingHistory });
                                alert(`${monthVal} 월 부과내역이 확정되었습니다.\n'세대부과' 탭에서 고지서 내역을 확인할 수 있습니다.`);
                                updateSummaryView();
                            } catch (err) {
                                console.error(err);
                                alert('확정 중 오류가 발생했습니다.');
                                finalizeBtn.disabled = false; finalizeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">check_circle</span> 이 달의 부과내역 확정하기';
                            }
                        });
                    }

                    const unfinalizeBtn = document.getElementById('unfinalizeBillBtn');
                    if (unfinalizeBtn) {
                        unfinalizeBtn.addEventListener('click', async () => {
                            const monthVal = selectedMonth;
                            if (!confirm(`⚠️ 강력 경고: [${monthVal}] 월의 부과 확정을 취소하시겠습니까?\n\n이미 입주민에게 고지서가 발송되었거나 수납이 진행 중인 상태에서 부과 금액을 변경하면, 시스템상 미납/과납금이 발생하여 장부가 심각하게 틀어질 수 있습니다.\n\n원칙적으로는 과거 내역 수정 대신 다음 달 '기타 지출'에 정산액을 추가하는 것이 안전합니다.\n\n그럼에도 불구하고 강제로 수정 모드로 전환하시겠습니까?`)) return;
                            
                            unfinalizeBtn.disabled = true; unfinalizeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">sync</span> 전환 중...';
                            
                            try {
                                const snap = await getDoc(doc(db, "buildings", bId));
                                let billingHistory = snap.exists() && snap.data().billingHistory ? snap.data().billingHistory : {};
                                
                                if (billingHistory[monthVal]) {
                                    delete billingHistory[monthVal];
                                    await updateDoc(doc(db, "buildings", bId), { billingHistory });
                                    alert('수정 모드로 전환되었습니다. 변경 사항을 조정한 뒤 반드시 다시 확정해주세요.');
                                    updateSummaryView();
                                } else {
                                    alert('이미 취소된 상태입니다.');
                                    updateSummaryView();
                                }
                            } catch (err) {
                                console.error(err);
                                alert('전환 중 오류가 발생했습니다.');
                                unfinalizeBtn.disabled = false; unfinalizeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px;">edit</span> 수정 모드로 전환 (확정 취소)';
                            }
                        });
                    }
                };

                adjContent.innerHTML = `
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0; display: flex; justify-content: center; align-items: center; margin-bottom: 15px;">
                        <label style="font-size: 13px; color: #34495e; font-weight: bold; margin-right: 10px;">부과 월 선택:</label>
                        <input type="month" id="finalizeMonth" value="${selectedMonth}" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 150px; margin: 0;">
                    </div>
                    <div id="summaryContainer"></div>
                `;

                document.getElementById('finalizeMonth').addEventListener('change', (e) => {
                    selectedMonth = e.target.value;
                    updateSummaryView();
                });
                
                updateSummaryView();
                return;
            }
            if (groupId === 'past_records') {
                adjContent.innerHTML = '<div style="text-align: center; padding: 20px; color: #7f8c8d;">기록을 불러오는 중...</div>';
                try {
                    const snap = await getDoc(doc(db, "buildings", bId));
                    if (!snap.exists() || !snap.data().billingHistory) {
                        adjContent.innerHTML = '<div style="color:#7f8c8d; padding:20px; text-align:center; background:#f8f9fa; border-radius:8px;">확정된 과거 부과 기록이 없습니다.</div>';
                        return;
                    }
                    const history = snap.data().billingHistory;
                    const months = Object.keys(history).sort().reverse();

                    if (months.length === 0) {
                        adjContent.innerHTML = '<div style="color:#7f8c8d; padding:20px; text-align:center; background:#f8f9fa; border-radius:8px;">확정된 과거 부과 기록이 없습니다.</div>';
                        return;
                    }

                    let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
                    months.forEach(m => {
                        const rec = history[m];
                        html += `
                            <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                    <h4 style="margin: 0; color: #2c3e50; font-size: 16px;">${m} 부과 확정본</h4>
                                    <span style="font-size: 12px; color: #95a5a6;">확정일시: ${new Date(rec.finalizedAt).toLocaleString()}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 13px; color: #555; margin-bottom: 5px;">
                                    <span>고정: ${rec.fixedSum.toLocaleString()}원</span>
                                    <span>변동: ${rec.variableSum.toLocaleString()}원</span>
                                    <span>주기: ${rec.periodicSum.toLocaleString()}원</span>
                                    <span>기타: ${(rec.otherSum || 0).toLocaleString()}원</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; color: #e74c3c; border-top: 1px dashed #eee; padding-top: 8px;">
                                    <span>총액:</span>
                                    <span>${rec.totalSum.toLocaleString()}원</span>
                                </div>
                            </div>
                        `;
                    });
                    html += '</div>';
                    adjContent.innerHTML = html;
                } catch(err) {
                    console.error(err);
                    adjContent.innerHTML = '<div style="color:red; padding: 20px; text-align: center;">기록을 불러오는 중 오류가 발생했습니다.</div>';
                }
                return;
            }
            if (groupId === 'other_expense') {
                const now = new Date();
                let selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

                const renderOtherExpenseView = () => {
                    const items = otherExpensesConfig[selectedMonth] || [];
                    let itemsHtml = items.map(item => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                            <div>
                                <strong style="color: #2c3e50;">${escapeHtml(item.name)}</strong>
                                <div style="font-size: 12px; color: #7f8c8d; margin-top: 4px;">
                                    <span style="background: #e8f4f8; color: #2980b9; padding: 2px 6px; border-radius: 4px; margin-right: 5px;">대상: ${escapeHtml(item.target || '전체')}</span>
                                    ${item.note ? escapeHtml(item.note) : ''}
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="color: #2980b9; font-weight: bold;">${Number(item.amount).toLocaleString()} 원</span>
                                <button class="resol-btn" data-id="${item.id}" style="background: #8e44ad; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 12px; cursor: pointer;">지출결의서</button>
                                <button class="del-other-btn" data-id="${item.id}" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 12px; cursor: pointer;">삭제</button>
                            </div>
                        </div>
                    `).join('');

                    if(items.length === 0) itemsHtml = '<div style="padding: 20px; text-align: center; color: #7f8c8d;">등록된 기타지출 항목이 없습니다.</div>';

                    adjContent.innerHTML = `
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0; display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                            <label style="font-size: 13px; font-weight: bold; color: #34495e;">적용 월 선택:</label>
                            <input type="month" id="otherMonthSelect" value="${selectedMonth}" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin: 0;">
                        </div>
                        
                        <div style="border: 1px solid #e0e0e0; border-radius: 8px; background: #fff; margin-bottom: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <div style="background: #2c3e50; color: white; padding: 12px 15px; font-weight: bold; font-size: 14px; border-radius: 8px 8px 0 0;">
                                ${selectedMonth} 기타지출 내역
                            </div>
                            <div id="otherItemsList">${itemsHtml}</div>
                        </div>
                        
                        <div style="background: #e8f4f8; padding: 15px; border-radius: 8px; border: 1px solid #bce0fd;">
                            <h4 style="margin-top: 0; color: #2980b9; font-size: 14px; margin-bottom: 10px;">새 항목 생성</h4>
                            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                                <input type="text" id="newOtherName" placeholder="항목명 (예: 승강기 수리비)" style="flex: 2; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin: 0;">
                                <input type="number" id="newOtherAmount" placeholder="금액" style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin: 0;">
                            </div>
                            <div style="display: flex; gap: 10px;">
                                <input type="text" id="newOtherTarget" placeholder="적용 대상 (예: 101호, 1층. 공란 시 전체)" style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin: 0;">
                                <input type="text" id="newOtherNote" placeholder="비고 (선택)" style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin: 0;">
                                <button id="addOtherBtn" style="background: #2980b9; color: white; border: none; padding: 10px 20px; border-radius: 4px; font-weight: bold; cursor: pointer; white-space: nowrap;">추가</button>
                            </div>
                        </div>
                    `;

                    document.getElementById('otherMonthSelect').addEventListener('change', (e) => {
                        selectedMonth = e.target.value;
                        renderOtherExpenseView();
                    });

                    document.getElementById('addOtherBtn').addEventListener('click', async () => {
                        const name = document.getElementById('newOtherName').value.trim();
                        const amount = Number(document.getElementById('newOtherAmount').value);
                        const target = document.getElementById('newOtherTarget').value.trim();
                        const note = document.getElementById('newOtherNote').value.trim();
                        
                        if (!name || amount <= 0) return alert('항목명과 금액을 올바르게 입력해주세요.');

                        if (!otherExpensesConfig[selectedMonth]) otherExpensesConfig[selectedMonth] = [];
                        otherExpensesConfig[selectedMonth].push({ id: 'other_' + Date.now(), name, amount, target, note });

                        try {
                            await updateDoc(doc(db, "buildings", bId), { otherExpenses: otherExpensesConfig });
                            renderOtherExpenseView();
                        } catch (e) { console.error(e); alert("저장 중 오류가 발생했습니다."); }
                    });

                    adjContent.querySelectorAll('.del-other-btn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const delId = e.target.dataset.id;
                            if(confirm('이 항목을 삭제하시겠습니까?')) {
                                otherExpensesConfig[selectedMonth] = otherExpensesConfig[selectedMonth].filter(i => i.id !== delId);
                                try {
                                    await updateDoc(doc(db, "buildings", bId), { otherExpenses: otherExpensesConfig });
                                    renderOtherExpenseView();
                                } catch(err) { console.error(err); alert("삭제 중 오류가 발생했습니다."); }
                            }
                        });
                    });

                    // 지출결의서 생성 및 문서 저장 로직
                    adjContent.querySelectorAll('.resol-btn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const itemId = e.target.dataset.id;
                            const item = otherExpensesConfig[selectedMonth].find(i => i.id === itemId);
                            if (item) {
                                const title = `${selectedMonth} 지출결의서 - ${item.name}`;
                                const amountStr = Number(item.amount).toLocaleString() + ' 원';
                                const today = new Date().toLocaleDateString('ko-KR');

                                try {
                                    // 1. 향후 사용될 '문서' 탭을 위해 DB에 기록 저장
                                    await addDoc(collection(db, "buildings", bId, "documents"), {
                                        type: '지출결의서',
                                        title: title,
                                        target: item.target || '전체',
                                        amount: item.amount,
                                        note: item.note || '',
                                        relatedMonth: selectedMonth,
                                        createdAt: serverTimestamp()
                                    });
                                    alert('문서 탭에 지출결의서가 저장되었습니다. 출력 화면을 띄웁니다.');
                                } catch (err) {
                                    console.error(err);
                                    alert('문서 저장 중 오류가 발생했습니다.');
                                }

                                // 2. A4 폼의 새 창(인쇄 뷰) 열기
                                const printWindow = window.open('', '_blank', 'width=800,height=900');
                                printWindow.document.write(`
                                    <html><head><title>${title}</title>
                                        <style>
                                            @page { size: A4; margin: 20mm; }
                                            body { font-family: 'Malgun Gothic', sans-serif; margin: 0; padding: 0; }
                                            .a4-container { width: 210mm; min-height: 297mm; padding: 20mm; box-sizing: border-box; margin: auto; background: white; }
                                            h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 30px; letter-spacing: 5px; }
                                            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                                            th, td { border: 1px solid #333; padding: 12px; font-size: 14px; }
                                            th { background: #f0f0f0; width: 120px; text-align: center; }
                                            .sign-area { display: flex; justify-content: flex-end; gap: 20px; margin-bottom: 40px; }
                                            .sign-box { border: 1px solid #333; width: 80px; height: 100px; text-align: center; }
                                            .sign-title { border-bottom: 1px solid #333; background: #f0f0f0; padding: 5px; font-size: 13px; font-weight: bold; }
                                            .footer { text-align: center; margin-top: 50px; font-size: 16px; font-weight: bold; }
                                            @media print { body { background: none; } .a4-container { margin: 0; padding: 0; box-shadow: none; } }
                                        </style>
                                    </head><body>
                                        <div class="a4-container">
                                            <div class="sign-area"><div class="sign-box"><div class="sign-title">담당</div></div><div class="sign-box"><div class="sign-title">소장</div></div><div class="sign-box"><div class="sign-title">대표</div></div></div>
                                            <h1>지 출 결 의 서</h1>
                                            <table><tr><th>건 명</th><td colspan="3"><strong>${escapeHtml(item.name)}</strong></td></tr><tr><th>금 액</th><td colspan="3"><strong style="font-size: 16px;">일금 ${amountStr}</strong></td></tr><tr><th>대 상</th><td>${escapeHtml(item.target || '전체')}</td><th>결제 월</th><td>${selectedMonth}</td></tr><tr><th style="height: 200px;">내 역 및<br>비 고</th><td colspan="3" style="vertical-align: top;">${escapeHtml(item.note || '특이사항 없음')}</td></tr></table>
                                            <div class="footer">위와 같이 지출을 결의하오니 재가하여 주시기 바랍니다.<br><br>${today}</div>
                                        </div><script>setTimeout(() => { window.print(); }, 500);</script>
                                    </body></html>
                                `);
                                printWindow.document.close();
                            }
                        });
                    });
                };

                renderOtherExpenseView();
                return;
            }

            let html = '';
            let listHtml = '';
            let hasAnyItem = false;

            let groupTitleStr = groupId === 'fixed' ? '고정지출' : (groupId === 'variable' ? '변동지출' : '주기지출');
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border: 1px solid #e0e0e0;">
                    <h4 style="margin: 0; color: #2c3e50; display: flex; align-items: center; gap: 6px;">
                        <span class="material-symbols-outlined" style="color: #2980b9;">list_alt</span> ${groupTitleStr} 항목
                    </h4>
                    <button class="edit-items-btn" data-group="${groupId}" style="background: #e8f4f8; border: 1px solid #bce0fd; color: #2980b9; padding: 6px 12px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: bold; transition: background 0.2s;" onmouseover="this.style.background='#d6eaf8'" onmouseout="this.style.background='#e8f4f8'">
                        <span class="material-symbols-outlined" style="font-size: 16px;">edit</span> 항목 추가/삭제
                    </button>
                </div>
            `;

            const allMasterItems = new Set();
            Object.values(masterGroups).forEach(arr => arr.forEach(g => g.items.forEach(i => allMasterItems.add(i))));

            const getCustomItemsForGroup = (catId) => {
                return savedItems.filter(item => {
                    if (allMasterItems.has(item)) return false;
                    const config = currentExpenseConfig[item] || {};
                    const cCat = config.customCategory || 'fixed';
                    return cCat === catId;
                });
            };
            const currentCustomItems = getCustomItemsForGroup(groupId);

            masterGroups[groupId].forEach(g => {
                const predefinedMatched = g.items.filter(item => savedItems.includes(item));
                const customMatched = currentCustomItems.filter(item => {
                    const config = currentExpenseConfig[item] || {};
                    return config.customGroup === g.title;
                });
                const matchedItems = [...predefinedMatched, ...customMatched];
                
                if (matchedItems.length > 0) {
                    hasAnyItem = true;
                    listHtml += `
                        <div style="margin-bottom: 15px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                            <div style="background: #f8f9fa; padding: 10px 15px; font-weight: bold; color: #2c3e50; border-bottom: 1px solid #e0e0e0; font-size: 13px;">${g.title}</div>
                            <div style="padding: 10px 15px; display: flex; flex-direction: column; gap: 8px;">
                                ${matchedItems.map(item => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px dashed #f0f0f0;">
                                        <span class="expense-item-name" data-item="${escapeHtml(item)}" style="font-size: 14px; color: ${!g.items.includes(item) ? '#8e44ad' : '#2980b9'}; font-weight: bold; cursor: pointer; text-decoration: underline;" title="상세 정보 입력">${escapeHtml(item)}</span>
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <input type="text" class="expense-amount-input" data-item="${escapeHtml(item)}" value="${currentExpenseConfig[item]?.monthlyAmount ? Number(currentExpenseConfig[item].monthlyAmount).toLocaleString() : ''}" placeholder="0" style="margin: 0; padding: 6px 10px; width: 120px; font-size: 13px; text-align: right; border: 1px solid #ccc; border-radius: 4px;">
                                            <span style="font-size: 13px; color: #7f8c8d;">원</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }
            });

            const otherCustomItems = currentCustomItems.filter(item => {
                const config = currentExpenseConfig[item] || {};
                const grp = config.customGroup || '기타';
                return grp === '기타';
            });

            if (otherCustomItems.length > 0) {
                hasAnyItem = true;
                listHtml += `
                    <div style="margin-bottom: 15px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                        <div style="background: #f8f9fa; padding: 10px 15px; font-weight: bold; color: #2c3e50; border-bottom: 1px solid #e0e0e0; font-size: 13px;">기타 (사용자 직접 추가 항목)</div>
                        <div style="padding: 10px 15px; display: flex; flex-direction: column; gap: 8px;">
                            ${otherCustomItems.map(item => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px dashed #f0f0f0;">
                                    <span class="expense-item-name" data-item="${escapeHtml(item)}" style="font-size: 14px; color: #8e44ad; font-weight: bold; cursor: pointer; text-decoration: underline;" title="상세 정보 입력">${escapeHtml(item)}</span>
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <input type="text" class="expense-amount-input" data-item="${escapeHtml(item)}" value="${currentExpenseConfig[item]?.monthlyAmount ? Number(currentExpenseConfig[item].monthlyAmount).toLocaleString() : ''}" placeholder="0" style="margin: 0; padding: 6px 10px; width: 120px; font-size: 13px; text-align: right; border: 1px solid #ccc; border-radius: 4px;">
                                        <span style="font-size: 13px; color: #7f8c8d;">원</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            if (!hasAnyItem) {
                html += '<div style="color:#7f8c8d; padding:20px; text-align:center; background:#f8f9fa; border-radius:8px; border: 1px dashed #ccc;">이 그룹에 해당하는 지출 항목이 없습니다. 상단의 버튼을 눌러 항목을 추가해보세요.</div>';
            } else {
                html += listHtml;
                html += '<button id="saveAdjBtn" style="width: 100%; background: #27ae60; color: white; margin-top: 10px; font-size: 14px; padding: 12px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">입력 금액 및 상세 설정 저장</button>';
            }

            adjContent.innerHTML = html;

        adjContent.querySelectorAll('.expense-amount-input').forEach(input => {
            input.addEventListener('input', (e) => {
                let rawValue = e.target.value.replace(/[^0-9]/g, '');
                e.target.value = rawValue ? Number(rawValue).toLocaleString() : '';
                const item = e.target.dataset.item;
                if (!currentExpenseConfig[item]) currentExpenseConfig[item] = {};
                currentExpenseConfig[item].monthlyAmount = rawValue ? Number(rawValue) : 0;
            });
        });

        const saveBtn = document.getElementById('saveAdjBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                saveBtn.disabled = true; saveBtn.textContent = '저장 중...';
                try {
                    await updateDoc(doc(db, "buildings", bId), { expenseConfig: currentExpenseConfig });
                    alert('지출 금액 및 상세 설정이 성공적으로 저장되었습니다!');
                } catch (error) {
                    console.error(error); alert('저장 중 오류가 발생했습니다.');
                } finally {
                    saveBtn.disabled = false; saveBtn.textContent = '입력 금액 및 상세 설정 저장';
                }
            });
        }

        adjContent.querySelectorAll('.edit-items-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                currentEditGroupId = e.currentTarget.dataset.group;
                const groupData = masterGroups[currentEditGroupId];
                
                const allMasterItems = new Set();
                Object.values(masterGroups).forEach(arr => arr.forEach(g => g.items.forEach(i => allMasterItems.add(i))));
                
                const currentCustomItems = savedItems.filter(item => {
                    if (allMasterItems.has(item)) return false;
                    const config = currentExpenseConfig[item] || {};
                    const cCat = config.customCategory || 'fixed';
                    return cCat === currentEditGroupId;
                });

                let editHtml = '';
                let groupOptions = '';
                
                groupData.forEach((g, idx) => {
                    groupOptions += `<option value="${g.title}">${g.title}</option>`;
                    const customMatched = currentCustomItems.filter(item => {
                        const config = currentExpenseConfig[item] || {};
                        return config.customGroup === g.title;
                    });
                    const allItemsInGroup = [...g.items, ...customMatched];

                    editHtml += `
                        <div style="margin-bottom: 15px;">
                            <strong style="display: block; margin-bottom: 8px; color: #2c3e50; font-size: 13px;">${g.title}</strong>
                            <div id="edit-group-${idx}" style="display: flex; flex-direction: column; gap: 8px; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                                ${allItemsInGroup.map(item => `
                                    <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 13px; ${!g.items.includes(item) ? 'color:#8e44ad; font-weight:bold;' : ''}">
                                        <input type="checkbox" name="editExpenseItem" value="${escapeHtml(item)}" ${!g.items.includes(item) ? `data-custom-group="${escapeHtml(g.title)}"` : ''} ${savedItems.includes(item) ? 'checked' : ''} style="width: auto; margin: 0; accent-color: #2980b9;"> ${escapeHtml(item)}
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    `;
                });

                groupOptions += `<option value="기타">기타</option>`;
                const otherCustomItems = currentCustomItems.filter(item => {
                    const config = currentExpenseConfig[item] || {};
                    const grp = config.customGroup || '기타';
                    return grp === '기타';
                });

                    editHtml += `
                        <div style="margin-bottom: 15px;">
                            <strong style="display: block; margin-bottom: 8px; color: #2c3e50; font-size: 13px;">기타 (사용자 직접 추가 항목)</strong>
                        <div id="edit-group-other" style="display: flex; flex-direction: column; gap: 8px; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                            ${otherCustomItems.map(item => `
                                <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 13px; color: #8e44ad; font-weight: bold;">
                                    <input type="checkbox" name="editExpenseItem" value="${escapeHtml(item)}" data-custom-group="기타" checked style="width: auto; margin: 0; accent-color: #2980b9;"> ${escapeHtml(item)}
                                    </label>
                                `).join('')}
                            <div id="edit-group-other-anchor"></div>
                                </div>
                            </div>
                    `;

                editHtml += `
                    <div style="margin-bottom: 15px; border-top: 1px solid #eee; padding-top: 15px;">
                        <strong style="display: block; margin-bottom: 8px; color: #2980b9; font-size: 13px;">새 항목 직접 추가</strong>
                        <div style="display: flex; flex-direction: column; gap: 8px; background: #e8f4f8; padding: 12px; border-radius: 8px;">
                            <select id="newCustomItemGroup" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; outline: none; background: white;">
                                ${groupOptions}
                            </select>
                            <div style="display: flex; gap: 5px;">
                                <input type="text" id="newCustomItemInput" placeholder="직접 입력" style="flex: 1; margin: 0; padding: 8px; font-size: 12px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; outline: none;">
                                <button type="button" id="addCustomItemBtn" style="padding: 8px 12px; font-size: 12px; background: #2980b9; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">추가</button>
                            </div>
                        </div>
                    </div>
                `;

                document.getElementById('editItemsContainer').innerHTML = editHtml;

                    const addBtn = document.getElementById('addCustomItemBtn');
                    const input = document.getElementById('newCustomItemInput');
                const groupSelect = document.getElementById('newCustomItemGroup');
                    
                    addBtn.addEventListener('click', () => {
                        const val = input.value.trim();
                    const targetGroup = groupSelect.value;
                        if (val) {
                            const newLabel = document.createElement('label');
                        newLabel.style.cssText = 'cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 13px; color: #8e44ad; font-weight: bold;';
                        newLabel.innerHTML = `<input type="checkbox" name="editExpenseItem" value="${escapeHtml(val)}" data-custom-group="${escapeHtml(targetGroup)}" checked style="width: auto; margin: 0; accent-color: #2980b9;"> ${escapeHtml(val)}`;
                        
                        if (targetGroup === '기타') {
                            const targetContainer = document.getElementById('edit-group-other');
                            targetContainer.insertBefore(newLabel, document.getElementById('edit-group-other-anchor'));
                        } else {
                            const targetIdx = groupData.findIndex(g => g.title === targetGroup);
                            const targetContainer = document.getElementById(`edit-group-${targetIdx}`);
                            targetContainer.appendChild(newLabel);
                        }
                            input.value = '';
                        }
                    });
                    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); } });

                document.getElementById('editItemsModal').style.display = 'flex';
            });
        });

        adjContent.querySelectorAll('.expense-item-name').forEach(label => {
            label.addEventListener('click', (e) => {
                const itemName = e.target.dataset.item;
                const modal = document.getElementById('expenseModal');
                if (!modal) return;
                
                const config = currentExpenseConfig[itemName] || {};
                
                document.getElementById('expenseModalTitle').textContent = itemName + ' 상세 정보';
                document.getElementById('expItemName').value = itemName;
                document.getElementById('expCompany').value = config.company || '';
                document.getElementById('expContact').value = config.contact || '';
                document.getElementById('expAmount').value = config.amount ? Number(config.amount).toLocaleString() : '';
                document.getElementById('expCycleNum').value = config.cycleNum || '1';
                document.getElementById('expCycleUnit').value = config.cycleUnit || '개월';
                document.getElementById('expNote').value = config.note || '';
                document.getElementById('expExceptions').value = config.exceptions || '';
                
                modal.style.display = 'flex';
            });
        });
        };

        // 서브 탭 클릭 이벤트
        const subBtns = container.querySelectorAll('.adj-sub-btn');
        subBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                subBtns.forEach(b => { b.style.color = '#7f8c8d'; b.style.fontWeight = 'normal'; });
                e.target.style.color = '#2980b9'; e.target.style.fontWeight = 'bold';
                renderGroup(e.target.dataset.group);
            });
        });

        renderGroup('current_bill'); // 초기 렌더링

    // 항목 편집 모달 이벤트 등록
    document.getElementById('cancelEditItemsBtn').addEventListener('click', () => {
        document.getElementById('editItemsModal').style.display = 'none';
    });

    document.getElementById('saveEditItemsBtn').addEventListener('click', async () => {
        if (!currentEditGroupId) return;

        const checkboxes = document.querySelectorAll('input[name="editExpenseItem"]:checked');
        const checkedItems = Array.from(checkboxes).map(cb => cb.value);

        const allMasterItemsOverall = new Set();
        Object.values(masterGroups).forEach(arr => arr.forEach(g => g.items.forEach(i => allMasterItemsOverall.add(i))));

        const allMasterItemsInGroup = new Set();
        masterGroups[currentEditGroupId].forEach(g => g.items.forEach(i => allMasterItemsInGroup.add(i)));

        const existingCustomItemsForGroup = savedItems.filter(item => {
            if (allMasterItemsOverall.has(item)) return false;
            const cat = (currentExpenseConfig[item] && currentExpenseConfig[item].customCategory) || 'fixed';
            return cat === currentEditGroupId;
        });

        existingCustomItemsForGroup.forEach(i => allMasterItemsInGroup.add(i));

        // Filter out items that belong to the current group from savedItems
        savedItems = savedItems.filter(item => !allMasterItemsInGroup.has(item));
        
        // Add the newly checked items
        checkedItems.forEach(item => {
            if (!savedItems.includes(item)) savedItems.push(item);
            
            const cb = document.querySelector(`input[name="editExpenseItem"][value="${CSS.escape(item)}"]`);
            if (cb && cb.dataset.customGroup) {
                if (!currentExpenseConfig[item]) currentExpenseConfig[item] = {};
                currentExpenseConfig[item].customCategory = currentEditGroupId;
                currentExpenseConfig[item].customGroup = cb.dataset.customGroup;
            }
        });

        document.getElementById('saveEditItemsBtn').disabled = true;
        document.getElementById('saveEditItemsBtn').textContent = '저장 중...';

        try {
            await updateDoc(doc(db, "buildings", bId), { 
                expenseItems: savedItems,
                expenseConfig: currentExpenseConfig
            });
            alert('항목이 성공적으로 업데이트되었습니다.');
            document.getElementById('editItemsModal').style.display = 'none';
            renderGroup(currentEditGroupId); // UI refresh
        } catch (error) {
            console.error(error);
            alert('저장 중 오류가 발생했습니다.');
        } finally {
            document.getElementById('saveEditItemsBtn').disabled = false;
            document.getElementById('saveEditItemsBtn').textContent = '저장';
        }
    });

    // 상세 정보 모달 이벤트 등록
    const expenseModal = document.getElementById('expenseModal');
    const expAmountInput = document.getElementById('expAmount');
    if (expAmountInput) {
        expAmountInput.addEventListener('input', (e) => {
            let rawValue = e.target.value.replace(/[^0-9]/g, '');
            e.target.value = rawValue ? Number(rawValue).toLocaleString() : '';
        });
    }

    document.getElementById('cancelExpModalBtn').addEventListener('click', () => { expenseModal.style.display = 'none'; });
    document.getElementById('saveExpModalBtn').addEventListener('click', () => {
        const itemName = document.getElementById('expItemName').value;
        const amount = parseFloat(document.getElementById('expAmount').value.replace(/,/g, '')) || 0;
        const cycleNum = parseFloat(document.getElementById('expCycleNum').value) || 1;
        const cycleUnit = document.getElementById('expCycleUnit').value;

        let rawMonthly = cycleUnit === '개월' ? amount / cycleNum : amount / (cycleNum * 12);
        const monthlyAmount = Math.ceil(rawMonthly / 10) * 10;

        if (!currentExpenseConfig[itemName]) currentExpenseConfig[itemName] = {};
        currentExpenseConfig[itemName] = {
            ...currentExpenseConfig[itemName],
            company: document.getElementById('expCompany').value, contact: document.getElementById('expContact').value,
            amount, cycleNum, cycleUnit, note: document.getElementById('expNote').value, exceptions: document.getElementById('expExceptions').value, monthlyAmount
        };

        const amountInput = document.querySelector('.expense-amount-input[data-item="' + CSS.escape(itemName) + '"]');
        if (amountInput) amountInput.value = monthlyAmount.toLocaleString();

        alert(`${itemName} 상세 정보가 적용되었습니다.\n(월 환산 금액: ${monthlyAmount.toLocaleString()}원)\n\n※ 반드시 화면 하단의 [저장] 버튼을 눌러야 최종 반영됩니다.`);
        expenseModal.style.display = 'none';
    });

    } catch (error) {
        console.error(error);
        adjContent.innerHTML = '<div style="color:red; text-align: center;">데이터 로드 오류</div>';
    }
};