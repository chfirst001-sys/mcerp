import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../../js/main.js";

let currentBankAccounts = [];
let selectedAccountId = null;
let isAccountInfoExpanded = false;

export const render = async (container) => {
    const bId = localStorage.getItem('selectedBuildingId');
    if (!bId) {
        container.innerHTML = '<div style="color:#e74c3c; padding: 20px; text-align: center; font-weight: bold;">선택된 건물이 없습니다.</div>';
        return;
    }

    container.innerHTML = `
        <div class="module-card">
            
            <div id="accountTabsContainer" style="display:flex; align-items:center; margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:5px; overflow-x: auto; white-space: nowrap;">
            </div>

            <div id="transactionContent">
                <div style="text-align: center; padding: 20px; color: #7f8c8d;">데이터를 불러오는 중...</div>
            </div>
        </div>
    `;

    try {
        const docSnap = await getDoc(doc(db, "buildings", bId));
        if (!docSnap.exists()) return;
        
        currentBankAccounts = docSnap.data().bankAccounts || [];
        if (currentBankAccounts.length === 0) {
            currentBankAccounts.push({
                id: 'acc_' + Date.now(),
                name: '기본통장',
                bank: '', branch: '', accountNumber: '', openDate: '', owner: '',
                transactions: []
            });
            await updateDoc(doc(db, "buildings", bId), { bankAccounts: currentBankAccounts });
        }

        if (!selectedAccountId || !currentBankAccounts.find(a => a.id === selectedAccountId)) {
            selectedAccountId = currentBankAccounts[0].id;
        }

        renderTabs();
    } catch (e) {
        console.error(e);
        document.getElementById('transactionContent').innerHTML = '<div style="color:red; text-align:center;">오류가 발생했습니다.</div>';
    }
};

const renderTabs = () => {
    const tabsContainer = document.getElementById('accountTabsContainer');
    if (!tabsContainer) return;
    
    let tabsHtml = currentBankAccounts.map(acc => `
        <button class="acc-tab-btn" data-id="${acc.id}" style="background:none; border:none; padding:0; color:${acc.id === selectedAccountId ? '#2980b9' : '#7f8c8d'}; font-weight:${acc.id === selectedAccountId ? 'bold' : 'normal'}; cursor:pointer; font-size:14px; margin-right:15px; border-bottom: ${acc.id === selectedAccountId ? '2px solid #2980b9' : 'none'}; padding-bottom: 5px;">${escapeHtml(acc.name)}</button>
    `).join('');

    tabsHtml += `<button id="addAccountTabBtn" style="background:none; border:none; padding:0; color:#27ae60; font-weight:bold; cursor:pointer; font-size:14px; margin-left: auto;">+ 통장추가</button>`;
    tabsContainer.innerHTML = tabsHtml;

    tabsContainer.querySelectorAll('.acc-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            selectedAccountId = e.target.dataset.id;
            renderTabs();
        });
    });

    renderTxContent();
};

const renderTxContent = () => {
    const container = document.getElementById('transactionContent');
    const acc = currentBankAccounts.find(a => a.id === selectedAccountId);
    if (!acc) return;
    
    const txs = acc.transactions || [];
    const totalBalance = txs.length > 0 ? Number(txs[txs.length - 1].balance) : 0;

    container.innerHTML = `
        <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; justify-content: space-between; font-size: 16px;">
                <span style="color: #2c3e50; font-weight: bold;">총 잔액:</span>
                <strong style="color: #2980b9;">${totalBalance.toLocaleString()} 원</strong>
            </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong style="color: #2c3e50; font-size: 14px;">입출금 내역</strong>
            <button id="addTxBtn" style="background: #27ae60; color: white; border: none; padding: 5px 10px; border-radius: 4px; font-size: 12px; cursor: pointer;">+ 내역 추가</button>
        </div>
        <div style="overflow: auto; max-height: 400px; border: 1px solid #ccc; border-radius: 4px;">
            <table style="width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13px;">
                <thead style="background: #2c3e50; color: white;">
                    <tr><th style="padding: 10px;">날짜</th><th style="padding: 10px;">내용</th><th style="padding: 10px;">잔액</th></tr>
                </thead>
                <tbody>
                    ${txs.length === 0 ? '<tr><td colspan="3" style="padding:20px; text-align:center;">거래 내역이 없습니다.</td></tr>' : ''}
                </tbody>
            </table>
        </div>
    `;
};