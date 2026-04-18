const tabIds = ['friend', 'chat', 'community', 'news'];
let currentTabIndex = 0;
let subTabButtons = null;
let currentSubModule = null; // 현재 로드된 서브 모듈 인스턴스 보관용

export const init = (container) => {
    container.innerHTML = `
        <!-- 상단 서브 탭 메뉴 -->
        <div class="sub-tab-menu">
            <button class="sub-tab-btn active" data-tab="friend">친구</button>
            <button class="sub-tab-btn" data-tab="chat">대화</button>
            <button class="sub-tab-btn" data-tab="community">광장</button>
            <button class="sub-tab-btn" data-tab="news" style="color: #2980b9; font-weight: bold;">NEWS</button>
        </div>

        <!-- 하위 메뉴별 컨텐츠가 렌더링될 영역 -->
        <div id="plazaContent">
        </div>
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
    // 기존 모듈에 정리(cleanup) 함수가 있다면 실행하여 메모리 누수 방지
    if (currentSubModule && currentSubModule.cleanup) {
        currentSubModule.cleanup();
    }

    const content = document.getElementById('plazaContent');
    if (!content) return; // 비동기 로딩 중 사용자가 다른 메인 탭으로 이동했을 때의 에러 방지
    
    content.innerHTML = '<div style="text-align: center; padding: 20px; color: #7f8c8d;">모듈을 불러오는 중...</div>';
    
    try {
        const APP_VERSION = "20260418_02"; // 캐시 무효화용 버전
        const module = await import(`./plaza/${tabId}.js?v=${APP_VERSION}`);
        currentSubModule = module;
        module.render(content);
    } catch (e) {
        console.error(`Sub-module load failed (${tabId}):`, e);
        let title = ''; let desc = '';
        switch(tabId) {
            case 'friend': title='친구'; desc='친구 목록 및 P2P 설정 기능을 준비 중입니다.'; break;
            case 'community': title='광장'; desc='공개 커뮤니티 기능을 준비 중입니다.'; break;
            case 'news': title='NEWS'; desc='새로운 소식 기능을 준비 중입니다.'; break;
            default: title=tabId; desc='준비 중입니다.';
        }
        content.innerHTML = `<div style="text-align:center; padding:40px 20px;"><h3>${title}</h3><p style="color:#7f8c8d;">${desc}</p></div>`;
    }
};

let lastReclickTime = 0;

// 하단 탭을 다시 눌렀을 때 로테이션으로 서브 탭 이동
export const onReclick = () => {
    if (!subTabButtons) return;
    const now = Date.now();
    if (now - lastReclickTime < 300) return; 
    lastReclickTime = now;
    currentTabIndex = (currentTabIndex + 1) % tabIds.length;
    subTabButtons[currentTabIndex].click();
};