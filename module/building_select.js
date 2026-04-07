import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../js/main.js";

export const init = (container) => {
    container.innerHTML = `
        <div class="module-card">
            <h2 style="display: flex; align-items: center; gap: 8px;"><span class="material-symbols-outlined">domain</span> 건물선택</h2>
            <p>관리할 건물을 선택하거나 변경하는 화면입니다.</p>
        </div>

        <div id="buildingSelectionList" style="display: flex; flex-direction: column; gap: 15px;">
            <div style="text-align: center; padding: 20px;">건물 목록을 불러오는 중...</div>
        </div>
    `;

    const listContainer = document.getElementById('buildingSelectionList');

    const loadBuildings = async () => {
        try {
            const q = query(collection(db, "buildings"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);

            listContainer.innerHTML = '';

            if (querySnapshot.empty) {
                listContainer.innerHTML = `
                    <div class="module-card" style="text-align: center; color: #7f8c8d;">
                        등록된 건물이 없습니다.<br>사이드바의 '건물등록' 메뉴에서 먼저 건물을 등록해주세요.
                    </div>
                `;
                return;
            }

            // 현재 선택된 건물 ID 가져오기
            const currentSelectedId = localStorage.getItem('selectedBuildingId');

            // [전체 건물 보기] 옵션 추가
            const allItem = document.createElement('div');
            allItem.className = 'module-card';
            const isAllSelected = !currentSelectedId;
            allItem.style.cssText = `cursor: pointer; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center; border: 2px solid ${isAllSelected ? '#2980b9' : 'transparent'}; background-color: ${isAllSelected ? '#f0f8ff' : 'white'}; margin-bottom: 0;`;
            
            allItem.innerHTML = `
                <div>
                    <h3 style="margin: 0 0 5px 0; color: #2c3e50;">🏢 전체 건물 통합 보기</h3>
                    <div style="font-size: 13px; color: #7f8c8d;">모든 건물의 요약 정보를 한눈에 확인합니다.</div>
                </div>
                <span class="material-symbols-outlined" style="color: ${isAllSelected ? '#2980b9' : '#e0e0e0'}; font-size: 28px;">check_circle</span>
            `;
            allItem.addEventListener('click', () => selectBuilding(null, '전체 건물'));
            listContainer.appendChild(allItem);

            // 개별 건물 목록 추가
            const affiliationMap = { 'headquarters': '본사 직영', 'management_company': '관리 회사 위탁', 'self_management': '자치 관리' };
            
            querySnapshot.forEach((docSnap) => {
                const building = docSnap.data();
                const bId = docSnap.id;
                const isSelected = currentSelectedId === bId;

                const item = document.createElement('div');
                item.className = 'module-card';
                item.style.cssText = `cursor: pointer; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center; border: 2px solid ${isSelected ? '#2980b9' : 'transparent'}; background-color: ${isSelected ? '#f0f8ff' : 'white'}; margin-bottom: 0;`;

                item.innerHTML = `
                    <div>
                    <h3 style="margin: 0 0 5px 0; color: #2c3e50;">${escapeHtml(building.name)}</h3>
                    <div style="font-size: 13px; color: #7f8c8d; margin-bottom: 5px;">📍 ${escapeHtml(building.address)}</div>
                        <div style="font-size: 12px; display: flex; gap: 8px;">
                            <span style="background: #e8f4f8; color: #2980b9; padding: 3px 8px; border-radius: 4px;">${affiliationMap[building.affiliation] || building.affiliation}</span>
                            <span style="background: #f4f6f8; color: #34495e; padding: 3px 8px; border-radius: 4px;">${building.floors}층 / 총 ${building.roomsList ? building.roomsList.length : 0}개 호실</span>
                        </div>
                    </div>
                    <span class="material-symbols-outlined" style="color: ${isSelected ? '#2980b9' : '#e0e0e0'}; font-size: 28px;">check_circle</span>
                `;
                item.addEventListener('click', () => selectBuilding(bId, building.name));
                listContainer.appendChild(item);
            });
        } catch (error) {
            console.error("건물 목록 로드 실패:", error);
            listContainer.innerHTML = '<div style="color: red; text-align: center;">건물 목록을 불러오는 중 오류가 발생했습니다.</div>';
        }
    };

    // 건물 선택 처리 함수
    const selectBuilding = (bId, bName) => {
        if (bId) {
            localStorage.setItem('selectedBuildingId', bId);
            localStorage.setItem('selectedBuildingName', bName);
        } else {
            localStorage.removeItem('selectedBuildingId');
            localStorage.removeItem('selectedBuildingName');
        }
        
        // 상단 헤더 이름 즉시 변경
        const headerNameEl = document.getElementById('currentBuildingName');
        if (headerNameEl) headerNameEl.textContent = bName;

        // 사용자에게 알림 후 대시보드로 이동
        const msg = bId ? "'" + bName + "'(으)로 건물이 선택되었습니다." : "전체 건물 통합 보기 모드로 전환되었습니다.";
        
        // UI의 즉각적인 피드백을 위해 0.1초 후 alert 및 이동
        setTimeout(() => {
            alert(msg);
            // 하단 탭의 대시보드 버튼을 프로그래밍 방식으로 클릭하여 화면 전환
            const dashboardTab = document.querySelector('.tab-item[data-module="dashboard"]');
            if (dashboardTab) dashboardTab.click();
        }, 100);
    };

    loadBuildings();
};