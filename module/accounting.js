import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../js/main.js";

const tabIds = ['adj', 'bill', 'transaction', 'meter', 'collect', 'settle', 'resol', 'interim'];
let currentTabIndex = 0; // 현재 선택된 서브 탭 인덱스 유지
let lastBuildingId = null; // 마지막으로 로드된 건물 ID 추적

let subTabButtons = null;
let currentExpenseConfig = {}; // DB에서 불러온 지출 항목별 상세 설정 및 금액 보관용

let currentBankAccounts = []; // 불러온 통장 목록 보관용
let selectedAccountId = null; // 현재 선택된 통장 ID
let isAccountInfoExpanded = false; // 통장 정보 펼침 상태

let currentMeterMonth = ''; // 검침 화면에서 선택된 월
let currentMeterTab = 'electric'; // 검침 서브 탭 ('electric', 'water', 'gas')
let metersData = {}; // 서버에서 불러온 검침 데이터
let sortedRoomsForMeter = []; // 호실 목록

export const init = (container) => {
    // 건물이 변경되었는지 확인하여 서브 탭 인덱스 리셋
    const currentBuildingId = localStorage.getItem('selectedBuildingId');
    if (lastBuildingId !== currentBuildingId) {
        currentTabIndex = 0;
        lastBuildingId = currentBuildingId;
    }

    container.innerHTML = `
        <!-- 상단 서브 탭 메뉴 (가로 스크롤 & 고정) -->
        <div class="sub-tab-menu">
            <button class="sub-tab-btn active" data-tab="adj">부과조정</button>
            <button class="sub-tab-btn" data-tab="bill">세대부과</button>
            <button class="sub-tab-btn" data-tab="transaction">거래내역</button>
            <button class="sub-tab-btn" data-tab="meter">검침</button>
            <button class="sub-tab-btn" data-tab="collect">수납</button>
            <button class="sub-tab-btn" data-tab="settle">결산</button>
            <button class="sub-tab-btn" data-tab="resol">지출결의</button>
            <button class="sub-tab-btn" data-tab="interim">중간정산</button>
        </div>

        <!-- 하위 메뉴별 컨텐츠가 렌더링될 영역 -->
        <div id="accountingContent"></div>
    `;

    subTabButtons = container.querySelectorAll('.sub-tab-btn');
    const accountingContent = document.getElementById('accountingContent');

    // 통장 데이터 저장 함수
    const saveBankAccounts = async () => {
        const bId = localStorage.getItem('selectedBuildingId');
        if (!bId) return;
        try {
            await updateDoc(doc(db, "buildings", bId), { bankAccounts: currentBankAccounts });
        } catch (e) {
            console.error(e);
            alert("통장 정보 저장 중 오류가 발생했습니다.");
        }
    };

    // 통장 탭(목록) 렌더링 함수
    const renderAccountTabs = () => {
        const tabsContainer = document.getElementById('accountTabsContainer');
        if (!tabsContainer) return;
        
        let tabsHtml = currentBankAccounts.map(acc => `
            <button class="acc-tab-btn" data-id="${acc.id}" style="background:none; border:none; padding:0; color:${acc.id === selectedAccountId ? '#2980b9' : '#7f8c8d'}; font-weight:${acc.id === selectedAccountId ? 'bold' : 'normal'}; cursor:pointer; font-size:14px; margin-right:15px; border-bottom: ${acc.id === selectedAccountId ? '2px solid #2980b9' : 'none'}; padding-bottom: 5px;" title="한 번 더 클릭하면 상세정보를 펼치거나 접습니다.">${escapeHtml(acc.name)}${acc.id === selectedAccountId ? (isAccountInfoExpanded ? ' ▲' : ' ▼') : ''}</button>
        `).join('');

        tabsHtml += `
            <button id="addAccountTabBtn" style="background:none; border:none; padding:0; color:#27ae60; font-weight:bold; cursor:pointer; font-size:14px; display:flex; align-items:center; gap:2px; margin-left: auto;"><span class="material-symbols-outlined" style="font-size:16px;">add</span>통장추가</button>
        `;

        tabsContainer.innerHTML = tabsHtml;

        tabsContainer.querySelectorAll('.acc-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (selectedAccountId === e.target.dataset.id) {
                    isAccountInfoExpanded = !isAccountInfoExpanded;
                } else {
                    selectedAccountId = e.target.dataset.id;
                    isAccountInfoExpanded = false; // 다른 통장 선택 시 기본적으로 접힘
                }
                renderAccountTabs();
                renderSelectedAccount();
            });
        });

        document.getElementById('addAccountTabBtn').addEventListener('click', () => {
            openAccountModal();
        });
    };

    // 통장 모달 열기 함수
    const openAccountModal = (acc = null) => {
        document.getElementById('accountModalTitle').textContent = acc ? '통장 정보 수정' : '새 통장 추가';
        document.getElementById('accId').value = acc ? acc.id : '';
        document.getElementById('accName').value = acc ? acc.name : '';
        document.getElementById('accBank').value = acc ? acc.bank : '';
        document.getElementById('accBranch').value = acc ? acc.branch : '';
        document.getElementById('accNumber').value = acc ? acc.accountNumber : '';
        document.getElementById('accOpenDate').value = acc ? acc.openDate : '';
        document.getElementById('accOwner').value = acc ? acc.owner : '';
        document.getElementById('accountModal').style.display = 'flex';
    };

    // 선택된 통장 정보 및 거래내역 테이블 렌더링
    const renderSelectedAccount = () => {
        const container = document.getElementById('transactionContent');
        if (!container) return;

        const acc = currentBankAccounts.find(a => a.id === selectedAccountId);
        if (!acc) return;

        const txs = acc.transactions || [];

        // 당월 입출금 합계 계산
        const now = new Date();
        const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let currentMonthDeposit = 0;
        let currentMonthWithdraw = 0;
        txs.forEach(tx => {
            if (tx.date && tx.date.startsWith(currentMonthPrefix)) {
                currentMonthDeposit += Number(tx.deposit) || 0;
                currentMonthWithdraw += Number(tx.withdraw) || 0;
            }
        });

        const totalBalance = txs.length > 0 ? Number(txs[txs.length - 1].balance) : 0;

        let tableRows = txs.map((tx, idx) => `
            <tr class="tx-row" data-id="${tx.id}" style="cursor: pointer;" title="클릭하여 수정/삭제">
                <td style="position: sticky; left: 0; z-index: 1; background: #fdfdfd; padding: 8px 5px; border-bottom: 1px solid #eee; border-right: 1px solid #eee; text-align: center;">${idx + 1}</td>
                <td style="position: sticky; left: 40px; z-index: 1; background: #fdfdfd; padding: 8px 5px; border-bottom: 1px solid #eee; border-right: 1px solid #eee; text-align: center;">${escapeHtml(tx.date)}</td>
                <td style="position: sticky; left: 130px; z-index: 1; background: #fdfdfd; padding: 8px 5px; border-bottom: 1px solid #eee; border-right: 2px solid #bdc3c7; box-shadow: 2px 0 5px rgba(0,0,0,0.05); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(tx.name)}</td>
                <td style="padding: 8px 5px; border-bottom: 1px solid #eee; border-right: 1px solid #eee; text-align: right; color: #2980b9;">${tx.deposit > 0 ? Number(tx.deposit).toLocaleString() : '-'}</td>
                <td style="padding: 8px 5px; border-bottom: 1px solid #eee; border-right: 1px solid #eee; text-align: right; color: #c0392b;">${tx.withdraw > 0 ? Number(tx.withdraw).toLocaleString() : '-'}</td>
                <td style="padding: 8px 5px; border-bottom: 1px solid #eee; border-right: 1px solid #eee; text-align: right; font-weight: bold;">${Number(tx.balance).toLocaleString()}</td>
                <td style="padding: 8px 5px; border-bottom: 1px solid #eee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(tx.note)}</td>
            </tr>
        `).join('');

        if (txs.length === 0) {
            tableRows = `<tr><td colspan="7" style="padding: 20px; text-align: center; color: #7f8c8d; position: sticky; left: 0;">등록된 거래내역이 없습니다.</td></tr>`;
        }

        container.innerHTML = `
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #e0e0e0; display: ${isAccountInfoExpanded ? 'block' : 'none'};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="color: #2c3e50; font-size: 15px;">${escapeHtml(acc.name)} 정보</strong>
                    <button id="editAccountBtn" style="background: #3498db; color: white; border: none; padding: 5px 10px; border-radius: 4px; font-size: 12px; cursor: pointer;">정보 수정</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px; color: #555;">
                    <div><span style="color:#7f8c8d">은행명:</span> ${escapeHtml(acc.bank || '-')}</div>
                    <div><span style="color:#7f8c8d">지점:</span> ${escapeHtml(acc.branch || '-')}</div>
                    <div><span style="color:#7f8c8d">계좌번호:</span> ${escapeHtml(acc.accountNumber || '-')}</div>
                    <div><span style="color:#7f8c8d">예금주:</span> ${escapeHtml(acc.owner || '-')}</div>
                    <div style="grid-column: span 2;"><span style="color:#7f8c8d">개설일:</span> ${escapeHtml(acc.openDate || '-')}</div>
                </div>
            </div>

            <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="font-size: 14px; font-weight: bold; color: #2c3e50; margin-bottom: 10px;">당월(${currentMonthPrefix}) 요약 및 총 잔액</div>
                <div style="display: flex; flex-direction: column; gap: 8px; font-size: 14px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #16a085;">입금 합계:</span>
                        <strong style="color: #27ae60;">${currentMonthDeposit.toLocaleString()} 원</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #c0392b;">출금 합계:</span>
                        <strong style="color: #e74c3c;">${currentMonthWithdraw.toLocaleString()} 원</strong>
                    </div>
                    <hr style="border: 0; border-top: 1px dashed #ccc; margin: 4px 0;">
                    <div style="display: flex; justify-content: space-between; font-size: 16px;">
                        <span style="color: #2c3e50; font-weight: bold;">총 잔액:</span>
                        <strong style="color: #2980b9;">${totalBalance.toLocaleString()} 원</strong>
                    </div>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong style="color: #2c3e50; font-size: 14px;">입출금 내역</strong>
                <button id="addTxBtn" style="background: #27ae60; color: white; border: none; padding: 5px 10px; border-radius: 4px; font-size: 12px; cursor: pointer;">+ 내역 추가</button>
            </div>

            <div style="overflow: auto; max-height: 400px; border: 1px solid #ccc; border-radius: 4px; position: relative;">
                <table style="width: 100%; border-collapse: separate; border-spacing: 0; min-width: 700px; font-size: 13px; table-layout: fixed;">
                    <thead>
                        <tr>
                            <th style="position: sticky; top: 0; left: 0; z-index: 3; width: 40px; background: #2c3e50; color: white; padding: 10px 5px; border-bottom: 1px solid #bdc3c7; border-right: 1px solid #bdc3c7; white-space: nowrap; text-align: center;">No</th>
                            <th style="position: sticky; top: 0; left: 40px; z-index: 3; width: 90px; background: #2c3e50; color: white; padding: 10px 5px; border-bottom: 1px solid #bdc3c7; border-right: 1px solid #bdc3c7; white-space: nowrap; text-align: center;">날짜</th>
                            <th style="position: sticky; top: 0; left: 130px; z-index: 3; width: 130px; background: #2c3e50; color: white; padding: 10px 5px; border-bottom: 1px solid #bdc3c7; border-right: 2px solid #95a5a6; white-space: nowrap; text-align: center; box-shadow: 2px 0 5px rgba(0,0,0,0.1);">입금자/받는자</th>
                            <th style="position: sticky; top: 0; z-index: 2; width: 90px; background: #2c3e50; color: white; padding: 10px 5px; border-bottom: 1px solid #bdc3c7; border-right: 1px solid #bdc3c7; white-space: nowrap; text-align: center;">입금액</th>
                            <th style="position: sticky; top: 0; z-index: 2; width: 90px; background: #2c3e50; color: white; padding: 10px 5px; border-bottom: 1px solid #bdc3c7; border-right: 1px solid #bdc3c7; white-space: nowrap; text-align: center;">출금액</th>
                            <th style="position: sticky; top: 0; z-index: 2; width: 100px; background: #2c3e50; color: white; padding: 10px 5px; border-bottom: 1px solid #bdc3c7; border-right: 1px solid #bdc3c7; white-space: nowrap; text-align: center;">잔액</th>
                            <th style="position: sticky; top: 0; z-index: 2; background: #2c3e50; color: white; padding: 10px 5px; border-bottom: 1px solid #bdc3c7; white-space: nowrap; text-align: center;">내용</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('editAccountBtn').addEventListener('click', () => openAccountModal(acc));
        document.getElementById('addTxBtn').addEventListener('click', () => {
            document.getElementById('txModalTitle').textContent = '거래내역 추가';
            document.getElementById('txId').value = '';
            document.getElementById('txDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('txName').value = '';
            document.getElementById('txDeposit').value = '';
            document.getElementById('txWithdraw').value = '';
            document.getElementById('txNote').value = '';
            document.getElementById('saveTxBtn').textContent = '추가';
            document.getElementById('deleteTxBtn').style.display = 'none';
            document.getElementById('txModal').style.display = 'flex';
        });

        container.querySelectorAll('.tx-row').forEach(row => {
            row.addEventListener('click', () => {
                const txId = row.dataset.id;
                const tx = acc.transactions.find(t => t.id === txId);
                if (tx) {
                    document.getElementById('txModalTitle').textContent = '거래내역 수정';
                    document.getElementById('txId').value = tx.id;
                    document.getElementById('txDate').value = tx.date;
                    document.getElementById('txName').value = tx.name;
                    document.getElementById('txDeposit').value = tx.deposit || '';
                    document.getElementById('txWithdraw').value = tx.withdraw || '';
                    document.getElementById('txNote').value = tx.note || '';
                    document.getElementById('saveTxBtn').textContent = '수정';
                    document.getElementById('deleteTxBtn').style.display = 'block';
                    document.getElementById('txModal').style.display = 'flex';
                }
            });
        });
    };

    // 통장 정보 불러오기 함수
    const loadTransactions = async () => {
        const bId = localStorage.getItem('selectedBuildingId');
        const container = document.getElementById('transactionContent');
        
        if (!bId) {
            if(container) container.innerHTML = '<div style="color:#e74c3c; padding: 20px; text-align: center;">선택된 건물이 없습니다.</div>';
            return;
        }

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
                await saveBankAccounts();
            }

            if (!selectedAccountId || !currentBankAccounts.find(a => a.id === selectedAccountId)) {
                selectedAccountId = currentBankAccounts[0].id;
            }

            renderAccountTabs();
            renderSelectedAccount();
            
        } catch (error) {
            console.error(error);
            if(container) container.innerHTML = '<div style="color:red; padding: 20px; text-align: center;">데이터를 불러오는 중 오류가 발생했습니다.</div>';
        }
    };

    // 지출 항목 데이터를 DB에서 불러오고 화면을 그리는 함수
    const loadExpenseAdjustment = async () => {
        const bId = localStorage.getItem('selectedBuildingId');
        const adjContent = document.getElementById('adjContent');
        
        // 건물이 선택되지 않은 경우 예외 처리
        if (!bId) {
            adjContent.innerHTML = '<div style="color:#e74c3c; padding: 20px; text-align: center; font-weight: bold;">선택된 건물이 없습니다.<br><span style="font-size:13px; font-weight:normal; color:#7f8c8d;">사이드바의 "건물선택" 메뉴에서 건물을 먼저 선택해주세요.</span></div>';
            return;
        }

        try {
            const docSnap = await getDoc(doc(db, "buildings", bId));
            if (!docSnap.exists()) {
                adjContent.innerHTML = '<div style="color:#e74c3c; padding: 20px; text-align: center;">건물 정보를 찾을 수 없습니다.</div>';
                return;
            }

            const savedItems = docSnap.data().expenseItems || [];
            currentExpenseConfig = docSnap.data().expenseConfig || {}; // 기존에 저장된 설정 불러오기
            let otherExpensesConfig = docSnap.data().otherExpenses || {}; // 특정 월별 기타 지출 저장용

            // 건물 등록 시 사용했던 마스터 스키마 구조
            const masterExpenseGroups = {
                fixed: [
                    { title: 'A. 일반관리', items: ['위탁관리', '인건비(관리소장)', '인건비(경리)', '인건비(경비)', '인건비(미화)'] },
                    { title: 'B. 안전관리', items: ['승강기안전', '소방안전', '전기안전', '주차기안전'] },
                    { title: 'C. 미화ㆍ위생', items: ['청소ㆍ미화', '저수조청소', '수질검사', '방역', '정화조청소'] },
                    { title: 'D. 통신비', items: ['전화', '인터넷', '비상통화장치'] },
                    { title: 'E. 보안', items: ['CCTV', '보안업체'] },
                    { title: 'F. 주차비', items: ['주차비'] }
                ],
                variable: [
                    { title: 'A. 전기', items: ['공용전기', '세대전기'] },
                    { title: 'B. 수도', items: ['공용수도', '세대수도'] },
                    { title: 'C. 가스', items: ['가스'] }
                ],
                periodic: [
                    { title: 'A. 보험', items: ['승강기보험', '주차기안전보험', '화재보험', '영업배상책임보험', '어린이놀이시설보험', '시설물배상보험'] },
                    { title: 'B. 검사비', items: ['승강기 정기검사', '승강기 정밀검사', '발전기검사', '전기안전검사', '주차기 검사', '주차기 정밀검사', '건축물안전검사'] },
                    { title: 'C. 예치', items: ['장기수선충당금', '수선적립금', '건물수선비'] }
                ]
            };

            // 선택된 탭(고정/변동/주기)의 항목을 그리는 함수
            const renderGroup = async (groupId) => {
                // 항목 카테고리 판별 헬퍼
                const getCategory = (itemName) => {
                    for (const [cat, groups] of Object.entries(masterExpenseGroups)) {
                        for (const g of groups) {
                            if (g.items.includes(itemName)) return cat;
                        }
                    }
                    return 'fixed'; // 기본은 고정지출
                };

                // --- 당월부과 ---
                if (groupId === 'current_bill') {
                    const now = new Date();
                    let selectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

                    const renderSummary = (monthStr) => {
                        let fixedSum = 0, variableSum = 0, periodicSum = 0;
                        for (const [itemName, config] of Object.entries(currentExpenseConfig)) {
                            const amt = Number(config.monthlyAmount) || 0;
                            const cat = getCategory(itemName);
                            if (cat === 'fixed') fixedSum += amt;
                            else if (cat === 'variable') variableSum += amt;
                            else if (cat === 'periodic') periodicSum += amt;
                        }
                        
                        let otherSum = 0;
                        const otherItems = otherExpensesConfig[monthStr] || [];
                        otherItems.forEach(i => otherSum += Number(i.amount));

                        const totalSum = fixedSum + variableSum + periodicSum + otherSum;
                        
                        return `
                            <div style="border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background: #fff; margin-bottom: 15px;">
                                <div style="background: #2980b9; color: white; padding: 15px; font-weight: bold; font-size: 15px;">
                                    ${monthStr} 부과 예정 금액 요약
                                </div>
                                <div style="padding: 15px; display: flex; flex-direction: column; gap: 10px; font-size: 14px;">
                                    <div style="display: flex; justify-content: space-between;">
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
                                        <strong>총 부과 예정액:</strong>
                                        <strong>${totalSum.toLocaleString()} 원</strong>
                                    </div>
                                </div>
                            </div>
                        `;
                    };

                    const updateBillView = () => {
                        adjContent.innerHTML = `
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e0e0e0; display: flex; justify-content: center; align-items: center; margin-bottom: 15px;">
                                <label style="font-size: 13px; color: #34495e; font-weight: bold; margin-right: 10px;">부과 월 선택:</label>
                                <input type="month" id="finalizeMonth" value="${selectedMonth}" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; width: 150px; margin: 0;">
                            </div>
                            
                            <div id="summaryContainer">
                                ${renderSummary(selectedMonth)}
                            </div>
                            
                            <button id="finalizeBillBtn" style="background: #27ae60; color: white; border: none; padding: 12px 20px; font-size: 14px; border-radius: 4px; font-weight: bold; cursor: pointer; width: 100%;">이 달의 부과내역 확정하기</button>
                        `;

                        document.getElementById('finalizeMonth').addEventListener('change', (e) => {
                            selectedMonth = e.target.value;
                            document.getElementById('summaryContainer').innerHTML = renderSummary(selectedMonth);
                        });

                        document.getElementById('finalizeBillBtn').addEventListener('click', async () => {
                            const monthVal = selectedMonth;
                            if (!monthVal) { alert('월을 선택해주세요.'); return; }
                            if (!confirm(`[${monthVal}] 월의 부과내역을 이대로 확정하시겠습니까?`)) return;

                            const btn = document.getElementById('finalizeBillBtn');
                            btn.disabled = true;
                            btn.textContent = '확정 중...';

                            try {
                                const snap = await getDoc(doc(db, "buildings", bId));
                                let billingHistory = {};
                                if (snap.exists() && snap.data().billingHistory) {
                                    billingHistory = snap.data().billingHistory;
                                }

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
                                
                                const tSum = fSum + vSum + pSum + oSum;

                                billingHistory[monthVal] = {
                                    fixedSum: fSum, variableSum: vSum, periodicSum: pSum, otherSum: oSum, totalSum: tSum,
                                    items: currentExpenseConfig,
                                    otherItems: oItems,
                                    finalizedAt: new Date().toISOString()
                                };

                                await updateDoc(doc(db, "buildings", bId), {
                                    billingHistory: billingHistory
                                });

                                alert(`${monthVal} 월 부과내역이 확정되었습니다.\\n'부과기록' 탭에서 확인할 수 있습니다.`);
                            } catch (err) {
                                console.error(err);
                                alert('확정 중 오류가 발생했습니다.');
                            } finally {
                                btn.disabled = false;
                                btn.textContent = '이 달의 부과내역 확정하기';
                            }
                        });
                    };
                    
                    updateBillView();
                    return;
                }

                // --- 과거 부과기록 ---
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

                // --- 기타지출 ---
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
                                <div id="otherItemsList">
                                    ${itemsHtml}
                                </div>
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
                            
                            if (!name || amount <= 0) {
                                alert('항목명과 금액을 올바르게 입력해주세요.');
                                return;
                            }

                            if (!otherExpensesConfig[selectedMonth]) {
                                otherExpensesConfig[selectedMonth] = [];
                            }

                            otherExpensesConfig[selectedMonth].push({
                                id: 'other_' + Date.now(),
                                name, amount, target, note
                            });

                            try {
                                await updateDoc(doc(db, "buildings", bId), { otherExpenses: otherExpensesConfig });
                                renderOtherExpenseView();
                            } catch (e) {
                                console.error(e);
                                alert("저장 중 오류가 발생했습니다.");
                            }
                        });

                        adjContent.querySelectorAll('.del-other-btn').forEach(btn => {
                            btn.addEventListener('click', async (e) => {
                                const delId = e.target.dataset.id;
                                if(confirm('이 항목을 삭제하시겠습니까?')) {
                                    otherExpensesConfig[selectedMonth] = otherExpensesConfig[selectedMonth].filter(i => i.id !== delId);
                                    try {
                                        await updateDoc(doc(db, "buildings", bId), { otherExpenses: otherExpensesConfig });
                                        renderOtherExpenseView();
                                    } catch(err) {
                                        console.error(err);
                                        alert("삭제 중 오류가 발생했습니다.");
                                    }
                                }
                            });
                        });
                    };

                    renderOtherExpenseView();
                    return;
                }

                let html = '';
                let hasAnyItem = false;

                masterExpenseGroups[groupId].forEach(g => {
                    // DB에 저장된 항목 중 현재 그룹(A, B, C...)에 속하는 것만 필터링
                    const matchedItems = g.items.filter(item => savedItems.includes(item));
                    if (matchedItems.length > 0) {
                        hasAnyItem = true;
                        html += `
                            <div style="margin-bottom: 15px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                                <div style="background: #f8f9fa; padding: 10px 15px; font-weight: bold; color: #2c3e50; border-bottom: 1px solid #e0e0e0; font-size: 13px;">${g.title}</div>
                                <div style="padding: 10px 15px; display: flex; flex-direction: column; gap: 8px;">
                                    ${matchedItems.map(item => `
                                        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px dashed #f0f0f0;">
                                        <span class="expense-item-name" data-item="${escapeHtml(item)}" style="font-size: 14px; color: #2980b9; font-weight: bold; cursor: pointer; text-decoration: underline; text-underline-offset: 2px;" title="클릭하여 상세 정보 입력">${escapeHtml(item)}</span>
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

                // 사용자가 텍스트로 직접 추가했던 커스텀 항목 처리 (고정지출 탭에만 표시)
                if (groupId === 'fixed') {
                    const allMasterItems = new Set();
                    Object.values(masterExpenseGroups).forEach(arr => arr.forEach(g => g.items.forEach(i => allMasterItems.add(i))));
                    const customItems = savedItems.filter(item => !allMasterItems.has(item));
                    
                    if (customItems.length > 0) {
                        hasAnyItem = true;
                        html += `
                            <div style="margin-bottom: 15px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                                <div style="background: #f8f9fa; padding: 10px 15px; font-weight: bold; color: #2c3e50; border-bottom: 1px solid #e0e0e0; font-size: 13px;">기타 (사용자 직접 추가 항목)</div>
                                <div style="padding: 10px 15px; display: flex; flex-direction: column; gap: 8px;">
                                    ${customItems.map(item => `
                                        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 1px dashed #f0f0f0;">
                                        <span class="expense-item-name" data-item="${escapeHtml(item)}" style="font-size: 14px; color: #2980b9; font-weight: bold; cursor: pointer; text-decoration: underline; text-underline-offset: 2px;" title="클릭하여 상세 정보 입력">${escapeHtml(item)}</span>
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
                }

                if (!hasAnyItem) {
                    html = '<div style="color:#7f8c8d; padding:20px; text-align:center; background:#f8f9fa; border-radius:8px;">이 그룹에 해당하는 지출 항목이 없습니다.</div>';
                } else {
                    html += '<button id="saveAdjBtn" style="width: 100%; background: #27ae60; color: white; margin-top: 10px; font-size: 14px; padding: 12px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">입력 금액 및 상세 설정 저장</button>';
                }

                adjContent.innerHTML = html;

                // 금액 직접 입력 시 메모리(currentExpenseConfig)에 즉시 반영
                adjContent.querySelectorAll('.expense-amount-input').forEach(input => {
                    input.addEventListener('input', (e) => {
                        let rawValue = e.target.value.replace(/[^0-9]/g, ''); // 숫자 외 문자 제거
                        e.target.value = rawValue ? Number(rawValue).toLocaleString() : ''; // 천 단위 콤마 추가
                        
                        const item = e.target.dataset.item;
                        if (!currentExpenseConfig[item]) currentExpenseConfig[item] = {};
                        currentExpenseConfig[item].monthlyAmount = rawValue ? Number(rawValue) : 0; // DB에는 순수 숫자만 저장
                    });
                });

                // 최종 저장 버튼 이벤트 (DB에 저장)
                const saveBtn = document.getElementById('saveAdjBtn');
                if (saveBtn) {
                    saveBtn.addEventListener('click', async () => {
                        saveBtn.disabled = true;
                        saveBtn.textContent = '저장 중...';
                        try {
                            await updateDoc(doc(db, "buildings", bId), {
                                expenseConfig: currentExpenseConfig
                            });
                            alert('지출 금액 및 상세 설정이 성공적으로 저장되었습니다!');
                        } catch (error) {
                            console.error(error);
                            alert('저장 중 오류가 발생했습니다.');
                        } finally {
                            saveBtn.disabled = false;
                            saveBtn.textContent = '입력 금액 및 상세 설정 저장';
                        }
                    });
                }

                // 항목 이름 클릭 시 상세 정보 모달 띄우기 이벤트 등록
                const itemLabels = adjContent.querySelectorAll('.expense-item-name');
                itemLabels.forEach(label => {
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

            // 서브 탭(고정/변동/주기) 클릭 이벤트
            const subBtns = document.querySelectorAll('.adj-sub-btn');
            subBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    subBtns.forEach(b => { b.style.color = '#7f8c8d'; b.style.fontWeight = 'normal'; });
                    e.target.style.color = '#2980b9';
                    e.target.style.fontWeight = 'bold';
                    renderGroup(e.target.dataset.group);
                });
            });

            // 처음에 당월 부과내역 탭을 기본으로 렌더링
            renderGroup('current_bill');

        } catch (error) {
            console.error("지출항목 로드 실패:", error);
            adjContent.innerHTML = '<div style="color:red; padding: 20px; text-align: center;">데이터를 불러오는 중 오류가 발생했습니다.</div>';
        }
    };

    // --- 검침(Meter) 데이터 및 화면 렌더링 관리 ---
    const getPrevMonthStr = (monthStr, offset = 1) => {
        let [y, m] = monthStr.split('-').map(Number);
        m -= offset;
        while (m <= 0) {
            m += 12;
            y -= 1;
        }
        return `${y}-${String(m).padStart(2, '0')}`;
    };

    const renderMeterView = () => {
        const bId = localStorage.getItem('selectedBuildingId');
        const meterContent = document.getElementById('meterContent');
        if (!meterContent) return;

        if (sortedRoomsForMeter.length === 0) {
            meterContent.innerHTML = '<div style="color:#7f8c8d; padding:20px; text-align:center; background:#f8f9fa; border-radius:8px;">등록된 호실이 없습니다.<br>사이드바의 [건물등록] 메뉴에서 건물의 호실을 먼저 세팅해주세요.</div>';
            return;
        }

        // 현재 달 데이터 객체 초기화 (없을 경우 생성)
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

        // 틀고정(Sticky) CSS 속성 정의
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

            // 당월 데이터 세팅 (입력된 적이 없으면 이전 달 current 지침을 prev로 자동 세팅)
            let roomData = currentData[currentMeterTab][room];
            if (!roomData) {
                roomData = { prev: prev1Data.current !== undefined ? prev1Data.current : '', current: '', usage: '', note: '' };
                currentData[currentMeterTab][room] = roomData;
            }

            const rPrev = roomData.prev;
            const rCurr = roomData.current;
            const rUsage = roomData.usage;
            const rNote = roomData.note || '';

            // 전달 대비 증감량 계산
            const increase = rUsage !== '' && prev1Data.usage !== undefined ? (Number(rUsage) - usage1) : '';
            const increaseStr = increase !== '' ? (increase > 0 ? `+${increase}` : increase) : '-';
            const increaseColor = increase !== '' ? (increase > 0 ? '#e74c3c' : (increase < 0 ? '#27ae60' : '#7f8c8d')) : '#7f8c8d';

            // 3개월 평균 계산 (데이터가 존재하는 월수만큼 나누기)
            let sum = 0; let count = 0;
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
                    <td style="${tdBase} text-align:right;">
                        ${isFinalized ? 
                            escapeHtml(rPrev) : 
                            `<input type="number" class="m-prev" value="${escapeHtml(rPrev)}" style="width:70px; margin:0; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px; text-align:right; box-sizing:border-box;">`
                        }
                    </td>
                    <td style="${tdBase} text-align:right; background:#e8f4f8;">
                        ${isFinalized ? 
                            escapeHtml(rCurr) : 
                            `<input type="number" class="m-curr" value="${escapeHtml(rCurr)}" style="width:70px; margin:0; padding:6px; font-size:12px; border:1px solid #3498db; border-radius:4px; text-align:right; box-sizing:border-box; font-weight:bold; color:#2980b9;">`
                        }
                    </td>
                    <td style="${tdBase} text-align:right; font-weight:bold; color:#2c3e50;" class="m-usage-disp">${rUsage !== '' ? escapeHtml(rUsage) : '-'}</td>
                    <td style="${tdBase} text-align:right; color:${increaseColor}; font-weight:bold;" class="m-inc-disp">${increaseStr}</td>
                    <td style="${tdBase} text-align:right; color:#7f8c8d;" class="m-avg-disp">${avgStr}</td>
                    <td style="${tdLast} text-align:left;">
                        ${isFinalized ? 
                            escapeHtml(rNote) : 
                            `<input type="text" class="m-note" value="${escapeHtml(rNote)}" placeholder="메모" style="width:100%; min-width: 80px; margin:0; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;">`
                        }
                    </td>
                </tr>
            `;
        });

        const getMeterTabStyle = (type) => `
            background:none; border:none; padding:8px 16px; 
            color:${currentMeterTab === type ? '#2980b9' : '#bdc3c7'}; 
            font-weight:${currentMeterTab === type ? 'bold' : 'normal'}; 
            border-bottom:${currentMeterTab === type ? '3px solid #2980b9' : '3px solid transparent'}; 
            cursor:pointer; font-size:15px; flex:1; transition: 0.2s;
        `;

        const meterTabIcons = { 'electric': '⚡ 전기', 'water': '💧 수도', 'gas': '🔥 가스' };

        meterContent.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; background:#f8f9fa; padding:10px 15px; border-radius:8px; border:1px solid #e0e0e0;">
                <button id="prevMeterMonthBtn" style="background:none; border:none; color:#2c3e50; cursor:pointer; padding:5px; border-radius: 50%;" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='none'"><span class="material-symbols-outlined" style="vertical-align:middle;">chevron_left</span></button>
                <div style="font-size:16px; font-weight:bold; color:#2c3e50; display:flex; align-items:center; gap:8px;">
                    ${currentMeterMonth} 검침 기록 
                    ${isFinalized ? '<span style="font-size:12px; background:#27ae60; color:white; padding:2px 8px; border-radius:12px;">확정됨</span>' : '<span style="font-size:12px; background:#f39c12; color:white; padding:2px 8px; border-radius:12px;">입력중</span>'}
                </div>
                <button id="nextMeterMonthBtn" style="background:none; border:none; color:#2c3e50; cursor:pointer; padding:5px; border-radius: 50%;" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='none'"><span class="material-symbols-outlined" style="vertical-align:middle;">chevron_right</span></button>
            </div>

            <div style="display:flex; border-bottom:1px solid #e0e0e0; margin-bottom:15px; text-align: center;">
                <button class="meter-tab-btn" data-type="electric" style="${getMeterTabStyle('electric')}">${meterTabIcons['electric']}</button>
                <button class="meter-tab-btn" data-type="water" style="${getMeterTabStyle('water')}">${meterTabIcons['water']}</button>
                <button class="meter-tab-btn" data-type="gas" style="${getMeterTabStyle('gas')}">${meterTabIcons['gas']}</button>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="display:flex; gap:8px;">
                    ${isFinalized ? '' : `
                        <button id="downloadCsvBtn" style="background:#8e44ad; color:white; border:none; padding:8px 12px; border-radius:4px; font-size:13px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;" title="현재 표의 내용을 CSV 파일로 다운로드합니다."><span class="material-symbols-outlined" style="font-size:16px;">download</span> 엑셀 양식 다운로드</button>
                        <button id="uploadCsvBtn" style="background:#d35400; color:white; border:none; padding:8px 12px; border-radius:4px; font-size:13px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;" title="다운받은 양식에 값을 입력한 후 업로드하면 일괄 적용됩니다."><span class="material-symbols-outlined" style="font-size:16px;">upload</span> 엑셀(CSV) 업로드</button>
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
                    <thead>
                        <tr>
                            <th style="${thCol1}">No</th>
                            <th style="${thCol2}">호수</th>
                            <th style="${thBase}">이전달 지침</th>
                            <th style="${thBase}">당월 지침</th>
                            <th style="${thBase}">사용량</th>
                            <th style="${thBase}">전월 증감</th>
                            <th style="${thBase}">3개월 평균</th>
                            <th style="${thLast}">비고</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        `;

        // 월/탭 이동 이벤트 연결
        document.getElementById('prevMeterMonthBtn').addEventListener('click', () => { currentMeterMonth = getPrevMonthStr(currentMeterMonth, 1); renderMeterView(); });
        document.getElementById('nextMeterMonthBtn').addEventListener('click', () => { currentMeterMonth = getPrevMonthStr(currentMeterMonth, -1); renderMeterView(); });
        meterContent.querySelectorAll('.meter-tab-btn').forEach(btn => { btn.addEventListener('click', (e) => { currentMeterTab = e.currentTarget.dataset.type; renderMeterView(); }); });

        // 입력 중 실시간 자동 계산 로직 (입력값이 바뀔 때마다 실행)
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

                const usage1 = Number(prev1Data.usage) || 0;
                const usage2 = Number(prev2Data.usage) || 0;
                const usage3 = Number(prev3Data.usage) || 0;

                const recalc = () => {
                    const pVal = prevInput.value;
                    const cVal = currInput.value;
                    if (pVal !== '' && cVal !== '') {
                        const usage = Number(cVal) - Number(pVal);
                        usageDisp.textContent = usage;
                        
                        const increase = prev1Data.usage !== undefined ? usage - usage1 : '';
                        incDisp.textContent = increase !== '' ? (increase > 0 ? `+${increase}` : increase) : '-';
                        incDisp.style.color = increase !== '' ? (increase > 0 ? '#e74c3c' : (increase < 0 ? '#27ae60' : '#7f8c8d')) : '#7f8c8d';

                        let sum = 0; let count = 0;
                        if (prev1Data.usage !== undefined) { sum += usage1; count++; }
                        if (prev2Data.usage !== undefined) { sum += usage2; count++; }
                        if (prev3Data.usage !== undefined) { sum += usage3; count++; }
                        
                        sum += usage; count++;
                        avgDisp.textContent = (sum / count).toFixed(1);
                    } else {
                        usageDisp.textContent = '-';
                        incDisp.textContent = '-'; incDisp.style.color = '#7f8c8d';
                        
                        let sum = 0; let count = 0;
                        if (prev1Data.usage !== undefined) { sum += usage1; count++; }
                        if (prev2Data.usage !== undefined) { sum += usage2; count++; }
                        if (prev3Data.usage !== undefined) { sum += usage3; count++; }
                        avgDisp.textContent = count > 0 ? (sum / count).toFixed(1) : '-';
                    }
                };

                prevInput.addEventListener('input', recalc);
                currInput.addEventListener('input', recalc);
            });
            
            // --- CSV 엑셀 다운로드 및 업로드 로직 ---
            document.getElementById('downloadCsvBtn')?.addEventListener('click', () => {
                // 엑셀에서 한글이 깨지지 않도록 \uFEFF (BOM) 추가
                let csvContent = '\uFEFF호수,이전지침,당월지침,비고\n';
                meterContent.querySelectorAll('.meter-row').forEach(row => {
                    const room = row.dataset.room;
                    const prev = row.querySelector('.m-prev').value;
                    const curr = row.querySelector('.m-curr').value;
                    const note = row.querySelector('.m-note').value.replace(/,/g, ' '); // 쉼표가 있으면 열이 분리되므로 공백으로 치환
                    csvContent += `${room},${prev},${curr},${note}\n`;
                });
                
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `검침양식_${currentMeterMonth}_${currentMeterTab}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });

            const uploadCsvBtn = document.getElementById('uploadCsvBtn');
            const csvFileInput = document.getElementById('csvFileInput');
            if (uploadCsvBtn && csvFileInput) {
                uploadCsvBtn.addEventListener('click', () => csvFileInput.click());
                csvFileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const text = event.target.result;
                        const lines = text.split('\n');
                        let successCount = 0;
                        
                        // 첫 줄(헤더) 제외하고 데이터 파싱
                        for (let i = 1; i < lines.length; i++) {
                            if (!lines[i].trim()) continue;
                            // CSV 데이터 파싱
                            const cols = lines[i].split(',');
                            if (cols.length >= 3) {
                                const room = cols[0].trim();
                                const prev = cols[1].trim();
                                const curr = cols[2].trim();
                                const note = cols[3] ? cols[3].trim() : '';

                                // 현재 화면의 호실과 일치하는 행을 찾아 값 덮어쓰기
                                const row = meterContent.querySelector(`.meter-row[data-room="${room}"]`);
                                if (row) {
                                    const prevInput = row.querySelector('.m-prev');
                                    const currInput = row.querySelector('.m-curr');
                                    const noteInput = row.querySelector('.m-note');
                                    
                                    // input 이벤트를 강제로 발생시켜 '사용량', '평균' 등이 실시간 재계산되도록 함
                                    if (prevInput) { prevInput.value = prev; prevInput.dispatchEvent(new Event('input')); }
                                    if (currInput) { currInput.value = curr; currInput.dispatchEvent(new Event('input')); }
                                    if (noteInput) { noteInput.value = note; }
                                    successCount++;
                                }
                            }
                        }
                        alert(`${successCount}개 호실의 데이터가 업로드되었습니다.`);
                        csvFileInput.value = ''; // 동일 파일 재선택을 위해 값 초기화
                    };
                    reader.readAsText(file, 'utf-8');
                });
            }
        }

        // 화면에 입력된 데이터들을 메모리 변수로 수집
        const collectData = () => {
            if (isFinalized) return;
            meterContent.querySelectorAll('.meter-row').forEach(row => {
                const room = row.dataset.room;
                const prev = row.querySelector('.m-prev').value;
                const curr = row.querySelector('.m-curr').value;
                const note = row.querySelector('.m-note').value;
                let usage = '';
                if (prev !== '' && curr !== '') { usage = Number(curr) - Number(prev); }
                currentData[currentMeterTab][room] = { prev, current: curr, usage, note };
            });
        };

        // DB 저장 함수
        const saveToDB = async (statusMsg) => {
            const btns = [document.getElementById('saveMeterBtn'), document.getElementById('unfinalizeMeterBtn'), document.getElementById('finalizeMeterBtn')];
            btns.forEach(b => { if(b) b.disabled = true; });
            try {
                await updateDoc(doc(db, "buildings", bId), { meters: metersData });
                if (statusMsg) alert(statusMsg);
                renderMeterView();
            } catch (err) {
                console.error(err);
                alert("저장 중 오류가 발생했습니다.");
                btns.forEach(b => { if(b) b.disabled = false; });
            }
        };

        document.getElementById('saveMeterBtn')?.addEventListener('click', () => {
            collectData(); saveToDB("임시 저장되었습니다.");
        });

        document.getElementById('finalizeMeterBtn')?.addEventListener('click', () => {
            if (confirm(`${currentMeterMonth}월 검침 데이터를 확정하시겠습니까?\n(확정 후에는 입력창이 닫힙니다.)`)) {
                collectData();
                currentData.status = 'finalized';
                saveToDB(`${currentMeterMonth}월 검침 데이터가 확정되었습니다!`);
            }
        });

        document.getElementById('unfinalizeMeterBtn')?.addEventListener('click', () => {
            if (confirm('확정을 해제하고 수정 모드로 전환하시겠습니까?')) {
                currentData.status = 'open';
                saveToDB(); 
            }
        });
    };

    // 검침 화면 초기 데이터 로드 함수
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

    // 세대부과(bill) 탭 데이터를 관리하고 렌더링하는 함수
    const loadBillManagement = async () => {
        const bId = localStorage.getItem('selectedBuildingId');
        const billContent = document.getElementById('billContent');
        
        if (!bId) {
            billContent.innerHTML = '<div style="color:#e74c3c; padding: 20px; text-align: center; font-weight: bold;">선택된 건물이 없습니다.<br><span style="font-size:13px; font-weight:normal; color:#7f8c8d;">사이드바의 "건물선택" 메뉴에서 건물을 먼저 선택해주세요.</span></div>';
            return;
        }

        try {
            const docSnap = await getDoc(doc(db, "buildings", bId));
            if (!docSnap.exists()) return;
            
            const bData = docSnap.data();
            const billingConfig = bData.billingConfig || {
                billTiming: '당월부과',
                splitMethod: 'N분의일부과',
                lateFeeRate: 0
            };
            const billingHistory = bData.billingHistory || {};
            const roomsList = bData.roomsList || [];
            const sortedRooms = [...roomsList].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

            // 세대부과 내부 서브 탭 렌더링
            const renderBillGroup = async (groupId) => {
                if (groupId === 'current') {
                    const now = new Date();
                    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                    
                    if (!billingHistory[currentMonth]) {
                        billContent.innerHTML = `<div style="padding: 20px; text-align: center; color: #e74c3c; background: #fdf2e9; border-radius: 8px; border: 1px solid #f8c471; font-weight: bold;">[부과조정] 탭에서 [당월부과] 내역을 먼저 확정해주세요.</div>`;
                        return;
                    }

                    const currentBillData = billingHistory[currentMonth];
                    const totalSum = currentBillData.totalSum || 0;
                    
                    let tableRows = '';
                    if (sortedRooms.length === 0) {
                        tableRows = `<tr><td colspan="6" style="padding: 10px; text-align: center; color: #7f8c8d;">등록된 호실이 없습니다.</td></tr>`;
                    } else {
                        // N분의 1 부과 기본 로직 (10원 단위 절상)
                        let baseAmount = 0;
                        if (billingConfig.splitMethod === 'N분의일부과' && sortedRooms.length > 0) {
                            baseAmount = Math.ceil((totalSum / sortedRooms.length) / 10) * 10;
                        }
                        // ※ 향후 면적부과 선택 시 세대별 면적(households 데이터 등) 참조 로직 확장이 필요합니다.
                        
                        sortedRooms.forEach((room, idx) => {
                            const unpaid = 0; // 수납 데이터 연동 전 임시 0 처리
                            const lateFee = 0; // 수납 데이터 연동 전 임시 0 처리
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
                                <tbody>
                                    ${tableRows}
                                </tbody>
                            </table>
                        </div>
                    `;
                } else if (groupId === 'statement') {
                    billContent.innerHTML = '<div style="padding: 20px; text-align: center; color: #7f8c8d; background: #f8f9fa; border-radius: 8px; border: 1px dashed #ccc;">고지서 출력 및 발송 관리 화면 (개발 예정)</div>';
                } else if (groupId === 'history') {
                    const months = Object.keys(billingHistory).sort().reverse();
                    if (months.length === 0) {
                        billContent.innerHTML = '<div style="padding: 20px; text-align: center; color: #7f8c8d; background: #f8f9fa; border-radius: 8px;">과거 부과 기록이 없습니다.</div>';
                        return;
                    }
                    let historyHtml = '<div style="display: flex; flex-direction: column; gap: 10px;">';
                    months.forEach(m => {
                        historyHtml += `
                            <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; background: #fff; display: flex; justify-content: space-between; align-items: center; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.05);" onmouseover="this.style.background='#f4f6f8'" onmouseout="this.style.background='#fff'">
                                <div>
                                    <strong style="color: #2c3e50; font-size: 15px;">${m} 부과 기록</strong>
                                    <div style="font-size: 12px; color: #7f8c8d; margin-top: 5px;">총 부과액: ${Number(billingHistory[m].totalSum).toLocaleString()} 원</div>
                                </div>
                                <span class="material-symbols-outlined" style="color: #bdc3c7;">chevron_right</span>
                            </div>
                        `;
                    });
                    historyHtml += '</div>';
                    billContent.innerHTML = historyHtml;
                } else if (groupId === 'query') {
                    billContent.innerHTML = '<div style="padding: 20px; text-align: center; color: #7f8c8d; background: #f8f9fa; border-radius: 8px; border: 1px dashed #ccc;">다양한 조건의 검색 쿼리를 통한 데이터 조회 (개발 예정)</div>';
                } else if (groupId === 'settings') {
                    billContent.innerHTML = `
                        <div style="background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
                            <h4 style="margin-top: 0; color: #2c3e50; margin-bottom: 15px;">부과 기본 설정</h4>
                            
                            <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">부과 시기</label>
                            <select id="bcTiming" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 15px; box-sizing: border-box;">
                                <option value="당월부과" ${billingConfig.billTiming === '당월부과' ? 'selected' : ''}>당월부과 (이번 달 발생 비용을 이번 달에 청구)</option>
                                <option value="익월부과" ${billingConfig.billTiming === '익월부과' ? 'selected' : ''}>익월부과 (이번 달 발생 비용을 다음 달에 청구)</option>
                            </select>

                            <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">기본 부과 방식 (금액 분배 기준)</label>
                            <select id="bcSplit" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 15px; box-sizing: border-box;">
                                <option value="N분의일부과" ${billingConfig.splitMethod === 'N분의일부과' ? 'selected' : ''}>N분의 1 부과 (총 세대수로 균등 분할)</option>
                                <option value="면적부과" ${billingConfig.splitMethod === '면적부과' ? 'selected' : ''}>면적부과 (세대별 면적 비율에 따라 분할)</option>
                            </select>

                            <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">연체료 설정 (%)</label>
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                                <input type="number" id="bcLateFee" value="${billingConfig.lateFeeRate || 0}" placeholder="예: 2" style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; margin: 0; box-sizing: border-box;">
                                <span style="font-size: 14px; color: #34495e;">%</span>
                            </div>

                            <button id="saveBillConfigBtn" style="width: 100%; background: #2980b9; color: white; padding: 12px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">설정 저장</button>
                        </div>
                    `;

                    document.getElementById('saveBillConfigBtn').addEventListener('click', async () => {
                        const timing = document.getElementById('bcTiming').value;
                        const split = document.getElementById('bcSplit').value;
                        const lateFee = Number(document.getElementById('bcLateFee').value);

                        const btn = document.getElementById('saveBillConfigBtn');
                        btn.disabled = true; btn.textContent = '저장 중...';

                        try {
                            await updateDoc(doc(db, "buildings", bId), {
                                billingConfig: { billTiming: timing, splitMethod: split, lateFeeRate: lateFee }
                            });
                            billingConfig.billTiming = timing;
                            billingConfig.splitMethod = split;
                            billingConfig.lateFeeRate = lateFee;

                            alert('부과 설정이 저장되었습니다.');
                        } catch (e) {
                            console.error(e);
                            alert('설정 저장 중 오류가 발생했습니다.');
                        } finally {
                            btn.disabled = false; btn.textContent = '설정 저장';
                        }
                    });
                }
            };

            const subBtns = document.querySelectorAll('.bill-sub-btn');
            subBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    subBtns.forEach(b => { b.style.color = '#7f8c8d'; b.style.fontWeight = 'normal'; });
                    e.target.style.color = '#2980b9';
                    e.target.style.fontWeight = 'bold';
                    renderBillGroup(e.target.dataset.group);
                });
            });

            renderBillGroup('current');

        } catch (err) {
            console.error(err);
            billContent.innerHTML = '<div style="color:red; padding: 20px; text-align: center;">데이터를 불러오는 중 오류가 발생했습니다.</div>';
        }
    };

    // 서브 탭 컨텐츠 렌더링 함수
    const renderTabContent = (tabId) => {
        let html = '';
        switch(tabId) {
            case 'adj': 
                html = `
                    <div class="module-card">
                        <h3 style="margin-top:0;">부과조정</h3>
                        <p style="font-size: 12px; color: #7f8c8d; margin-bottom: 15px;">파란색 항목 이름을 클릭하여 상세 계약 정보를 입력하세요.</p>
                        <div style="display:flex; gap:15px; margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch;">
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

                    <!-- 상세 정보 입력 모달 (기본 숨김) -->
                    <div id="expenseModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 4000; justify-content: center; align-items: center;">
                        <div style="background: white; padding: 25px; border-radius: 12px; width: 90%; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
                            <h3 id="expenseModalTitle" style="margin-top: 0; color: #2c3e50; margin-bottom: 20px;">상세 정보</h3>
                            <input type="hidden" id="expItemName">
                            
                            <label style="font-size: 12px; color: #7f8c8d;">1. 업체명</label>
                            <input type="text" id="expCompany" placeholder="예: MC환경" style="margin-bottom: 10px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; max-width: 100%;">
                            
                            <label style="font-size: 12px; color: #7f8c8d;">2. 업체연락처</label>
                            <input type="text" id="expContact" placeholder="예: 02-1234-5678" style="margin-bottom: 10px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; max-width: 100%;">
                            
                            <label style="font-size: 12px; color: #7f8c8d;">3. 계약금액</label>
                            <input type="text" id="expAmount" placeholder="금액 (원)" style="margin-bottom: 10px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; max-width: 100%;">
                            
                            <label style="font-size: 12px; color: #7f8c8d;">4. 납부주기</label>
                            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                                <input type="number" id="expCycleNum" placeholder="숫자" value="1" style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 0; max-width: 100%; box-sizing: border-box;">
                                <select id="expCycleUnit" style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                                    <option value="개월">개월</option>
                                    <option value="년">년</option>
                                </select>
                            </div>
                            
                            <label style="font-size: 12px; color: #7f8c8d;">5. 비고</label>
                            <input type="text" id="expNote" placeholder="특이사항 입력" style="margin-bottom: 10px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; max-width: 100%;">

                            <label style="font-size: 12px; color: #7f8c8d;">6. 예외 호수 (부과 제외)</label>
                            <input type="text" id="expExceptions" placeholder="예: 101호, 1층 (쉼표로 구분)" style="margin-bottom: 20px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; max-width: 100%;">
                            
                            <div style="display: flex; gap: 10px;">
                                <button id="saveExpModalBtn" style="flex: 1; background: #2980b9; padding: 12px; font-size: 14px;">임시 적용</button>
                                <button id="cancelExpModalBtn" style="flex: 1; background: #95a5a6; padding: 12px; font-size: 14px;">취소</button>
                            </div>
                        </div>
                    </div>
                `; 
                break;
            case 'transaction':
                html = `
                    <div class="module-card">
                        <h3 style="margin-top:0;">거래내역</h3>
                        <p style="font-size: 12px; color: #7f8c8d; margin-bottom: 15px;">각 통장별 입출금 거래내역을 관리합니다.</p>
                        
                        <div style="display:flex; align-items:center; margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:5px; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch;" id="accountTabsContainer">
                            <!-- JS로 동적 렌더링 -->
                        </div>

                        <div id="transactionContent">
                            <div style="text-align: center; padding: 20px; color: #7f8c8d;">데이터를 불러오는 중...</div>
                        </div>
                    </div>

                    <!-- 통장 정보 모달 -->
                    <div id="accountModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 4000; justify-content: center; align-items: center;">
                        <div style="background: white; padding: 25px; border-radius: 12px; width: 90%; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex; flex-direction: column; max-height: 80vh;">
                            <h3 id="accountModalTitle" style="margin-top: 0; color: #2c3e50; margin-bottom: 20px; flex-shrink: 0;">통장 정보</h3>
                            <div style="overflow-y: auto; padding-right: 5px; margin-bottom: 20px;">
                                <input type="hidden" id="accId">
                                
                                <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">통장 이름 (별칭)</label>
                                <input type="text" id="accName" placeholder="예: 기본 관리비 통장" style="margin-bottom: 15px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                                
                                <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">은행명</label>
                                <input type="text" id="accBank" placeholder="예: 국민은행" style="margin-bottom: 15px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                                
                                <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">지점</label>
                                <input type="text" id="accBranch" placeholder="예: 강남지점" style="margin-bottom: 15px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">

                                <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">계좌번호</label>
                                <input type="text" id="accNumber" placeholder="예: 123-456-789" style="margin-bottom: 15px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">

                                <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">개설일</label>
                                <input type="date" id="accOpenDate" style="margin-bottom: 15px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">

                                <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">예금주</label>
                                <input type="text" id="accOwner" placeholder="예: MC타워 관리단" style="margin-bottom: 5px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                            </div>
                            <div style="display: flex; gap: 10px; flex-shrink: 0;">
                                <button id="saveAccountBtn" style="flex: 1; background: #2980b9; padding: 12px; font-size: 14px; color: white; border: none; border-radius: 4px; cursor: pointer;">저장</button>
                                <button id="cancelAccountBtn" style="flex: 1; background: #95a5a6; padding: 12px; font-size: 14px; color: white; border: none; border-radius: 4px; cursor: pointer;">취소</button>
                            </div>
                        </div>
                    </div>

                    <!-- 거래내역 추가/수정 모달 -->
                    <div id="txModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 4000; justify-content: center; align-items: center;">
                        <div style="background: white; padding: 25px; border-radius: 12px; width: 90%; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex; flex-direction: column; max-height: 80vh;">
                            <h3 id="txModalTitle" style="margin-top: 0; color: #2c3e50; margin-bottom: 20px; flex-shrink: 0;">거래내역 추가</h3>
                            <div style="overflow-y: auto; padding-right: 5px; margin-bottom: 20px;">
                                <input type="hidden" id="txId">
                                
                                <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">날짜</label>
                                <input type="date" id="txDate" style="margin-bottom: 15px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                                
                                <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">입금자명/받는자명</label>
                                <input type="text" id="txName" placeholder="예: 홍길동" style="margin-bottom: 15px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                                
                                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                                    <div style="flex: 1;">
                                        <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">입금액</label>
                                        <input type="number" id="txDeposit" placeholder="0" style="padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-bottom: 0;">
                                    </div>
                                    <div style="flex: 1;">
                                        <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">출금액</label>
                                        <input type="number" id="txWithdraw" placeholder="0" style="padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; margin-bottom: 0;">
                                    </div>
                                </div>
                                
                                <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">내용</label>
                                <input type="text" id="txNote" placeholder="예: 관리비 입금" style="margin-bottom: 5px; padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                            </div>
                            <div style="display: flex; gap: 10px; flex-shrink: 0;">
                                <button id="saveTxBtn" style="flex: 1; background: #2980b9; padding: 12px; font-size: 14px; color: white; border: none; border-radius: 4px; cursor: pointer;">추가</button>
                                <button id="deleteTxBtn" style="display: none; flex: 1; background: #e74c3c; padding: 12px; font-size: 14px; color: white; border: none; border-radius: 4px; cursor: pointer;">삭제</button>
                                <button id="cancelTxBtn" style="flex: 1; background: #95a5a6; padding: 12px; font-size: 14px; color: white; border: none; border-radius: 4px; cursor: pointer;">취소</button>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'bill':
                html = `
                    <div class="module-card">
                        <h3 style="margin-top:0;">세대부과</h3>
                        <p style="font-size: 12px; color: #7f8c8d; margin-bottom: 15px;">세대별 관리비를 배분하여 부과하고 고지서와 부과 설정을 관리합니다.</p>
                        <div style="display:flex; gap:15px; margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch;">
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
                break;
            case 'meter': 
                html = `
                    <div class="module-card">
                        <h3 style="margin-top:0;">검침</h3>
                        <p style="font-size: 12px; color: #7f8c8d; margin-bottom: 15px;">전기, 수도, 가스 등 각 세대의 검침 데이터를 월별로 입력하고 조회합니다.</p>
                        <div id="meterContent">
                            <div style="text-align: center; padding: 20px; color: #7f8c8d;">데이터를 불러오는 중...</div>
                        </div>
                    </div>
                `; 
                break;
            case 'collect': html = '<div class="module-card"><h3>수납</h3><p>세대별 관리비 수납 내역을 처리하고 확인합니다.</p></div>'; break;
            case 'settle': html = '<div class="module-card"><h3>결산</h3><p>월별/연별 회계 결산 작업을 수행합니다.</p></div>'; break;
            case 'resol': html = '<div class="module-card"><h3>지출결의</h3><p>건물 관리에 필요한 지출 결의서를 작성하고 승인합니다.</p></div>'; break;
            case 'interim': html = '<div class="module-card"><h3>중간정산</h3><p>이사 등 세대 전출입 시 관리비 중간정산을 처리합니다.</p></div>'; break;
        }
        accountingContent.innerHTML = html;

        if (tabId === 'adj') {
            loadExpenseAdjustment();

            const expenseModal = document.getElementById('expenseModal');
            if (expenseModal) {
                // 모달 내 금액 입력 시 실시간 콤마 포맷팅 적용
                const expAmountInput = document.getElementById('expAmount');
                if (expAmountInput) {
                    expAmountInput.addEventListener('input', (e) => {
                        let rawValue = e.target.value.replace(/[^0-9]/g, '');
                        e.target.value = rawValue ? Number(rawValue).toLocaleString() : '';
                    });
                }

                document.getElementById('cancelExpModalBtn').addEventListener('click', () => {
                    expenseModal.style.display = 'none';
                });
                document.getElementById('saveExpModalBtn').addEventListener('click', () => {
                    const itemName = document.getElementById('expItemName').value;
                    const company = document.getElementById('expCompany').value;
                    const contact = document.getElementById('expContact').value;
                    const amount = parseFloat(document.getElementById('expAmount').value.replace(/,/g, '')) || 0;
                    const cycleNum = parseFloat(document.getElementById('expCycleNum').value) || 1;
                    const cycleUnit = document.getElementById('expCycleUnit').value;
                    const note = document.getElementById('expNote').value;
                    const exceptions = document.getElementById('expExceptions').value;

                    // 월별 부과 금액 계산 (원단위 10원 단위로 올림 처리)
                    let rawMonthly = 0;
                    if (cycleUnit === '개월') {
                        rawMonthly = amount / cycleNum;
                    } else if (cycleUnit === '년') {
                        rawMonthly = amount / (cycleNum * 12);
                    }
                    const monthlyAmount = Math.ceil(rawMonthly / 10) * 10;

                    // 메모리 변수에 저장
                    if (!currentExpenseConfig[itemName]) currentExpenseConfig[itemName] = {};
                    currentExpenseConfig[itemName] = {
                        ...currentExpenseConfig[itemName],
                        company, contact, amount, cycleNum, cycleUnit, note, exceptions, monthlyAmount
                    };

                    // 계산된 금액을 본 화면의 입력창에 자동 기입
                const amountInput = document.querySelector('.expense-amount-input[data-item="' + CSS.escape(itemName) + '"]');
                    if (amountInput) {
                        amountInput.value = monthlyAmount.toLocaleString();
                    }

                    alert(`${itemName} 상세 정보가 적용되었습니다.\n(월 환산 금액: ${monthlyAmount.toLocaleString()}원)\n\n※ 반드시 화면 하단의 [저장] 버튼을 눌러야 최종 반영됩니다.`);
                    expenseModal.style.display = 'none';
                });
            }
        }

        if (tabId === 'bill') {
            loadBillManagement();
        }
        
        if (tabId === 'transaction') {
            loadTransactions();

            document.getElementById('cancelAccountBtn').addEventListener('click', () => {
                document.getElementById('accountModal').style.display = 'none';
            });

            document.getElementById('saveAccountBtn').addEventListener('click', async () => {
                const id = document.getElementById('accId').value;
                const name = document.getElementById('accName').value || '새 통장';
                const bank = document.getElementById('accBank').value;
                const branch = document.getElementById('accBranch').value;
                const accountNumber = document.getElementById('accNumber').value;
                const openDate = document.getElementById('accOpenDate').value;
                const owner = document.getElementById('accOwner').value;

                if (id) {
                    const acc = currentBankAccounts.find(a => a.id === id);
                    if (acc) {
                        acc.name = name; acc.bank = bank; acc.branch = branch;
                        acc.accountNumber = accountNumber; acc.openDate = openDate; acc.owner = owner;
                    }
                } else {
                    const newAcc = { id: 'acc_' + Date.now(), name, bank, branch, accountNumber, openDate, owner, transactions: [] };
                    currentBankAccounts.push(newAcc);
                    selectedAccountId = newAcc.id;
                }
                await saveBankAccounts();
                document.getElementById('accountModal').style.display = 'none';
                renderAccountTabs();
                renderSelectedAccount();
            });

            document.getElementById('cancelTxBtn').addEventListener('click', () => {
                document.getElementById('txModal').style.display = 'none';
            });

            document.getElementById('saveTxBtn').addEventListener('click', async () => {
                const date = document.getElementById('txDate').value || new Date().toISOString().split('T')[0];
                const name = document.getElementById('txName').value;
                const deposit = Number(document.getElementById('txDeposit').value) || 0;
                const withdraw = Number(document.getElementById('txWithdraw').value) || 0;
                const note = document.getElementById('txNote').value;

                const acc = currentBankAccounts.find(a => a.id === selectedAccountId);
                if (acc) {
                    if (!acc.transactions) acc.transactions = [];
                    const lastBalance = acc.transactions.length > 0 ? acc.transactions[acc.transactions.length - 1].balance : 0;
                    const balance = lastBalance + deposit - withdraw;

                    acc.transactions.push({ id: 'tx_' + Date.now(), date, name, deposit, withdraw, balance, note });
                    await saveBankAccounts();
                    document.getElementById('txModal').style.display = 'none';
                    renderSelectedAccount();
                }
            });
        }

        if (tabId === 'meter') {
            loadMeterManagement();
        }
    };

    // 탭 클릭 이벤트 등록
    subTabButtons.forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            currentTabIndex = index; // 클릭한 탭의 인덱스 기억

            // 1. 모든 버튼에서 active 상태 제거
            subTabButtons.forEach(b => b.classList.remove('active'));
            
            // 2. 클릭한 버튼만 활성화(파란색)
            e.target.classList.add('active');
            
            // 3. 해당 탭의 컨텐츠 화면에 그리기
            renderTabContent(e.target.dataset.tab);
            
            // 4. 클릭한 탭이 화면 중앙에 오도록 부드럽게 스크롤 이동 (UX 향상)
            e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    });

    // 모듈 로드 시 이전에 선택했던 탭으로 복구 (기본값은 0번째 'adj')
    subTabButtons.forEach(b => b.classList.remove('active'));
    const activeBtn = subTabButtons[currentTabIndex];
    activeBtn.classList.add('active');
    renderTabContent(activeBtn.dataset.tab);
    setTimeout(() => { activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }, 50);
};

let lastReclickTime = 0; // 마지막 클릭 시간 저장용

// 하단 탭을 다시 누를 때 (로테이션 기능)
export const onReclick = () => {
    if (!subTabButtons) return;
    
    // 빠른 연속 클릭이나 모바일 터치 중복 발생으로 인한 건너뜀 방지
    const now = Date.now();
    if (now - lastReclickTime < 300) return; // 300ms 이내 중복 실행 차단
    lastReclickTime = now;

    // 다음 탭 인덱스 계산 (끝에 도달하면 처음으로 돌아감)
    currentTabIndex = (currentTabIndex + 1) % tabIds.length;
    // 프로그래밍 방식으로 버튼 클릭 이벤트 발생 (렌더링 및 스크롤 자동 수행)
    subTabButtons[currentTabIndex].click();
};