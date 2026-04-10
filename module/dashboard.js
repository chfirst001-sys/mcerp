import { collection, getDocs, query, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
const renderSingleBuildingDashboard = async (container, buildingId, buildingName) => {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: #7f8c8d;">대시보드 데이터를 불러오는 중...</div>';

    try {
        const docSnap = await getDoc(doc(db, "buildings", buildingId));
        if (!docSnap.exists()) {
            container.innerHTML = '<div style="color:red; text-align: center;">건물 정보를 찾을 수 없습니다.</div>';
            return;
        }
        
        const bData = docSnap.data();
        const roomsList = bData.roomsList || [];
        const totalRooms = roomsList.length;
        
        // 공실 계산 로직
        let vacantCount = 0;
        const households = bData.households || {};
        roomsList.forEach(room => {
            if (households[room] && households[room].residentType === '공실') {
                vacantCount++;
            }
        });
        
        // 최근 달 미납 데이터 계산 로직
        let unpaidCount = 0;
        let unpaidAmount = 0;
        const billingHistory = bData.billingHistory || {};
        const collections = bData.collections || {};
        const months = Object.keys(billingHistory).sort().reverse();
        
        if (months.length > 0) {
            const latestMonth = months[0];
            const currentBill = billingHistory[latestMonth];
            const currentCollection = collections[latestMonth] || {};
            
            let baseAmount = 0;
            if (bData.billingConfig?.splitMethod === 'N분의일부과' && totalRooms > 0) {
                baseAmount = Math.ceil((currentBill.totalSum / totalRooms) / 10) * 10;
            }
            
            roomsList.forEach(room => {
                const billed = baseAmount;
                const colData = currentCollection[room] || { amount: 0 };
                const collected = Number(colData.amount) || 0;
                const unpaid = billed - collected;
                if (unpaid > 0) {
                    unpaidCount++;
                    unpaidAmount += unpaid;
                }
            });
        }
        
        container.innerHTML = `
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <div class="module-card" style="flex: 1; text-align: center; margin-bottom: 0;">
                    <div style="font-size: 12px; color: #7f8c8d;">총 호실</div>
                    <div style="font-size: 24px; font-weight: bold; color: #2c3e50;">${totalRooms}</div>
                </div>
                <div class="module-card" style="flex: 1; text-align: center; margin-bottom: 0;">
                    <div style="font-size: 12px; color: #7f8c8d;">공실</div>
                    <div style="font-size: 24px; font-weight: bold; color: #e74c3c;">${vacantCount}</div>
                </div>
                <div class="module-card" style="flex: 1; text-align: center; margin-bottom: 0;">
                    <div style="font-size: 12px; color: #7f8c8d;">미납 (최근 월)</div>
                    <div style="font-size: 24px; font-weight: bold; color: #f39c12;">${unpaidCount}</div>
                    <div style="font-size: 12px; color: #e74c3c; margin-top: 5px;">${unpaidAmount.toLocaleString()}원</div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error("대시보드 로드 실패:", error);
        container.innerHTML = '<div style="color:red; text-align: center;">오류가 발생했습니다.</div>';
    }
};