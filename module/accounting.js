import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../js/main.js";

const tabIds = ['adj', 'meter', 'history', 'collect', 'settle', 'bill', 'resol', 'interim', 'other'];
let currentTabIndex = 0; // 현재 선택된 서브 탭 인덱스 유지
let lastBuildingId = null; // 마지막으로 로드된 건물 ID 추적

let subTabButtons = null;
let currentExpenseConfig = {}; // DB에서 불러온 지출 항목별 상세 설정 및 금액 보관용

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
            <button class="sub-tab-btn" data-tab="meter">검침</button>
            <button class="sub-tab-btn" data-tab="history">부과내역</button>
            <button class="sub-tab-btn" data-tab="collect">수납</button>
            <button class="sub-tab-btn" data-tab="settle">결산</button>
            <button class="sub-tab-btn" data-tab="bill">부과</button>
            <button class="sub-tab-btn" data-tab="resol">지출결의</button>
            <button class="sub-tab-btn" data-tab="interim">중간정산</button>
            <button class="sub-tab-btn" data-tab="other">기타부과</button>
        </div>

        <!-- 하위 메뉴별 컨텐츠가 렌더링될 영역 -->
        <div id="accountingContent"></div>
    `;

    subTabButtons = container.querySelectorAll('.sub-tab-btn');
    const accountingContent = document.getElementById('accountingContent');

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
            const renderGroup = (groupId) => {
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

            // 처음에 고정지출 탭을 기본으로 렌더링
            renderGroup('fixed');

        } catch (error) {
            console.error("지출항목 로드 실패:", error);
            adjContent.innerHTML = '<div style="color:red; padding: 20px; text-align: center;">데이터를 불러오는 중 오류가 발생했습니다.</div>';
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
                        <div style="display:flex; gap:15px; margin-bottom:15px; border-bottom:2px solid #eee; padding-bottom:10px;">
                            <button class="adj-sub-btn" data-group="fixed" style="background:none; border:none; padding:0; color:#2980b9; font-weight:bold; cursor:pointer; font-size:14px;">고정지출</button>
                            <button class="adj-sub-btn" data-group="variable" style="background:none; border:none; padding:0; color:#7f8c8d; cursor:pointer; font-size:14px;">변동지출</button>
                            <button class="adj-sub-btn" data-group="periodic" style="background:none; border:none; padding:0; color:#7f8c8d; cursor:pointer; font-size:14px;">주기지출</button>
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
            case 'meter': html = '<div class="module-card"><h3>검침</h3><p>전기, 수도, 가스 등 각 세대의 검침 데이터를 입력합니다.</p></div>'; break;
            case 'history': html = '<div class="module-card"><h3>부과내역</h3><p>과거 부과되었던 관리비 내역을 조회합니다.</p></div>'; break;
            case 'collect': html = '<div class="module-card"><h3>수납</h3><p>세대별 관리비 수납 내역을 처리하고 확인합니다.</p></div>'; break;
            case 'settle': html = '<div class="module-card"><h3>결산</h3><p>월별/연별 회계 결산 작업을 수행합니다.</p></div>'; break;
            case 'bill': html = '<div class="module-card"><h3>부과</h3><p>입력된 지출과 검침 데이터를 바탕으로 관리비를 부과합니다.</p></div>'; break;
            case 'resol': html = '<div class="module-card"><h3>지출결의</h3><p>건물 관리에 필요한 지출 결의서를 작성하고 승인합니다.</p></div>'; break;
            case 'interim': html = '<div class="module-card"><h3>중간정산</h3><p>이사 등 세대 전출입 시 관리비 중간정산을 처리합니다.</p></div>'; break;
            case 'other': html = '<div class="module-card"><h3>기타부과</h3><p>정기 관리비 외의 별도 금액을 부과합니다.</p></div>'; break;
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

// 하단 탭을 다시 누를 때 (로테이션 기능)
export const onReclick = () => {
    if (!subTabButtons) return;
    // 다음 탭 인덱스 계산 (끝에 도달하면 처음으로 돌아감)
    currentTabIndex = (currentTabIndex + 1) % tabIds.length;
    // 프로그래밍 방식으로 버튼 클릭 이벤트 발생 (렌더링 및 스크롤 자동 수행)
    subTabButtons[currentTabIndex].click();
};