import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../../js/main.js";

export const render = async (container) => {
    container.innerHTML = `
        <div class="module-card">
            <div style="display:flex; gap:15px; margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px; overflow-x: auto; white-space: nowrap;">
                <button class="bill-sub-btn" data-group="current" style="background:none; border:none; padding:0; color:#2980b9; font-weight:bold; cursor:pointer; font-size:14px;">당월부과</button>
                <button class="bill-sub-btn" data-group="statement" style="background:none; border:none; padding:0; color:#7f8c8d; cursor:pointer; font-size:14px;">고지서</button>
                <button class="bill-sub-btn" data-group="history" style="background:none; border:none; padding:0; color:#7f8c8d; cursor:pointer; font-size:14px;">부과기록</button>
                <button class="bill-sub-btn" data-group="query" style="background:none; border:none; padding:0; color:#7f8c8d; cursor:pointer; font-size:14px;">검색쿼리</button>
                <button class="bill-sub-btn" data-group="settings" style="background:none; border:none; padding:0; color:#7f8c8d; cursor:pointer; font-size:14px;">부과설정</button>
            </div>
            <div id="billContent">
                <div style="text-align: center; padding: 20px; color: #7f8c8d;">데이터를 불러오는 중...</div>
            </div>
        </div>
    `;
    await loadBillManagement();
};

const loadBillManagement = async () => {
    const bId = localStorage.getItem('selectedBuildingId');
    const billContent = document.getElementById('billContent');
    
    if (!bId) {
        billContent.innerHTML = '<div style="color:#e74c3c; padding: 20px; text-align: center; font-weight: bold;">선택된 건물이 없습니다.</div>';
        return;
    }

    try {
        const docSnap = await getDoc(doc(db, "buildings", bId));
        if (!docSnap.exists()) return;
        
        const bData = docSnap.data();
        const billingConfig = bData.billingConfig || { billTiming: '당월부과', splitMethod: 'N분의일부과', lateFeeRate: 0 };
        const billingHistory = bData.billingHistory || {};
        const roomsList = bData.roomsList || [];
        const sortedRooms = [...roomsList].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        const renderBillGroup = async (groupId) => {
            if (groupId === 'current') {
                const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                
                if (!billingHistory[currentMonth]) {
                    billContent.innerHTML = `<div style="padding: 20px; text-align: center; color: #e74c3c; background: #fdf2e9; border-radius: 8px; border: 1px solid #f8c471; font-weight: bold;">[부과조정] 탭에서 [당월부과] 내역을 먼저 확정해주세요.</div>`;
                    return;
                }

                const totalSum = billingHistory[currentMonth].totalSum || 0;
                let tableRows = '';
                
                if (sortedRooms.length === 0) {
                    tableRows = `<tr><td colspan="6" style="padding: 10px; text-align: center; color: #7f8c8d;">등록된 호실이 없습니다.</td></tr>`;
                } else {
                    let baseAmount = 0;
                    if (billingConfig.splitMethod === 'N분의일부과' && sortedRooms.length > 0) {
                        baseAmount = Math.ceil((totalSum / sortedRooms.length) / 10) * 10;
                    }
                    
                    sortedRooms.forEach((room, idx) => {
                        const unpaid = 0, lateFee = 0;
                        const total = baseAmount + unpaid + lateFee;
                        tableRows += `
                            <tr style="border-bottom: 1px solid #eee; background: #fff;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='#fff'">
                                <td style="padding: 10px; text-align: center; border-right: 1px solid #eee;">${idx + 1}</td>
                                <td style="padding: 10px; text-align: center; font-weight: bold; color: #2980b9; border-right: 1px solid #eee;">${escapeHtml(room)}</td>
                                <td style="padding: 10px; text-align: right; border-right: 1px solid #eee;">${baseAmount.toLocaleString()}</td>
                                <td style="padding: 10px; text-align: right; color: #e74c3c; border-right: 1px solid #eee;">${unpaid.toLocaleString()}</td>
                                <td style="padding: 10px; text-align: right; color: #f39c12; border-right: 1px solid #eee;">${lateFee.toLocaleString()}</td>
                                <td style="padding: 10px; text-align: right; font-weight: bold;">${total.toLocaleString()}</td>
                            </tr>
                        `;
                    });
                }

                billContent.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="color: #2c3e50; font-size: 14px;">${currentMonth} 세대별 관리비 부과 내역</strong>
                        <span style="font-size: 12px; color: #7f8c8d;">적용방식: ${escapeHtml(billingConfig.splitMethod)}</span>
                    </div>
                    <div style="overflow-x: auto; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px; white-space: nowrap;">
                            <thead style="background: #2c3e50; color: white;">
                                <tr>
                                    <th style="padding: 10px; text-align: center; border-right: 1px solid #34495e;">No</th>
                                    <th style="padding: 10px; text-align: center; border-right: 1px solid #34495e;">세대호수</th>
                                    <th style="padding: 10px; text-align: right; border-right: 1px solid #34495e;">당월부과금액</th>
                                    <th style="padding: 10px; text-align: right; border-right: 1px solid #34495e;">미납금</th>
                                    <th style="padding: 10px; text-align: right; border-right: 1px solid #34495e;">연체료</th>
                                    <th style="padding: 10px; text-align: right;">부과합계</th>
                                </tr>
                            </thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                `;
            } else if (groupId === 'settings') {
                billContent.innerHTML = `
                    <div style="background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
                        <h4 style="margin-top: 0; color: #2c3e50; margin-bottom: 15px;">부과 기본 설정</h4>
                        <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">부과 시기</label>
                        <select id="bcTiming" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 15px; box-sizing: border-box;">
                            <option value="당월부과" ${billingConfig.billTiming === '당월부과' ? 'selected' : ''}>당월부과 (이번 달 발생 비용을 이번 달에 청구)</option>
                            <option value="익월부과" ${billingConfig.billTiming === '익월부과' ? 'selected' : ''}>익월부과 (이번 달 발생 비용을 다음 달에 청구)</option>
                        </select>
                        <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">기본 부과 방식</label>
                        <select id="bcSplit" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 15px; box-sizing: border-box;">
                            <option value="N분의일부과" ${billingConfig.splitMethod === 'N분의일부과' ? 'selected' : ''}>N분의 1 부과 (총 세대수로 균등 분할)</option>
                            <option value="면적부과" ${billingConfig.splitMethod === '면적부과' ? 'selected' : ''}>면적부과 (세대별 면적 비율에 따라 분할)</option>
                        </select>
                        <button id="saveBillConfigBtn" style="width: 100%; background: #2980b9; color: white; padding: 12px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">설정 저장</button>
                    </div>
                `;
                document.getElementById('saveBillConfigBtn').addEventListener('click', async () => {
                    const timing = document.getElementById('bcTiming').value;
                    const split = document.getElementById('bcSplit').value;
                    try {
                        await updateDoc(doc(db, "buildings", bId), {
                            billingConfig: { billTiming: timing, splitMethod: split, lateFeeRate: 0 }
                        });
                        alert('부과 설정이 저장되었습니다.');
                    } catch (e) { alert('오류가 발생했습니다.'); }
                });
            } else {
                billContent.innerHTML = '<div style="padding: 20px; text-align: center; color: #7f8c8d; background: #f8f9fa; border-radius: 8px; border: 1px dashed #ccc;">기능 준비 중입니다.</div>';
            }
        };

        const subBtns = document.querySelectorAll('.bill-sub-btn');
        subBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                subBtns.forEach(b => { b.style.color = '#7f8c8d'; b.style.fontWeight = 'normal'; });
                e.target.style.color = '#2980b9'; e.target.style.fontWeight = 'bold';
                renderBillGroup(e.target.dataset.group);
            });
        });

        renderBillGroup('current');
    } catch (err) {
        billContent.innerHTML = '<div style="color:red; padding: 20px; text-align: center;">데이터 로드 오류</div>';
    }
};