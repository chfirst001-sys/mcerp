import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../js/main.js";

export const init = (container) => {
    // 선택된 건물 정보 가져오기 (localStorage 활용)
    const selectedBuildingId = localStorage.getItem('selectedBuildingId');
    const selectedBuildingName = localStorage.getItem('selectedBuildingName') || '전체 건물';

    // 상단 탭의 건물명 업데이트
    const currentBuildingNameEl = document.getElementById('currentBuildingName');
    if (currentBuildingNameEl) {
        currentBuildingNameEl.textContent = selectedBuildingName;
    }

    // 모드에 따라 렌더링 분기
    if (!selectedBuildingId) {
        renderAllBuildingsDashboard(container);
    } else {
        renderSingleBuildingDashboard(container, selectedBuildingId, selectedBuildingName);
    }
};

// [모드 1] 전체 건물 대시보드
const renderAllBuildingsDashboard = (container) => {
    container.innerHTML = `
        <div class="module-card">
            <h3 style="display: flex; align-items: center; gap: 8px;"><span class="material-symbols-outlined">dashboard</span> 전체 건물 요약</h3>
            <p>현재 등록된 모든 건물의 통합 대시보드입니다.</p>
        </div>

        <h3>등록된 건물 현황</h3>
        <ul id="buildingList"></ul>
    `;

    const buildingList = document.getElementById('buildingList');

    const displayBuildings = async () => {
        buildingList.innerHTML = '<li style="text-align:center;">데이터를 불러오는 중...</li>';
        try {
            const q = query(collection(db, "buildings"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            
            buildingList.innerHTML = '';
            if (querySnapshot.empty) {
                buildingList.innerHTML = '<li>등록된 건물이 없습니다.</li>';
                return;
            }

            querySnapshot.forEach((doc) => {
                const building = doc.data();
                const listItem = document.createElement('li');
                const dateStr = building.createdAt ? building.createdAt.toDate().toLocaleString() : '방금 전';
                
                listItem.innerHTML = `
                    <strong>${escapeHtml(building.name)}</strong> (${building.floors}층)
                    <div style="font-size: 12px; color: #7f8c8d; margin-top: 5px;">등록일: ${dateStr}</div>
                `;

                // 리스트 클릭 시 해당 건물을 선택(모드 2로 전환)하도록 이벤트 추가
                listItem.style.cursor = 'pointer';
                listItem.addEventListener('click', () => {
                    localStorage.setItem('selectedBuildingId', doc.id);
                    localStorage.setItem('selectedBuildingName', building.name);
                    init(container); // 대시보드 모듈 리렌더링
                });

                buildingList.appendChild(listItem);
            });
        } catch (error) {
            console.error("목록 조회 실패:", error);
            buildingList.innerHTML = '<li style="color:red;">목록을 불러오지 못했습니다.</li>';
        }
    };

    displayBuildings();
};

// [모드 2] 선택된 단일 건물 대시보드
const renderSingleBuildingDashboard = (container, buildingId, buildingName) => {
    container.innerHTML = `
        <div class="module-card">
            <h3 style="display: flex; align-items: center; gap: 8px; color: #2980b9;">
                <span class="material-symbols-outlined">domain</span> ${escapeHtml(buildingName)} 대시보드
            </h3>
            <p>해당 건물의 공실 현황, 이번 달 수납율, 접수된 민원 등을 한눈에 확인합니다.</p>
            <button id="clearSelectionBtn" style="background-color: #7f8c8d; margin-top: 15px;">
                <span class="material-symbols-outlined" style="vertical-align: middle; font-size: 18px;">arrow_back</span> 전체 건물로 돌아가기
            </button>
        </div>
        
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <div class="module-card" style="flex: 1; text-align: center; margin-bottom: 0;">
                <div style="font-size: 12px; color: #7f8c8d;">총 호실</div>
                <div style="font-size: 24px; font-weight: bold;">0</div>
            </div>
            <div class="module-card" style="flex: 1; text-align: center; margin-bottom: 0;">
                <div style="font-size: 12px; color: #7f8c8d;">공실</div>
                <div style="font-size: 24px; font-weight: bold; color: #e74c3c;">0</div>
            </div>
            <div class="module-card" style="flex: 1; text-align: center; margin-bottom: 0;">
                <div style="font-size: 12px; color: #7f8c8d;">미납</div>
                <div style="font-size: 24px; font-weight: bold; color: #f39c12;">0</div>
            </div>
        </div>
    `;

    // '전체 건물로 돌아가기' 버튼 이벤트
    document.getElementById('clearSelectionBtn').addEventListener('click', () => {
        localStorage.removeItem('selectedBuildingId');
        localStorage.removeItem('selectedBuildingName');
        init(container); // 대시보드 모듈 리렌더링
    });
};