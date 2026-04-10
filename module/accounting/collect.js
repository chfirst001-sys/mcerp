import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../../js/main.js";

let currentMonth = '';

export const render = async (container) => {
    const bId = localStorage.getItem('selectedBuildingId');
    if (!bId) {
        container.innerHTML = '<div style="color:#e74c3c; padding: 20px; text-align: center; font-weight: bold;">선택된 건물이 없습니다.</div>';
        return;
    }

    if (!currentMonth) {
        const now = new Date();
        currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    container.innerHTML = `
        <div class="module-card">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; background: #f8f9fa; padding: 10px 15px; border-radius: 8px; border: 1px solid #e0e0e0;">
                <label style="font-size: 13px; font-weight: bold; color: #34495e;">조회 월:</label>
                <input type="month" id="collectMonth" value="${currentMonth}" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin: 0;">
            </div>
            <div id="collectContent">
                <div style="text-align: center; padding: 20px; color: #7f8c8d;">데이터를 불러오는 중...</div>
            </div>
        </div>
    `;

    document.getElementById('collectMonth').addEventListener('change', (e) => {
        currentMonth = e.target.value;
        loadCollectData(bId);
    });

    await loadCollectData(bId);
};

const loadCollectData = async (bId) => {
    const content = document.getElementById('collectContent');
    try {
        const docSnap = await getDoc(doc(db, "buildings", bId));
        if (!docSnap.exists()) return;
        
        const bData = docSnap.data();
        const billingHistory = bData.billingHistory || {};
        const collections = bData.collections || {}; // 수납 데이터 저장용
        
        if (!billingHistory[currentMonth]) {
            content.innerHTML = `<div style="padding: 20px; text-align: center; color: #e74c3c; background: #fdf2e9; border-radius: 8px; border: 1px solid #f8c471; font-weight: bold;">[${currentMonth}] 월의 부과 확정 내역이 없습니다.<br><span style="font-size:13px; font-weight:normal; color:#7f8c8d;">먼저 [부과조정] 탭에서 당월 부과를 확정해주세요.</span></div>`;
            return;
        }

        const currentBill = billingHistory[currentMonth];
        const currentCollection = collections[currentMonth] || {};
        const roomsList = bData.roomsList || [];
        const sortedRooms = [...roomsList].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        let totalBilled = 0;
        let totalCollected = 0;
        let rowsHtml = '';
        
        // 세대별 청구 금액 계산 (기본 N분의 1 적용)
        let baseAmount = 0;
        if (bData.billingConfig?.splitMethod === 'N분의일부과' && sortedRooms.length > 0) {
            baseAmount = Math.ceil((currentBill.totalSum / sortedRooms.length) / 10) * 10;
        }

        sortedRooms.forEach((room, idx) => {
            const billed = baseAmount; // 청구액
            const colData = currentCollection[room] || { amount: 0, date: '' };
            const collected = Number(colData.amount) || 0;
            const unpaid = billed - collected;
            
            totalBilled += billed;
            totalCollected += collected;

            const statusColor = unpaid <= 0 ? '#27ae60' : (collected > 0 ? '#f39c12' : '#e74c3c');
            const statusText = unpaid <= 0 ? '완납' : (collected > 0 ? '부분수납' : '미납');

            rowsHtml += `
                <tr style="border-bottom: 1px solid #eee; background: #fff; transition: background 0.2s;" onmouseover="this.style.background='#f4f6f8'" onmouseout="this.style.background='#fff'">
                    <td style="padding: 10px; text-align: center; border-right: 1px solid #eee;">${idx + 1}</td>
                    <td style="padding: 10px; text-align: center; font-weight: bold; color: #2980b9; border-right: 1px solid #eee;">${escapeHtml(room)}</td>
                    <td style="padding: 10px; text-align: right; border-right: 1px solid #eee;">${billed.toLocaleString()}</td>
                    <td style="padding: 10px; text-align: right; border-right: 1px solid #eee;">
                        <input type="number" class="c-amount" data-room="${escapeHtml(room)}" value="${collected > 0 ? collected : ''}" placeholder="0" style="width: 80px; margin: 0; padding: 6px; font-size: 12px; text-align: right; border: 1px solid #3498db; border-radius: 4px;">
                    </td>
                    <td style="padding: 10px; text-align: right; color: ${unpaid > 0 ? '#e74c3c' : '#7f8c8d'}; font-weight: bold; border-right: 1px solid #eee;">${unpaid.toLocaleString()}</td>
                    <td style="padding: 10px; text-align: center; border-right: 1px solid #eee;">
                        <input type="date" class="c-date" data-room="${escapeHtml(room)}" value="${escapeHtml(colData.date)}" style="width: 110px; margin: 0; padding: 6px; font-size: 12px; border: 1px solid #ccc; border-radius: 4px;">
                    </td>
                    <td style="padding: 10px; text-align: center;">
                        <span style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px;">${statusText}</span>
                    </td>
                </tr>
            `;
        });

        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 14px; background: #e8f4f8; padding: 15px; border-radius: 8px; border: 1px solid #bce0fd;">
                <div style="color: #2c3e50;">총 부과액: <strong>${totalBilled.toLocaleString()} 원</strong></div>
                <div style="color: #27ae60;">총 수납액: <strong>${totalCollected.toLocaleString()} 원</strong></div>
                <div style="color: #e74c3c;">미납 잔액: <strong>${(totalBilled - totalCollected).toLocaleString()} 원</strong></div>
            </div>
            <div style="overflow-x: auto; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; white-space: nowrap;">
                    <thead style="background: #2c3e50; color: white;">
                        <tr><th style="padding: 10px;">No</th><th style="padding: 10px;">호수</th><th style="padding: 10px; text-align: right;">부과금액</th><th style="padding: 10px; text-align: right;">수납금액</th><th style="padding: 10px; text-align: right;">미납잔액</th><th style="padding: 10px;">수납일자</th><th style="padding: 10px;">상태</th></tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
            <div style="text-align: right; margin-top: 15px;">
                <button id="saveCollectBtn" style="background: #27ae60; color: white; border: none; padding: 12px 20px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 14px;">수납 내역 저장</button>
            </div>
        `;

        document.getElementById('saveCollectBtn').addEventListener('click', async () => {
            const btn = document.getElementById('saveCollectBtn');
            btn.disabled = true; btn.textContent = '저장 중...';

            const newCollection = {};
            content.querySelectorAll('tbody tr').forEach(row => {
                const room = row.querySelector('.c-amount').dataset.room;
                const amount = Number(row.querySelector('.c-amount').value) || 0;
                const date = row.querySelector('.c-date').value;
                if (amount > 0 || date) newCollection[room] = { amount, date };
            });

            try {
                collections[currentMonth] = newCollection;
                await updateDoc(doc(db, "buildings", bId), { collections });
                alert('수납 내역이 저장되었습니다.'); loadCollectData(bId);
            } catch (e) { alert('수납 내역 저장 중 오류가 발생했습니다.'); } 
            finally { btn.disabled = false; btn.textContent = '수납 내역 저장'; }
        });
    } catch (e) { content.innerHTML = '<div style="color:red; padding: 20px; text-align: center;">데이터 로드 오류</div>'; }
};