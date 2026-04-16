const tabIds = ['adj', 'bill', 'transaction', 'meter', 'collect', 'settle', 'interim'];
let currentTabIndex = 0; // 현재 선택된 서브 탭 인덱스 유지
let lastBuildingId = null; // 마지막으로 로드된 건물 ID 추적
let subTabButtons = null;

export const init = (container) => {
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
            <button class="sub-tab-btn" data-tab="interim">중간정산</button>
        </div>

        <!-- 하위 메뉴별 컨텐츠가 렌더링될 영역 -->
        <div id="accountingContent"></div>
    `;

    subTabButtons = container.querySelectorAll('.sub-tab-btn');

    // 탭 클릭 이벤트 등록
    subTabButtons.forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            currentTabIndex = index;
            subTabButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            loadSubModule(e.target.dataset.tab);
            
            e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    });

    // 초기 렌더링 시 이전에 선택했던 탭으로 자동 복구
    subTabButtons.forEach(b => b.classList.remove('active'));
    const activeBtn = subTabButtons[currentTabIndex];
    if (activeBtn) {
        activeBtn.classList.add('active');
        loadSubModule(activeBtn.dataset.tab);
        setTimeout(() => { activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }, 50);
    }
};

const loadSubModule = async (tabId) => {
    const content = document.getElementById('accountingContent');
    content.innerHTML = '<div style="text-align: center; padding: 20px; color: #7f8c8d;">모듈을 불러오는 중...</div>';
    
    try {
        // 폴더 구조화된 개별 파일을 동적으로 로드 (Lazy Loading)
        const module = await import(`./accounting/${tabId}.js?v=20260416_04`);
        module.render(content);
    } catch (e) {
        console.error(`Sub-module load failed (${tabId}):`, e);
        let title = ''; let desc = '';
        switch(tabId) {
            case 'collect': title='수납'; desc='세대별 관리비 수납 내역을 처리하고 확인합니다.'; break;
            case 'settle': title='결산'; desc='월별/연별 회계 결산 작업을 수행합니다.'; break;
            case 'interim': title='중간정산'; desc='이사 등 세대 전출입 시 관리비 중간정산을 처리합니다.'; break;
            default: title=tabId; desc='준비 중입니다.';
        }
        content.innerHTML = `<div class="module-card"><h3>${title}</h3><p>${desc}</p></div>`;
    }
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