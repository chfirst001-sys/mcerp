const tabIds = ['home', 'local', 'health', 'culture', 'mall'];
let currentTabIndex = 0;
let subTabButtons = null;

export const init = (container) => {
    container.innerHTML = `
        <!-- 상단 서브 탭 메뉴 -->
        <div class="sub-tab-menu">
            <button class="sub-tab-btn active" data-tab="home">우리집</button>
            <button class="sub-tab-btn" data-tab="local">우리동네</button>
            <button class="sub-tab-btn" data-tab="health">건강</button>
            <button class="sub-tab-btn" data-tab="culture">문화</button>
            <button class="sub-tab-btn" data-tab="mall" style="color: #d35400; font-weight: bold;">나드몰</button>
        </div>

        <!-- 하위 메뉴별 컨텐츠가 렌더링될 영역 -->
        <div id="lifeContent" style="padding-bottom: 20px;">
        </div>
    `;

    subTabButtons = container.querySelectorAll('.sub-tab-btn');

    subTabButtons.forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            currentTabIndex = index;
            subTabButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            renderContent(e.target.dataset.tab);
            
            e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    });

    // 초기 렌더링
    subTabButtons.forEach(b => b.classList.remove('active'));
    const activeBtn = subTabButtons[currentTabIndex];
    if (activeBtn) {
        activeBtn.classList.add('active');
        renderContent(activeBtn.dataset.tab);
        setTimeout(() => { activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }, 50);
    }
};

const renderContent = (tabId) => {
    const content = document.getElementById('lifeContent');
    if (!content) return;

    let html = '';
    // 각 탭별로 수익 창출을 위한 제휴 배너 및 콘텐츠 UI 플레이스홀더 제공
    const cards = {
        'home': { icon: 'home', color: '#2980b9', title: '우리집 인테리어/점검', desc: '계절별 집 관리 노하우와 홈케어, 인테리어 소품을 만나보세요.', adText: '[AD] 홈케어/인테리어/청소업체 제휴 배너 영역' },
        'local': { icon: 'storefront', color: '#f39c12', title: '우리동네 상권', desc: '건물 주변의 맛집, 세탁소, 마트 등 로컬 상점 할인 및 배달 혜택입니다.', adText: '[AD] 로컬 상점 제휴 쿠폰/배달앱 연동 영역' },
        'health': { icon: 'favorite', color: '#e74c3c', title: '건강/라이프케어', desc: '바쁜 일상 속 건강 관리, 피트니스 및 헬스케어 정보입니다.', adText: '[AD] 건강기능식품/피트니스/보험 제휴 영역' },
        'culture': { icon: 'palette', color: '#8e44ad', title: '문화/여가', desc: '영화, 전시, 독서 등 여가 시간을 풍성하게 채워줄 정보입니다.', adText: '[AD] 문화/공연/OTT/도서 제휴 배너 영역' }
    };

    if (tabId === 'mall') {
        html = `
            <div>
                <h3 style="margin-top: 0; color: #2c3e50;"><span class="material-symbols-outlined" style="vertical-align: middle; color: #d35400;">shopping_bag</span> 나드몰 특가 상품</h3>
                <p style="font-size: 13px; color: #7f8c8d; line-height: 1.5;">GoNard 회원과 입주민들만을 위한 특별한 공동구매 및 생활용품 특가 쇼핑몰입니다.</p>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-top: 15px;">
                    <div style="background: white; border: 1px solid #eee; height: 160px; border-radius: 8px; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #95a5a6; cursor: pointer;">[상품 썸네일 1]</div>
                    <div style="background: white; border: 1px solid #eee; height: 160px; border-radius: 8px; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #95a5a6; cursor: pointer;">[상품 썸네일 2]</div>
                    <div style="background: white; border: 1px solid #eee; height: 160px; border-radius: 8px; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #95a5a6; cursor: pointer;">[상품 썸네일 3]</div>
                    <div style="background: white; border: 1px solid #eee; height: 160px; border-radius: 8px; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #95a5a6; cursor: pointer;">[상품 썸네일 4]</div>
                </div>
            </div>
        `;
    } else {
        const c = cards[tabId];
        html = `
            <div>
                <h3 style="margin-top: 0; color: #2c3e50;"><span class="material-symbols-outlined" style="vertical-align: middle; color: ${c.color};">${c.icon}</span> ${c.title}</h3>
                <p style="font-size: 13px; color: #7f8c8d; line-height: 1.5;">${c.desc}</p>
                <div style="background: #f4f6f8; height: 140px; border-radius: 8px; display: flex; justify-content: center; align-items: center; color: #bdc3c7; border: 1px dashed #ccc; cursor: pointer; text-align: center; padding: 10px; font-size: 13px;">
                    ${c.adText}
                </div>
            </div>
        `;
    }
    content.innerHTML = html;
};

let lastReclickTime = 0;
// 하단 탭 로테이션
export const onReclick = () => {
    if (!subTabButtons) return;
    const now = Date.now();
    if (now - lastReclickTime < 300) return; 
    lastReclickTime = now;
    currentTabIndex = (currentTabIndex + 1) % tabIds.length;
    subTabButtons[currentTabIndex].click();
};