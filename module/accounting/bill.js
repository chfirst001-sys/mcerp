import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../../js/main.js";

export const render = async (container) => {
    container.innerHTML = `
        <div>
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

                const bill = billingHistory[currentMonth];
                const itemsConfig = bill.items || {};
                const otherItemsConfig = bill.otherItems || [];

                const detailCols = [];
                for (const [itemName, config] of Object.entries(itemsConfig)) {
                    detailCols.push({ key: 'item_' + itemName, name: itemName, total: Number(config.monthlyAmount) || 0, perRoom: 0, sum: 0 });
                }
                otherItemsConfig.forEach(other => {
                    detailCols.push({ key: 'other_' + other.id, name: other.name, total: Number(other.amount) || 0, perRoom: 0, sum: 0 });
                });

                const numRooms = sortedRooms.length;
                detailCols.forEach(col => {
                    if (billingConfig.splitMethod === 'N분의일부과' && numRooms > 0) {
                        col.perRoom = Math.ceil((col.total / numRooms) / 10) * 10;
                    }
                });

                const collections = bData.collections || {};
                const months = Object.keys(billingHistory).sort(); // 과거 내역 조회를 위한 정렬

                const th1 = 'position: sticky; top: 0; left: 0; z-index: 14; background: #2c3e50; color: white; width: 40px; min-width: 40px; height: 40px; box-sizing: border-box; border-right: 1px solid #34495e; border-bottom: 1px solid #34495e; padding: 10px; text-align: center;';
                const th2 = 'position: sticky; top: 0; left: 40px; z-index: 14; background: #2c3e50; color: white; width: 70px; min-width: 70px; height: 40px; box-sizing: border-box; border-right: 1px solid #34495e; border-bottom: 1px solid #34495e; padding: 10px; text-align: center;';
                const th3 = 'position: sticky; top: 0; left: 110px; z-index: 14; background: #2c3e50; color: white; width: 100px; min-width: 100px; height: 40px; box-sizing: border-box; border-right: 2px solid #95a5a6; border-bottom: 1px solid #34495e; padding: 10px; text-align: right; box-shadow: 2px 0 5px rgba(0,0,0,0.1);';
                const thScroll = 'position: sticky; top: 0; z-index: 13; background: #2c3e50; color: white; min-width: 100px; height: 40px; box-sizing: border-box; border-right: 1px solid #34495e; border-bottom: 1px solid #34495e; padding: 10px; text-align: right;';

                const thTot1 = 'position: sticky; top: 40px; left: 0; z-index: 14; background: #34495e; color: #f1c40f; width: 40px; min-width: 40px; height: 40px; box-sizing: border-box; border-right: 1px solid #2c3e50; border-bottom: 1px solid #2c3e50; padding: 10px; text-align: center;';
                const thTot2 = 'position: sticky; top: 40px; left: 40px; z-index: 14; background: #34495e; color: #f1c40f; width: 70px; min-width: 70px; height: 40px; box-sizing: border-box; border-right: 1px solid #2c3e50; border-bottom: 1px solid #2c3e50; padding: 10px; text-align: center; font-weight: bold;';
                const thTot3 = 'position: sticky; top: 40px; left: 110px; z-index: 14; background: #34495e; color: #f1c40f; width: 100px; min-width: 100px; height: 40px; box-sizing: border-box; border-right: 2px solid #95a5a6; border-bottom: 1px solid #2c3e50; padding: 10px; text-align: right; font-weight: bold; box-shadow: 2px 0 5px rgba(0,0,0,0.1);';
                const thTotScroll = 'position: sticky; top: 40px; z-index: 13; background: #34495e; color: #f1c40f; min-width: 100px; height: 40px; box-sizing: border-box; border-right: 1px solid #2c3e50; border-bottom: 1px solid #2c3e50; padding: 10px; text-align: right; font-weight: bold;';

                const td1 = 'position: sticky; left: 0; z-index: 12; background: inherit; width: 40px; min-width: 40px; box-sizing: border-box; border-right: 1px solid #eee; border-bottom: 1px solid #eee; padding: 10px; text-align: center;';
                const td2 = 'position: sticky; left: 40px; z-index: 12; background: inherit; width: 70px; min-width: 70px; box-sizing: border-box; border-right: 1px solid #eee; border-bottom: 1px solid #eee; padding: 10px; text-align: center; font-weight: bold; color: #2980b9;';
                const td3 = 'position: sticky; left: 110px; z-index: 12; background: inherit; width: 100px; min-width: 100px; box-sizing: border-box; border-right: 2px solid #bdc3c7; border-bottom: 1px solid #eee; padding: 10px; text-align: right; font-weight: bold; color: #c0392b; box-shadow: 2px 0 5px rgba(0,0,0,0.05);';
                const tdScroll = 'z-index: 11; background: inherit; min-width: 100px; box-sizing: border-box; border-right: 1px solid #eee; border-bottom: 1px solid #eee; padding: 10px; text-align: right;';

                let tableRows = '';
                let headHtml = '';
                let totHtml = '';
                
                if (sortedRooms.length === 0) {
                    tableRows = `<tr><td colspan="6" style="padding: 10px; text-align: center; color: #7f8c8d;">등록된 호실이 없습니다.</td></tr>`;
                } else {
                    // 과거 미납 원금 계산 로직 (단리 계산을 위해 순수 원금만 추적)
                    const roomUnpaidPrincipal = {};
                    sortedRooms.forEach(room => roomUnpaidPrincipal[room] = 0);

                    months.forEach(m => {
                        if (m >= currentMonth) return; // 당월 및 미래 내역 제외
                        const mBill = billingHistory[m];
                        const col = collections[m] || {};
                        
                        let mBaseAmount = 0;
                        if (billingConfig.splitMethod === 'N분의일부과') {
                            const mItemsConfig = mBill.items || {};
                            const mOtherItemsConfig = mBill.otherItems || [];
                            let mRoomBill = 0;
                            Object.values(mItemsConfig).forEach(config => {
                                mRoomBill += Math.ceil(((Number(config.monthlyAmount)||0) / sortedRooms.length) / 10) * 10;
                            });
                            mOtherItemsConfig.forEach(other => {
                                mRoomBill += Math.ceil(((Number(other.amount)||0) / sortedRooms.length) / 10) * 10;
                            });
                            mBaseAmount = mRoomBill;
                        }
                        
                        sortedRooms.forEach(room => {
                            const billed = mBaseAmount;
                            const collected = Number(col[room]?.amount) || 0;
                            const unpaidForMonth = billed - collected;
                            if (unpaidForMonth !== 0) {
                                roomUnpaidPrincipal[room] += unpaidForMonth;
                            }
                        });
                    });
                    
                    let sum_unpaid = 0;
                    let sum_lateFee = 0;
                    let sum_currentBill = 0;
                    let sum_total = 0;

                    sortedRooms.forEach((room, idx) => {
                        let unpaid = roomUnpaidPrincipal[room];
                        if (unpaid < 0) unpaid = 0; // 과납금(초과 수납) 처리 (일단 미납 0원으로 간주)

                        let lateFee = 0;
                        // 미납 원금이 있을 때만 연체료 계산 (단리 방식)
                        if (unpaid > 0) {
                            const method = billingConfig.lateFeeMethod;
                            const val = Number(billingConfig.lateFeeValue) || 0;
                            if (method === 'fixed_rate_monthly') {
                                lateFee = Math.floor(unpaid * (val / 100) / 10) * 10; // 월 이율, 10원 단위 절사
                            } else if (method === 'fixed_rate_annual') {
                                lateFee = Math.floor(unpaid * (val / 100 / 12) / 10) * 10; // 연 이율(월할 간이 계산)
                            } else if (method === 'fixed_amount') {
                                lateFee = val; // 월 고정 금액
                            }
                        }

                        let roomCurrentBill = 0;
                        let roomDetailHtml = '';
                        detailCols.forEach(col => {
                            roomCurrentBill += col.perRoom;
                            col.sum += col.perRoom;
                            roomDetailHtml += `<td style="${tdScroll}">${col.perRoom.toLocaleString()}</td>`;
                        });

                        const total = roomCurrentBill + unpaid + lateFee;

                        sum_unpaid += unpaid;
                        sum_lateFee += lateFee;
                        sum_currentBill += roomCurrentBill;
                        sum_total += total;

                        tableRows += `
                            <tr style="border-bottom: 1px solid #eee; background: #fff;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='#fff'">
                                <td style="${td1}">${idx + 1}</td>
                                <td style="${td2}">${escapeHtml(room)}</td>
                                <td style="${td3}">${total.toLocaleString()}</td>
                                <td style="${tdScroll} color: #e74c3c;">${unpaid.toLocaleString()}</td>
                                <td style="${tdScroll} color: #f39c12;">${lateFee.toLocaleString()}</td>
                                <td style="${tdScroll} color: #2980b9; font-weight: bold;">${roomCurrentBill.toLocaleString()}</td>
                                ${roomDetailHtml}
                            </tr>
                        `;
                    });

                    headHtml = `
                        <tr>
                            <th style="${th1}">No</th>
                            <th style="${th2}">호수</th>
                            <th style="${th3}">부과합계</th>
                            <th style="${thScroll}">미납금</th>
                            <th style="${thScroll}">연체료</th>
                            <th style="${thScroll}">당월부과액</th>
                            ${detailCols.map(col => `<th style="${thScroll}">${escapeHtml(col.name)}</th>`).join('')}
                        </tr>
                    `;

                    totHtml = `
                        <tr>
                            <th style="${thTot1}">-</th>
                            <th style="${thTot2}">합계</th>
                            <th style="${thTot3}">${sum_total.toLocaleString()}</th>
                            <th style="${thTotScroll}">${sum_unpaid.toLocaleString()}</th>
                            <th style="${thTotScroll}">${sum_lateFee.toLocaleString()}</th>
                            <th style="${thTotScroll}">${sum_currentBill.toLocaleString()}</th>
                            ${detailCols.map(col => `<th style="${thTotScroll}">${col.sum.toLocaleString()}</th>`).join('')}
                        </tr>
                    `;
                }

                billContent.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong style="color: #2c3e50; font-size: 14px;">${currentMonth} 세대별 관리비 부과 내역</strong>
                        <span style="font-size: 12px; color: #7f8c8d;">적용방식: ${escapeHtml(billingConfig.splitMethod)}</span>
                    </div>
                    <div style="overflow: auto; max-height: 600px; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); position: relative;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px; white-space: nowrap;">
                            <thead>
                                ${headHtml}
                                ${totHtml}
                            </thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                `;
            } else if (groupId === 'statement') {
                const months = Object.keys(billingHistory).sort().reverse();
                let statementMonth = months.length > 0 ? months[0] : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                let viewMode = 'paper'; // 'paper' or 'online'
                let currentRoom = sortedRooms.length > 0 ? sortedRooms[0] : '';

                const renderStatement = () => {
                    if (!billingHistory[statementMonth]) {
                        billContent.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; background: #f8f9fa; padding: 10px 15px; border-radius: 8px; border: 1px solid #e0e0e0;">
                                <label style="font-size: 13px; font-weight: bold; color: #34495e;">고지서 월:</label>
                                <input type="month" id="stmtMonth" value="${statementMonth}" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin: 0;">
                            </div>
                            <div style="padding: 20px; text-align: center; color: #e74c3c; background: #fdf2e9; border-radius: 8px; border: 1px solid #f8c471; font-weight: bold;">[${statementMonth}] 월의 부과 확정 내역이 없습니다.</div>`;
                        document.getElementById('stmtMonth').addEventListener('change', (e) => { statementMonth = e.target.value; renderStatement(); });
                        return;
                    }

                    // 미납금 계산 (과거 모든 월 순회)
                    const collections = bData.collections || {};
                    const allMonthsAsc = Object.keys(billingHistory).sort();
                    const roomUnpaidPrincipal = {};
                    const roomUnpaidHistory = {}; // 세대별 월별 미납 기록 추적
                    sortedRooms.forEach(room => {
                        roomUnpaidPrincipal[room] = 0;
                        roomUnpaidHistory[room] = [];
                    });

                    allMonthsAsc.forEach(m => {
                        if (m >= statementMonth) return;
                        const mBill = billingHistory[m];
                        const col = collections[m] || {};
                        let mBaseAmount = 0;
                        if (billingConfig.splitMethod === 'N분의일부과') {
                            let mRoomBill = 0;
                            Object.values(mBill.items || {}).forEach(c => mRoomBill += Math.ceil(((Number(c.monthlyAmount)||0) / sortedRooms.length) / 10) * 10);
                            (mBill.otherItems || []).forEach(o => mRoomBill += Math.ceil(((Number(o.amount)||0) / sortedRooms.length) / 10) * 10);
                            mBaseAmount = mRoomBill;
                        }
                        sortedRooms.forEach(room => {
                            const billed = mBaseAmount;
                            const collected = Number(col[room]?.amount) || 0;
                            const unpaidForMonth = billed - collected;
                            if (unpaidForMonth !== 0) {
                                roomUnpaidPrincipal[room] += unpaidForMonth;
                                if (unpaidForMonth > 0) {
                                    roomUnpaidHistory[room].push({ month: m, amount: unpaidForMonth });
                                } else {
                                    // 과납(초과수납)인 경우, 가장 오래된 미납금부터 순차 차감
                                    let overpay = Math.abs(unpaidForMonth);
                                    for (let i = 0; i < roomUnpaidHistory[room].length; i++) {
                                        if (overpay <= 0) break;
                                        if (roomUnpaidHistory[room][i].amount <= overpay) {
                                            overpay -= roomUnpaidHistory[room][i].amount;
                                            roomUnpaidHistory[room][i].amount = 0;
                                        } else {
                                            roomUnpaidHistory[room][i].amount -= overpay;
                                            overpay = 0;
                                        }
                                    }
                                    roomUnpaidHistory[room] = roomUnpaidHistory[room].filter(h => h.amount > 0);
                                }
                            }
                        });
                    });

                    // 공통 호실 데이터 가공 헬퍼 함수
                    const getRoomBillData = (targetRoom) => {
                        let unpaid = roomUnpaidPrincipal[targetRoom] || 0;
                        if (unpaid < 0) unpaid = 0;

                        let lateFee = 0;
                        if (unpaid > 0) {
                            const method = billingConfig.lateFeeMethod;
                            const val = Number(billingConfig.lateFeeValue) || 0;
                            if (method === 'fixed_rate_monthly') lateFee = Math.floor(unpaid * (val / 100) / 10) * 10;
                            else if (method === 'fixed_rate_annual') lateFee = Math.floor(unpaid * (val / 100 / 12) / 10) * 10;
                            else if (method === 'fixed_amount') lateFee = val;
                        }

                        let unpaidList = roomUnpaidHistory[targetRoom] || [];
                        unpaidList = [...unpaidList].reverse();
                        
                        const calcItemLateFee = (principal) => {
                            if (principal <= 0) return 0;
                            const method = billingConfig.lateFeeMethod;
                            const val = Number(billingConfig.lateFeeValue) || 0;
                            if (method === 'fixed_rate_monthly') return Math.floor(principal * (val / 100) / 10) * 10;
                            if (method === 'fixed_rate_annual') return Math.floor(principal * (val / 100 / 12) / 10) * 10;
                            return 0;
                        };

                        let displayUnpaidDetails = [];
                        let sumOldUnpaid = 0;
                        let sumOldLateFee = 0;
                        let distributedLateFee = 0;

                        for (let i = 0; i < 4; i++) {
                            if (i < unpaidList.length) {
                                const p = unpaidList[i].amount;
                                let f = calcItemLateFee(p);
                                if (billingConfig.lateFeeMethod === 'fixed_amount') f = 0;
                                displayUnpaidDetails.push({ month: unpaidList[i].month, amount: p, fee: f, isEmpty: false });
                                distributedLateFee += f;
                            } else {
                                displayUnpaidDetails.push({ month: '-', amount: 0, fee: 0, isEmpty: true });
                            }
                        }

                        for (let i = 4; i < unpaidList.length; i++) {
                            sumOldUnpaid += unpaidList[i].amount;
                        }

                        sumOldLateFee = lateFee - distributedLateFee;
                        if (sumOldLateFee < 0) {
                            if (displayUnpaidDetails[0] && !displayUnpaidDetails[0].isEmpty) {
                                displayUnpaidDetails[0].fee += sumOldLateFee;
                            }
                            sumOldLateFee = 0;
                        }

                        let unpaidTableHtml = `
                            <tr>
                                <th style="border: 1px solid #ccc; padding: 6px; background: #fdf2e9; text-align: center; width: 34%;">부과월</th>
                                <th style="border: 1px solid #ccc; padding: 6px; background: #fdf2e9; text-align: center; width: 33%;">미납원금</th>
                                <th style="border: 1px solid #ccc; padding: 6px; background: #fdf2e9; text-align: center; width: 33%;">연체료</th>
                            </tr>
                        `;
                        displayUnpaidDetails.forEach(d => {
                            unpaidTableHtml += `
                                <tr>
                                    <td style="border: 1px solid #ccc; padding: 6px; text-align: center; ${d.isEmpty ? 'color: #bdc3c7;' : ''}">${escapeHtml(d.month)}</td>
                                    <td style="border: 1px solid #ccc; padding: 6px; text-align: right; ${d.isEmpty ? 'color: #bdc3c7;' : ''}">${d.amount > 0 ? d.amount.toLocaleString() : '-'}</td>
                                    <td style="border: 1px solid #ccc; padding: 6px; text-align: right; ${d.isEmpty ? 'color: #bdc3c7;' : ''}">${d.fee > 0 ? d.fee.toLocaleString() : '-'}</td>
                                </tr>
                            `;
                        });
                        unpaidTableHtml += `
                            <tr>
                                <td style="border: 1px solid #ccc; padding: 6px; text-align: center; ${sumOldUnpaid === 0 ? 'color: #bdc3c7;' : ''}">5개월 이상</td>
                                <td style="border: 1px solid #ccc; padding: 6px; text-align: right; ${sumOldUnpaid === 0 ? 'color: #bdc3c7;' : ''}">${sumOldUnpaid > 0 ? sumOldUnpaid.toLocaleString() : '-'}</td>
                                <td style="border: 1px solid #ccc; padding: 6px; text-align: right; ${sumOldLateFee === 0 ? 'color: #bdc3c7;' : ''}">${sumOldLateFee > 0 ? sumOldLateFee.toLocaleString() : '-'}</td>
                            </tr>
                            <tr>
                                <th style="border: 2px solid #e74c3c; padding: 6px; background: #fadbd8; text-align: center;">합계</th>
                                <td style="border: 2px solid #e74c3c; padding: 6px; text-align: right; font-weight: bold; color: #c0392b;">${unpaid > 0 ? unpaid.toLocaleString() : '0'}</td>
                                <td style="border: 2px solid #e74c3c; padding: 6px; text-align: right; font-weight: bold; color: #c0392b;">${lateFee > 0 ? lateFee.toLocaleString() : '0'}</td>
                            </tr>
                        `;

                        const bill = billingHistory[statementMonth];
                        let roomCurrentBill = 0;
                        const details = [];
                        
                        if (billingConfig.splitMethod === 'N분의일부과') {
                            Object.entries(bill.items || {}).forEach(([name, config]) => {
                                const amt = Math.ceil(((Number(config.monthlyAmount)||0) / sortedRooms.length) / 10) * 10;
                                roomCurrentBill += amt;
                                details.push({ name, amt });
                            });
                            (bill.otherItems || []).forEach(o => {
                                const amt = Math.ceil(((Number(o.amount)||0) / sortedRooms.length) / 10) * 10;
                                roomCurrentBill += amt;
                                details.push({ name: o.name, amt });
                            });
                        }

                        const totalAmount = roomCurrentBill + unpaid + lateFee;
                        
                        let futureLateFee = 0;
                        if (roomCurrentBill > 0) {
                            const method = billingConfig.lateFeeMethod;
                            const val = Number(billingConfig.lateFeeValue) || 0;
                            if (method === 'fixed_rate_monthly') futureLateFee = Math.floor(roomCurrentBill * (val / 100) / 10) * 10;
                            else if (method === 'fixed_rate_annual') futureLateFee = Math.floor(roomCurrentBill * (val / 100 / 12) / 10) * 10;
                            else if (method === 'fixed_amount') futureLateFee = val;
                        }
                        const afterDueDateAmount = totalAmount + futureLateFee;

                        return { unpaid, lateFee, unpaidTableHtml, roomCurrentBill, details, totalAmount, futureLateFee, afterDueDateAmount };
                    };

                    const dueDate = billingConfig.dueDate || '말일';
                    const noticeText = billingConfig.noticeText || '';
                    const bName = bData.name || '우리건물';
                    
                    const [smYear, smMonth] = statementMonth.split('-');
                    const statementMonthKo = `${smYear}년 ${smMonth}월`;
                    
                    // 납기일 날짜 정확히 계산
                    let dueDay = dueDate;
                    if (dueDate === '말일') dueDay = new Date(smYear, smMonth, 0).getDate();
                    const dueDateStr = `${smYear}년 ${smMonth}월 ${dueDay}일`;

                    // 청구기간 계산 (당월/익월 부과 기준 반영)
                    let targetYear = parseInt(smYear, 10);
                    let targetMonth = parseInt(smMonth, 10);
                    if (billingConfig.billTiming === '익월부과') {
                        targetMonth -= 1;
                        if (targetMonth === 0) {
                            targetMonth = 12;
                            targetYear -= 1;
                        }
                    }
                    const lastDayOfTarget = new Date(targetYear, targetMonth, 0).getDate();
                    const billingPeriodStr = `${targetYear}년 ${String(targetMonth).padStart(2, '0')}월 01일 ~ ${targetYear}년 ${String(targetMonth).padStart(2, '0')}월 ${lastDayOfTarget}일`;

                    const c1Name = billingConfig.contact1Name !== undefined ? billingConfig.contact1Name : '관리사무소'; const c1Phone = billingConfig.contact1Phone || '';
                    const c2Name = billingConfig.contact2Name !== undefined ? billingConfig.contact2Name : '관리비 문의'; const c2Phone = billingConfig.contact2Phone || '';
                    const c3Name = billingConfig.contact3Name !== undefined ? billingConfig.contact3Name : '관리소장'; const c3Phone = billingConfig.contact3Phone || '';

                    const bankAccounts = bData.bankAccounts || [];
                    const mainBank = {
                        bank: billingConfig.bankName || (bankAccounts.length > 0 ? bankAccounts[0].bank : '등록된 은행 없음'),
                        accountNumber: billingConfig.accountNumber || (bankAccounts.length > 0 ? bankAccounts[0].accountNumber : ''),
                        owner: billingConfig.accountOwner || (bankAccounts.length > 0 ? bankAccounts[0].owner : '')
                    };

                    // 종이고지서 A4 HTML 생성 헬퍼 함수 (출력 및 미리보기용)
                    const getPaperBillHtml = (roomName, isPreview = false) => {
                        const { unpaid, lateFee, unpaidTableHtml, roomCurrentBill, details, totalAmount, futureLateFee, afterDueDateAmount } = getRoomBillData(roomName);
                        const householdsConfig = bData.households || {};
                        const roomInfo = householdsConfig[roomName] || {};
                        const residentName = roomInfo.residentName || '입주자';
                        const displayRoom = roomName.endsWith('호') ? roomName : roomName + '호';

                        const containerStyle = isPreview
                            ? "width: 210mm; min-height: 297mm; background: white; margin: 0 auto; box-shadow: 0 4px 15px rgba(0,0,0,0.1); position: relative; font-family: 'Malgun Gothic', sans-serif; color: #000; box-sizing: border-box; word-break: keep-all;"
                            : "width: 210mm; height: 297mm; background: white; margin: 0; position: relative; font-family: 'Malgun Gothic', sans-serif; color: #000; box-sizing: border-box; page-break-after: always; overflow: hidden; word-break: keep-all;";

                        return `
                            <div class="a4-bill-page" style="${containerStyle}">
                                <!-- 3단 접기 점선 가이드 -->
                                <div style="position: absolute; top: 99mm; left: 0; width: 100%; border-top: 1px dashed #bdc3c7;"></div>
                                <div style="position: absolute; top: 198mm; left: 0; width: 100%; border-top: 1px dashed #bdc3c7;"></div>
                                
                                <!-- 1단, 2단, 3단 컨텐츠 로직 (이전 코드와 동일하게 삽입) -->
                                <div style="height: 99mm; padding: 6mm 15mm; box-sizing: border-box; display: flex; flex-direction: column;">
                                    <div style="flex: 1; display: flex; gap: 30px; margin-bottom: 15px;">
                                        <div style="flex: 1; display: flex; flex-direction: column;">
                                            <div style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding-bottom: 15px;">
                                                <div><div style="font-size: 14px; color: #555;">보내는 사람</div><div style="font-size: 18px; font-weight: bold; margin-top: 5px;">${escapeHtml(bName)} 관리사무소</div></div>
                                                <div style="text-align: right; margin-top: auto;"><div style="font-size: 14px; color: #555;">받는 사람</div><div style="font-size: 24px; font-weight: bold; margin-top: 5px;">${escapeHtml(displayRoom)} ${escapeHtml(residentName)} 귀하</div></div>
                                            </div>
                                            <div style="flex: 0 0 auto; background: #f8f9fa; border: 1px dashed #bdc3c7; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; justify-content: center;">
                                                <div style="font-size: 13px; font-weight: bold; color: #2980b9; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;"><span style="font-size: 16px;">📱</span> GoNard 온라인 고지서 안내</div>
                                                <div style="font-size: 11px; color: #7f8c8d; line-height: 1.4; word-break: keep-all;">스마트폰에서 <strong>GoNard(고나드)</strong>에 가입하시면 매월 고지서를 모바일로 편리하게 확인하고, 지난 청구 내역을 손쉽게 관리할 수 있습니다.</div>
                                            </div>
                                        </div>
                                        <div style="flex: 1; display: flex; flex-direction: column;">
                                            <div style="flex: 0 0 auto; text-align: center; font-size: 20px; font-weight: bold; letter-spacing: 2px; color: #2c3e50; margin-bottom: 12px; border: 2px solid #2c3e50; padding: 6px; border-radius: 8px; background: #f8f9fa;">${statementMonthKo} 관리비 고지서</div>
                                            <div style="flex: 1; font-size: 12px; line-height: 1.5; border: 1px solid #ccc; padding: 10px; background: #fcfcfc; overflow: hidden; border-radius: 8px;"><strong style="font-size: 14px; color: #2c3e50; display: block; border-bottom: 2px solid #2c3e50; padding-bottom: 4px; margin-bottom: 6px;">[안내 말씀]</strong>${escapeHtml(noticeText).replace(/\n/g, '<br>')}</div>
                                        </div>
                                    </div>
                                    <div style="flex: 0 0 auto; display: flex; justify-content: space-between; text-align: center; font-size: 11px; color: #34495e; border: 1px solid #ccc; background: #f8f9fa; padding: 6px; border-radius: 6px;">
                                        <div style="flex: 1; border-right: 1px solid #ddd;">${(c1Name || c1Phone) ? `<strong>${escapeHtml(c1Name)}</strong> : ${escapeHtml(c1Phone)}` : '&nbsp;'}</div>
                                        <div style="flex: 1; border-right: 1px solid #ddd;">${(c2Name || c2Phone) ? `<strong>${escapeHtml(c2Name)}</strong> : ${escapeHtml(c2Phone)}` : '&nbsp;'}</div>
                                        <div style="flex: 1;">${(c3Name || c3Phone) ? `<strong>${escapeHtml(c3Name)}</strong> : ${escapeHtml(c3Phone)}` : '&nbsp;'}</div>
                                    </div>
                                </div>
                                <div style="height: 99mm; padding: 10mm 15mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center;">
                                    <div style="display: flex; gap: 20px; align-items: stretch;">
                                        <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start;">
                                            <h3 style="margin: 0 0 8px 0; border-bottom: 2px solid #000; padding-bottom: 4px; font-size: 15px; display: flex; justify-content: space-between; align-items: baseline;"><span>청구 내역</span> <span style="font-size: 14px; color: #2c3e50; font-weight: bold;">${statementMonthKo}분</span></h3>
                                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                                <tr><th style="border: 2px solid #000; padding: 10px; background: #f0f0f0; width: 40%; font-size: 14px;">납기내 금액</th><td style="border: 2px solid #000; padding: 10px; text-align: right; font-size: 18px; font-weight: bold; color: #e74c3c;">${totalAmount.toLocaleString()} 원</td></tr>
                                                <tr><th style="border: 1px solid #333; padding: 8px; background: #fafafa;">당월 부과액</th><td style="border: 1px solid #333; padding: 8px; text-align: right; font-weight: bold;">${roomCurrentBill.toLocaleString()} 원</td></tr>
                                                <tr><th style="border: 1px solid #333; padding: 8px; background: #fafafa;">미납 원금</th><td style="border: 1px solid #333; padding: 8px; text-align: right;">${unpaid.toLocaleString()} 원</td></tr>
                                                <tr><th style="border: 1px solid #333; padding: 8px; background: #fafafa;">미납 연체료</th><td style="border: 1px solid #333; padding: 8px; text-align: right;">${lateFee.toLocaleString()} 원</td></tr>
                                                <tr><th style="border: 1px solid #333; padding: 8px; background: #fafafa;">납부 기한</th><td style="border: 1px solid #333; padding: 8px; text-align: right; font-weight: bold; color: #2980b9;">${dueDateStr} 까지</td></tr>
                                                <tr><th style="border: 2px solid #d35400; padding: 8px; background: #fdf2e9; color: #d35400;">납기후 금액</th><td style="border: 2px solid #d35400; padding: 8px; text-align: right; font-weight: bold; color: #d35400; font-size: 15px;">${afterDueDateAmount.toLocaleString()} 원</td></tr>
                                                <tr><th style="border: 1px solid #333; padding: 8px; background: #fafafa;">납부 계좌</th><td style="border: 1px solid #333; padding: 8px; text-align: right; line-height: 1.4;">${escapeHtml(mainBank.bank)} ${escapeHtml(mainBank.accountNumber)}<br>(예금주: ${escapeHtml(mainBank.owner)})</td></tr>
                                            </table>
                                        </div>
                                        <div style="flex: 1; display: flex; flex-direction: column;">
                                            <div style="flex: 1; background: #e8f4f8; border: 1px solid #bce0fd; border-radius: 6px; display: flex; flex-direction: column; justify-content: center; align-items: center; margin-bottom: 12px; min-height: 55px;"><div style="font-size: 13px; font-weight: bold; color: #2980b9; margin-bottom: 4px;">청구 기간</div><div style="font-size: 14px; font-weight: bold; color: #2c3e50;">${billingPeriodStr}</div></div>
                                            <div style="flex: 4; display: flex; flex-direction: column; justify-content: flex-start;"><h3 style="margin: 0 0 8px 0; border-bottom: 2px solid #000; padding-bottom: 4px; font-size: 15px; color: #c0392b;">미납 상세 내역</h3><table style="width: 100%; border-collapse: collapse; font-size: 12px;">${unpaidTableHtml}</table></div>
                                        </div>
                                    </div>
                                    <div style="flex: 0 0 auto; font-size: 11px; color: #7f8c8d; margin-top: 10px; line-height: 1.4; background: #fdfefe; border: 1px solid #eee; padding: 6px 10px; border-radius: 4px; text-align: left;">※ <strong>납기후 금액</strong>이란? 납부 기한을 넘겨서 납부하실 경우, 당월 부과액에 대한 연체료(${futureLateFee > 0 ? futureLateFee.toLocaleString()+'원' : '설정없음'})가 가산된 총 결제 금액입니다.</div>
                                </div>
                                <div style="height: 99mm; padding: 6mm 15mm; box-sizing: border-box; font-size: 12px;">
                                    <h3 style="margin: 0 0 12px 0; border-bottom: 2px solid #000; padding-bottom: 5px; font-size: 16px;">당월 부과 상세 내역</h3>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; column-gap: 30px; row-gap: 6px;">${details.map(d => `<div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #ccc; padding-bottom: 3px;"><span>${escapeHtml(d.name)}</span><span>${d.amt.toLocaleString()}</span></div>`).join('')}</div>
                                    <div style="margin-top: 15px; border-top: 2px solid #333; padding-top: 8px; display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;"><span>당월 부과액 합계</span><span>${roomCurrentBill.toLocaleString()} 원</span></div>
                                </div>
                            </div>
                        `;
                    };

                    let previewHtml = '';
                    if (viewMode === 'paper') {
                        previewHtml = getPaperBillHtml(currentRoom, true);
                    } else {
                        const { unpaid, lateFee, unpaidTableHtml, roomCurrentBill, details, totalAmount, futureLateFee, afterDueDateAmount } = getRoomBillData(currentRoom);
                        const householdsConfig = bData.households || {};
                        const roomInfo = householdsConfig[currentRoom] || {};
                        const residentName = roomInfo.residentName || '입주자';
                        const displayRoom = currentRoom.endsWith('호') ? currentRoom : currentRoom + '호';

                        previewHtml = `
                            <div style="width: 100%; max-width: 400px; background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); margin: 0 auto; overflow: hidden; font-family: 'Pretendard', sans-serif; box-sizing: border-box;">
                                <div style="background: linear-gradient(135deg, #2980b9, #2c3e50); color: white; padding: 20px 15px; text-align: center; position: relative;">
                                    <div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">${escapeHtml(bName)}</div>
                                    <h2 style="margin: 0 0 4px 0; font-size: 20px;">${statementMonthKo} 관리비</h2>
                                    <p style="margin: 0; font-size: 14px; font-weight: 500;">${escapeHtml(displayRoom)} ${escapeHtml(residentName)}님</p>
                                </div>
                                <div style="padding: 15px;">
                                    <div style="text-align: center; margin-bottom: 15px;">
                                        <div style="font-size: 12px; color: #7f8c8d; margin-bottom: 2px;">납기내 총 결제 금액</div>
                                        <div style="font-size: 28px; font-weight: bold; color: #e74c3c; line-height: 1.2;">${totalAmount.toLocaleString()} <span style="font-size: 18px; color: #333;">원</span></div>
                                        <div style="font-size: 12px; color: #34495e; margin-top: 8px; background: #f8f9fa; padding: 6px; border-radius: 6px;">납부기한: <strong>${dueDateStr} 까지</strong></div>
                                    </div>
                                    
                                    <div style="background: #e8f4f8; border: 1px solid #bce0fd; border-radius: 8px; padding: 10px; text-align: center; margin-bottom: 15px;">
                                        <div style="font-size: 11px; font-weight: bold; color: #2980b9; margin-bottom: 2px;">청구 기간</div>
                                        <div style="font-size: 13px; font-weight: bold; color: #2c3e50;">${billingPeriodStr}</div>
                                    </div>

                                    <h3 style="font-size: 13px; color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: baseline;">
                                        <span>청구 내역</span> <span style="font-size: 12px; color: #2c3e50; font-weight: bold;">${statementMonthKo}분</span>
                                    </h3>
                                    <div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #555; margin-bottom: 20px;">
                                        <div style="display: flex; justify-content: space-between;"><span>당월 부과액</span><strong>${roomCurrentBill.toLocaleString()} 원</strong></div>
                                        ${unpaid > 0 ? `<div style="display: flex; justify-content: space-between; color: #e74c3c;"><span>미납 원금</span><strong>${unpaid.toLocaleString()} 원</strong></div>` : ''}
                                        ${lateFee > 0 ? `<div style="display: flex; justify-content: space-between; color: #f39c12;"><span>미납 연체료</span><strong>${lateFee.toLocaleString()} 원</strong></div>` : ''}
                                        <div style="display: flex; justify-content: space-between; color: #d35400; margin-top: 4px; padding-top: 6px; border-top: 1px dashed #eee;">
                                            <span>납기후 금액</span><strong style="font-size: 14px;">${afterDueDateAmount.toLocaleString()} 원</strong>
                                        </div>
                                        <div style="font-size: 10px; color: #95a5a6; margin-top: 2px; text-align: left; line-height: 1.3;">※ 납기 후에는 당월 연체료가 가산된 위 금액으로 납부하셔야 합니다.</div>
                                    </div>

                                    <h3 style="font-size: 13px; color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">미납 상세 내역</h3>
                                    ${unpaid > 0 ? `
                                        <div style="background: #fdfefe; margin-bottom: 20px; border-radius: 8px; overflow: hidden;">
                                            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                                ${unpaidTableHtml}
                                            </table>
                                        </div>
                                    ` : `
                                        <div style="text-align: center; padding: 15px; color: #7f8c8d; background: #fafafa; border-radius: 8px; border: 1px dashed #ccc; margin-bottom: 20px; font-size: 12px;">미납된 관리비가 없습니다.</div>
                                    `}

                                    <h3 style="font-size: 13px; color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">상세 부과 내역</h3>
                                    <div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #555; margin-bottom: 15px; background: #fdfefe; padding: 10px; border: 1px solid #eee; border-radius: 8px;">
                                        ${details.map(d => `
                                            <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #f0f0f0; padding-bottom: 4px;">
                                                <span style="flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-right: 10px;">${escapeHtml(d.name)}</span>
                                                <strong style="flex-shrink: 0;">${d.amt.toLocaleString()} 원</strong>
                                            </div>
                                        `).join('')}
                                    </div>
                                    
                                    <h3 style="font-size: 13px; color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 4px; margin-bottom: 8px;">납부 계좌</h3>
                                    <div style="background: #e8f4f8; border: 1px solid #bce0fd; padding: 10px; border-radius: 8px; text-align: center; font-size: 13px; color: #2980b9; margin-bottom: 15px; word-break: keep-all;">
                                        <strong>${escapeHtml(mainBank.bank)}</strong><br>${escapeHtml(mainBank.accountNumber)}<br><span style="font-size: 11px; color: #34495e;">예금주: ${escapeHtml(mainBank.owner)}</span>
                                    </div>
                                    
                                    <div style="font-size: 11px; color: #7f8c8d; line-height: 1.4; background: #fdfefe; padding: 8px; border: 1px solid #eee; border-radius: 8px;">
                                        ${escapeHtml(noticeText).replace(/\n/g, '<br>')}
                                    </div>
                                    
                                    <div style="font-size: 12px; color: #555; display: flex; flex-direction: column; gap: 8px; margin-top: 15px; padding: 15px 10px; border-top: 1px dashed #eee; background: #f8f9fa; border-radius: 8px; text-align: center;">
                                        ${(c1Name || c1Phone) ? `<div><strong>${escapeHtml(c1Name)}</strong> : <strong style="color:#2c3e50;">${escapeHtml(c1Phone)}</strong></div>` : ''}
                                        ${(c2Name || c2Phone) ? `<div><strong>${escapeHtml(c2Name)}</strong> : <strong style="color:#2c3e50;">${escapeHtml(c2Phone)}</strong></div>` : ''}
                                        ${(c3Name || c3Phone) ? `<div><strong>${escapeHtml(c3Name)}</strong> : <strong style="color:#2c3e50;">${escapeHtml(c3Phone)}</strong></div>` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                    }

                    billContent.innerHTML = `
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0; display: flex; flex-wrap: wrap; gap: 15px; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <label style="font-size: 13px; font-weight: bold; color: #34495e;">고지서 월:</label>
                                    <input type="month" id="stmtMonth" value="${statementMonth}" style="padding: 6px; border: 1px solid #ccc; border-radius: 4px; margin: 0; font-size: 13px;">
                                </div>
                                <div style="display: flex; align-items: center; gap: 5px;">
                                    <label style="font-size: 13px; font-weight: bold; color: #34495e;">조회 호실:</label>
                                    <select id="stmtRoom" style="padding: 6px; border: 1px solid #ccc; border-radius: 4px; margin: 0; font-size: 13px; min-width: 80px;">
                                        ${sortedRooms.map(r => `<option value="${r}" ${r===currentRoom?'selected':''}>${escapeHtml(r.endsWith('호') ? r : r + '호')}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <div style="display: flex; background: #ecf0f1; border-radius: 6px; padding: 3px;">
                                <button id="modePaperBtn" style="background: ${viewMode==='paper'?'#fff':'transparent'}; border: none; padding: 6px 12px; border-radius: 4px; font-size: 13px; font-weight: ${viewMode==='paper'?'bold':'normal'}; color: ${viewMode==='paper'?'#2c3e50':'#7f8c8d'}; cursor: pointer; box-shadow: ${viewMode==='paper'?'0 1px 3px rgba(0,0,0,0.1)':'none'}; transition: all 0.2s;">종이고지서(A4)</button>
                                <button id="modeOnlineBtn" style="background: ${viewMode==='online'?'#fff':'transparent'}; border: none; padding: 6px 12px; border-radius: 4px; font-size: 13px; font-weight: ${viewMode==='online'?'bold':'normal'}; color: ${viewMode==='online'?'#2980b9':'#7f8c8d'}; cursor: pointer; box-shadow: ${viewMode==='online'?'0 1px 3px rgba(0,0,0,0.1)':'none'}; transition: all 0.2s;">온라인고지서(Nard)</button>
                            </div>
                        </div>

                        <!-- 뷰 영역 -->
                        <div style="background: #ecf0f1; padding: 10px; border-radius: 8px; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 20px; text-align: center;">
                            <div style="display: inline-block; text-align: left; width: 100%; min-width: fit-content;">
                                ${previewHtml}
                            </div>
                        </div>

                        <!-- 하단 액션 버튼 -->
                        <div style="display: flex; justify-content: flex-end; gap: 10px;">
                            ${viewMode === 'paper' 
                                ? `<button id="btnExportModal" style="background: #8e44ad; color: white; border: none; padding: 10px 20px; border-radius: 4px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 18px;">download</span> 내보내기</button>
                                   <button id="btnPrintModal" style="background: #2c3e50; color: white; border: none; padding: 10px 20px; border-radius: 4px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 18px;">print</span> 인쇄하기</button>`
                                : `<button id="sendNardBtn" style="background: #2980b9; color: white; border: none; padding: 10px 20px; border-radius: 4px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 6px;"><span class="material-symbols-outlined" style="font-size: 18px;">send</span> 나드로 고지서 발송</button>`
                            }
                        </div>
                    `;

                    // 출력 및 내보내기 공통 모달 UI 주입
                    billContent.innerHTML += `
                        <div id="bamModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:6000; justify-content:center; align-items:center;">
                            <div style="background:white; padding:25px; border-radius:12px; width:90%; max-width:400px; box-shadow:0 4px 20px rgba(0,0,0,0.2);">
                                <h3 id="bamTitle" style="margin-top:0; color:#2c3e50; margin-bottom: 20px;">고지서 인쇄 / 내보내기</h3>
                                
                                <div id="bamFormatGroup" style="margin-bottom:15px;">
                                    <label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:5px; font-weight:bold;">내보내기 형식</label>
                                    <select id="bamFormat" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px; font-size:13px; outline:none;">
                                        <option value="pdf">PDF 문서 (다중 페이지)</option>
                                        <option value="jpg">JPG 이미지 (개별 파일)</option>
                                    </select>
                                </div>

                                <div style="margin-bottom:15px;">
                                    <label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:5px; font-weight:bold;">대상 세대 선택</label>
                                    <select id="bamTarget" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px; font-size:13px; outline:none;">
                                        <option value="current">현재 화면 호실 (${escapeHtml(currentRoom)})</option>
                                        <option value="all">전체 호실 일괄 처리 (${sortedRooms.length}세대)</option>
                                        <option value="select">일부 호실 직접 선택...</option>
                                    </select>
                                </div>

                                <div id="bamRoomSelectGroup" style="display:none; margin-bottom:15px; max-height:180px; overflow-y:auto; border:1px solid #eee; border-radius:4px; padding:10px; background:#f8f9fa;">
                                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                                        ${sortedRooms.map(r => `<label style="display:flex; align-items:center; gap:5px; font-size:13px; cursor:pointer;"><input type="checkbox" class="bam-room-cb" value="${r}" checked style="margin:0; width:16px; height:16px;"> ${escapeHtml(r)}</label>`).join('')}
                                    </div>
                                </div>

                                <div style="display:flex; gap:10px; margin-top: 25px;">
                                    <button id="bamExecuteBtn" style="flex:1; background:#2980b9; color:white; padding:12px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">실행</button>
                                    <button id="bamCancelBtn" style="flex:1; background:#95a5a6; color:white; padding:12px; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">취소</button>
                                </div>
                            </div>
                        </div>
                    `;

                    // Event Listeners
                    document.getElementById('stmtMonth').addEventListener('change', (e) => { statementMonth = e.target.value; renderStatement(); });
                    document.getElementById('stmtRoom').addEventListener('change', (e) => { currentRoom = e.target.value; renderStatement(); });
                    document.getElementById('modePaperBtn').addEventListener('click', () => { viewMode = 'paper'; renderStatement(); });
                    document.getElementById('modeOnlineBtn').addEventListener('click', () => { viewMode = 'online'; renderStatement(); });

                    if (viewMode === 'paper') {
                        let currentBamAction = 'print'; // 'print' or 'export'
                        
                        const openBamModal = (action) => {
                            currentBamAction = action;
                            document.getElementById('bamTitle').textContent = action === 'print' ? '고지서 인쇄' : '고지서 내보내기 (다운로드)';
                            document.getElementById('bamFormatGroup').style.display = action === 'export' ? 'block' : 'none';
                            document.getElementById('bamModal').style.display = 'flex';
                        };

                        document.getElementById('btnPrintModal').addEventListener('click', () => openBamModal('print'));
                        document.getElementById('btnExportModal').addEventListener('click', () => openBamModal('export'));
                        document.getElementById('bamCancelBtn').addEventListener('click', () => document.getElementById('bamModal').style.display = 'none');

                        document.getElementById('bamTarget').addEventListener('change', (e) => {
                            document.getElementById('bamRoomSelectGroup').style.display = e.target.value === 'select' ? 'block' : 'none';
                        });

                        document.getElementById('bamExecuteBtn').addEventListener('click', async () => {
                            let targets = [];
                            const mode = document.getElementById('bamTarget').value;
                            if (mode === 'current') targets = [currentRoom];
                            else if (mode === 'all') targets = sortedRooms;
                            else {
                                targets = Array.from(document.querySelectorAll('.bam-room-cb:checked')).map(cb => cb.value);
                            }
                            
                            if (targets.length === 0) return alert('선택된 대상 호실이 없습니다.');
                            
                            const execBtn = document.getElementById('bamExecuteBtn');
                            execBtn.disabled = true;
                            execBtn.textContent = '처리 중...';

                            try {
                                if (currentBamAction === 'print') {
                                    // 인쇄 모드
                                    const htmlStr = targets.map(r => getPaperBillHtml(r, false)).join('');
                                    const printWindow = window.open('', '_blank');
                                    printWindow.document.write(`
                                        <html><head>
                                            <title>고지서 인쇄</title>
                                            <style>@page { size: A4 portrait; margin: 0; } body { margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style>
                                        </head><body>
                                            ${htmlStr}
                                            <script>window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 500); }<\/script>
                                        </body></html>
                                    `);
                                    printWindow.document.close();
                                    document.getElementById('bamModal').style.display = 'none';
                                } else {
                                    // 내보내기 모드 (PDF, JPG)
                                    const format = document.getElementById('bamFormat').value;
                                    
                                    // 라이브러리 동적 로드 (안되어 있는 경우)
                                    const loadScript = (src) => new Promise(resolve => {
                                        if(document.querySelector(`script[src="${src}"]`)) return resolve();
                                        const s = document.createElement('script'); s.src = src; s.onload = resolve; document.head.appendChild(s);
                                    });
                                    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
                                    if (format === 'pdf') {
                                        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
                                    }

                                    const hiddenDiv = document.createElement('div');
                                    hiddenDiv.style.position = 'absolute'; hiddenDiv.style.left = '-9999px'; hiddenDiv.style.top = '0';
                                    document.body.appendChild(hiddenDiv);

                                    if (format === 'pdf') {
                                        const { jsPDF } = window.jspdf;
                                        const pdf = new jsPDF('p', 'mm', 'a4');
                                        
                                        for (let i = 0; i < targets.length; i++) {
                                            hiddenDiv.innerHTML = getPaperBillHtml(targets[i], false);
                                            const canvas = await html2canvas(hiddenDiv.firstElementChild, { scale: 2, useCORS: true });
                                            const imgData = canvas.toDataURL('image/jpeg', 0.95);
                                            if (i > 0) pdf.addPage();
                                            pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
                                        }
                                        pdf.save(`고지서_${statementMonth}_${targets.length}세대.pdf`);
                                    } else {
                                        // JPG 다운로드 (브라우저 다중 다운로드 허용 필요할 수 있음)
                                        for (let i = 0; i < targets.length; i++) {
                                            hiddenDiv.innerHTML = getPaperBillHtml(targets[i], false);
                                            const canvas = await html2canvas(hiddenDiv.firstElementChild, { scale: 2, useCORS: true });
                                            const imgData = canvas.toDataURL('image/jpeg', 0.95);
                                            const link = document.createElement('a');
                                            link.href = imgData; link.download = `고지서_${statementMonth}_${targets[i]}.jpg`;
                                            link.click();
                                            await new Promise(r => setTimeout(r, 200)); // 다운로드 간 간격 확보
                                        }
                                    }
                                    document.body.removeChild(hiddenDiv);
                                    document.getElementById('bamModal').style.display = 'none';
                                    alert('내보내기가 완료되었습니다.');
                                }
                            } catch (e) {
                                console.error(e);
                                alert('처리 중 오류가 발생했습니다.');
                            } finally {
                                execBtn.disabled = false;
                                execBtn.textContent = '실행';
                            }
                        });
                    } else {
                        document.getElementById('sendNardBtn').addEventListener('click', () => {
                            alert(`안내: ${currentRoom}호 입주민의 나드로 고지서가 자동 발송되는 기능은 추후 연동될 예정입니다.\n(입주민이 회원가입 시 공유 나드를 통해 해당 세대원에게만 고지서가 전달되게 됩니다.)`);
                        });
                    }
                };

                renderStatement();
            } else if (groupId === 'settings') {
                const dueDate = billingConfig.dueDate || '말일';
                const lateFeeMethod = billingConfig.lateFeeMethod || 'none';
                const lateFeeValue = billingConfig.lateFeeValue || 0;
                const noticeText = billingConfig.noticeText || '관리비 납부에 감사드립니다. 기한 내 납부 부탁드립니다.';
                const bankName = billingConfig.bankName || '';
                const accountNumber = billingConfig.accountNumber || '';
                const accountOwner = billingConfig.accountOwner || '';
                
                const c1Name = billingConfig.contact1Name !== undefined ? billingConfig.contact1Name : '관리사무소';
                const c1Phone = billingConfig.contact1Phone || '';
                const c2Name = billingConfig.contact2Name !== undefined ? billingConfig.contact2Name : '관리비 문의';
                const c2Phone = billingConfig.contact2Phone || '';
                const c3Name = billingConfig.contact3Name !== undefined ? billingConfig.contact3Name : '관리소장';
                const c3Phone = billingConfig.contact3Phone || '';

                let dueDateOptions = '';
                for(let i=1; i<=28; i++) dueDateOptions += `<option value="${i}" ${dueDate == i ? 'selected' : ''}>매월 ${i}일</option>`;
                dueDateOptions += `<option value="말일" ${dueDate === '말일' ? 'selected' : ''}>매월 말일</option>`;

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

                        <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">납부 마감일</label>
                        <select id="bcDueDate" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 15px; box-sizing: border-box;">
                            ${dueDateOptions}
                        </select>

                        <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">미납 연체료 부과 방식 (표준관리규약 권장사항: 연이율 기준 지연일수 일할계산)</label>
                        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                            <select id="bcLateFeeMethod" style="flex: 2; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                                <option value="none" ${lateFeeMethod === 'none' ? 'selected' : ''}>연체료 없음</option>
                                <option value="fixed_rate_annual" ${lateFeeMethod === 'fixed_rate_annual' ? 'selected' : ''}>연 이율 (%) 일할 계산 - 최대 연 15% 권장</option>
                                <option value="fixed_rate_monthly" ${lateFeeMethod === 'fixed_rate_monthly' ? 'selected' : ''}>월 고정 비율 (%) 부과</option>
                                <option value="fixed_amount" ${lateFeeMethod === 'fixed_amount' ? 'selected' : ''}>월 고정 금액 (원) 부과</option>
                            </select>
                            <input type="number" id="bcLateFeeValue" value="${lateFeeValue}" placeholder="비율/금액 수치" style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; display: ${lateFeeMethod === 'none' ? 'none' : 'block'};">
                        </div>

                        <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">입금 계좌 정보</label>
                        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                            <input type="text" id="bcBankName" value="${escapeHtml(bankName)}" placeholder="은행명 (예: 국민은행)" style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                            <input type="text" id="bcAccountNumber" value="${escapeHtml(accountNumber)}" placeholder="계좌번호" style="flex: 2; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                            <input type="text" id="bcAccountOwner" value="${escapeHtml(accountOwner)}" placeholder="예금주" style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                        </div>

                        <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">고지서 표시 연락처 (최대 3개)</label>
                        <div style="display: flex; gap: 10px; margin-bottom: 5px;">
                            <input type="text" id="bcContactName1" value="${escapeHtml(c1Name)}" placeholder="명칭 (예: 관리사무소)" style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                            <input type="text" id="bcContactPhone1" value="${escapeHtml(c1Phone)}" placeholder="연락처" style="flex: 2; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                        </div>
                        <div style="display: flex; gap: 10px; margin-bottom: 5px;">
                            <input type="text" id="bcContactName2" value="${escapeHtml(c2Name)}" placeholder="명칭 (예: 관리비 문의)" style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                            <input type="text" id="bcContactPhone2" value="${escapeHtml(c2Phone)}" placeholder="연락처" style="flex: 2; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                        </div>
                        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                            <input type="text" id="bcContactName3" value="${escapeHtml(c3Name)}" placeholder="명칭 (예: 관리소장)" style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                            <input type="text" id="bcContactPhone3" value="${escapeHtml(c3Phone)}" placeholder="연락처" style="flex: 2; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                        </div>

                        <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">고지서 하단 인쇄 안내문</label>
                        <textarea id="bcNoticeText" rows="3" placeholder="예: 납부 마감일 이후에는 연체료가 부과됩니다." style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 20px; box-sizing: border-box; resize: none;">${escapeHtml(noticeText)}</textarea>

                        <button id="saveBillConfigBtn" style="width: 100%; background: #2980b9; color: white; padding: 12px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">설정 저장</button>
                    </div>
                `;

                document.getElementById('bcLateFeeMethod').addEventListener('change', (e) => {
                    document.getElementById('bcLateFeeValue').style.display = e.target.value === 'none' ? 'none' : 'block';
                });

                document.getElementById('saveBillConfigBtn').addEventListener('click', async () => {
                    const timing = document.getElementById('bcTiming').value;
                    const split = document.getElementById('bcSplit').value;
                    const dueDate = document.getElementById('bcDueDate').value;
                    const lateFeeMethod = document.getElementById('bcLateFeeMethod').value;
                    const lateFeeValue = Number(document.getElementById('bcLateFeeValue').value) || 0;
                    const noticeText = document.getElementById('bcNoticeText').value;
                    const bankName = document.getElementById('bcBankName').value.trim();
                    const accountNumber = document.getElementById('bcAccountNumber').value.trim();
                    const accountOwner = document.getElementById('bcAccountOwner').value.trim();
                    
                    const contact1Name = document.getElementById('bcContactName1').value.trim();
                    const contact1Phone = document.getElementById('bcContactPhone1').value.trim();
                    const contact2Name = document.getElementById('bcContactName2').value.trim();
                    const contact2Phone = document.getElementById('bcContactPhone2').value.trim();
                    const contact3Name = document.getElementById('bcContactName3').value.trim();
                    const contact3Phone = document.getElementById('bcContactPhone3').value.trim();

                    try {
                        await updateDoc(doc(db, "buildings", bId), {
                            billingConfig: { 
                                billTiming: timing, splitMethod: split, 
                                dueDate, lateFeeMethod, lateFeeValue, noticeText,
                                bankName, accountNumber, accountOwner,
                                contact1Name, contact1Phone, contact2Name, contact2Phone, contact3Name, contact3Phone
                            }
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