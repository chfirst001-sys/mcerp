import { collection, getDocs, query, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../js/main.js";

export const init = (container) => {
    // 권한 제한: 입주자 및 일반 회원(가중치 30 이하)은 대시보드 접근 원천 차단
    if ((window.currentUserWeight || 0) <= 30) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c; background: #fff; border-radius: 8px; border: 1px solid #eee; margin-top: 20px;"><span class="material-symbols-outlined" style="font-size: 40px; color: #e74c3c; margin-bottom: 10px;">block</span><br>대시보드에 접근할 권한이 없습니다.<br><span style="font-size: 12px; color: #7f8c8d; margin-top: 5px; display: inline-block;">건물 관리자 전용 메뉴입니다.</span></div>';
        return;
    }

    // 선택된 건물 정보 가져오기 (localStorage 활용)
    const selectedBuildingId = localStorage.getItem('selectedBuildingId');
    const selectedBuildingName = localStorage.getItem('selectedBuildingName') || '전체 건물';

    // 상단 탭의 건물명 업데이트
    const currentBuildingNameEl = document.getElementById('currentBuildingName');
    if (currentBuildingNameEl) {
        currentBuildingNameEl.textContent = selectedBuildingName;
    }

    // 모드에 따라 렌더링 분기 1
    if (!selectedBuildingId) {
        renderAllBuildingsDashboard(container);
    } else {
        renderSingleBuildingDashboard(container, selectedBuildingId, selectedBuildingName);
    }
};

// [모드 1] 전체 건물 대시보드
const renderAllBuildingsDashboard = (container) => {
    // 권한 제한: 관리회사 혹은 본사 직원 이상만 전체 건물을 볼 수 있음
    if ((window.currentUserWeight || 0) <= 50) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #e74c3c; background: #fff; border-radius: 8px; border: 1px solid #eee; margin-top: 20px;"><span class="material-symbols-outlined" style="font-size: 40px; color: #e74c3c; margin-bottom: 10px;">block</span><br>전체 건물 현황을 조회할 권한이 없습니다.<br><span style="font-size: 12px; color: #7f8c8d; margin-top: 5px; display: inline-block;">소속된 건물이 설정되지 않았습니다. 관리자에게 문의하세요.</span></div>';
        return;
    }

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

        const now = new Date();
        const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // 광장(커뮤니티) 안 읽은 새 게시물 확인 로직
        let unreadCount = 0;
        let latestUnreadPost = null;
        try {
            const readPosts = JSON.parse(localStorage.getItem('readPlazaPosts_' + buildingId) || '[]');
            const postsQ = query(collection(db, "buildings", buildingId, "plaza_posts"), orderBy("createdAt", "desc"));
            const postsSnap = await getDocs(postsQ);
            
            postsSnap.forEach(postDoc => {
                if (!readPosts.includes(postDoc.id)) {
                    unreadCount++;
                    if (!latestUnreadPost) latestUnreadPost = { id: postDoc.id, ...postDoc.data() };
                }
            });
        } catch(e) {
            console.error("광장 새 게시물 로드 실패:", e);
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

            <div id="dashboardBillingSection"></div>

            ${unreadCount > 0 ? `
                <div style="background: #e8f4f8; border-radius: 8px; padding: 12px 15px; border-left: 4px solid #2980b9; display: flex; align-items: center; justify-content: space-between; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.05);" onclick="document.querySelector('.tab-item[data-module=\\'plaza\\']').click();">
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-size: 12px; color: #2980b9; font-weight: bold; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                            <span class="material-symbols-outlined" style="font-size: 16px;">mark_chat_unread</span>
                            새로운 광장 소식 (${unreadCount}개)
                        </div>
                        <div style="font-size: 13px; color: #34495e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            <strong style="color: #2c3e50;">${escapeHtml(latestUnreadPost.authorName || (latestUnreadPost.authorEmail ? latestUnreadPost.authorEmail.split('@')[0] : '익명'))}:</strong> ${escapeHtml(latestUnreadPost.content || '')}
                        </div>
                    </div>
                    <span class="material-symbols-outlined" style="color: #95a5a6;">chevron_right</span>
                </div>
            ` : ''}
        `;

        // ---------------------------------------------------------
        // 동적 부과 설정 현황 업데이트 로직 (과거 월 조회, 총액, 증감, 평균)
        // ---------------------------------------------------------
        const getPrevMonthStr = (monthStr, offset = 1) => {
            let [y, m] = monthStr.split('-').map(Number);
            m -= offset;
            while (m <= 0) { m += 12; y -= 1; }
            return `${y}-${String(m).padStart(2, '0')}`;
        };

        const getBillingData = (monthStr) => {
            let total = 0, fixedCount = 0, variableCount = 0, periodicCount = 0, otherCount = 0;
            const variableItemsList = ['공용전기', '세대전기', '공용수도', '세대수도', '가스', '전화', '인터넷', '비상통화장치'];
            const periodicItemsList = ['승강기보험', '주차기안전보험', '화재보험', '영업배상책임보험', '어린이놀이시설보험', '시설물배상보험', '승강기 정기검사', '승강기 정밀검사', '발전기검사', '전기안전검사', '주차기 검사', '주차기 정밀검사', '건축물안전검사', '장기수선충당금', '수선적립금', '건물수선비'];

            const getCat = (name, customCat) => {
                if (customCat) return customCat;
                if (variableItemsList.includes(name)) return 'variable';
                if (periodicItemsList.includes(name)) return 'periodic';
                return 'fixed';
            };

            if (bData.billingHistory && bData.billingHistory[monthStr]) {
                const hist = bData.billingHistory[monthStr];
                total = hist.totalSum || 0;
                const items = hist.items || {};
                for (const [k, v] of Object.entries(items)) {
                    const cat = getCat(k, v.customCategory);
                    if (cat === 'variable') variableCount++;
                    else if (cat === 'periodic') periodicCount++;
                    else fixedCount++;
                }
                otherCount = (hist.otherItems || []).length;
                return { total, fixedCount, variableCount, periodicCount, otherCount, isFinalized: true };
            } else {
                const items = bData.expenseConfig || {};
                for (const [k, v] of Object.entries(items)) {
                    total += Number(v.monthlyAmount) || 0;
                    const cat = getCat(k, v.customCategory);
                    if (cat === 'variable') variableCount++;
                    else if (cat === 'periodic') periodicCount++;
                    else fixedCount++;
                }
                const others = bData.otherExpenses ? (bData.otherExpenses[monthStr] || []) : [];
                otherCount = others.length;
                others.forEach(o => total += Number(o.amount) || 0);
                return { total, fixedCount, variableCount, periodicCount, otherCount, isFinalized: false };
            }
        };

        const updateBillingSection = (targetMonth) => {
            const billingSection = document.getElementById('dashboardBillingSection');
            if (!billingSection) return;

            const currData = getBillingData(targetMonth);
            const prev1Data = getBillingData(getPrevMonthStr(targetMonth, 1));
            const prev2Data = getBillingData(getPrevMonthStr(targetMonth, 2));
            const prev3Data = getBillingData(getPrevMonthStr(targetMonth, 3));

            const diff = currData.total - prev1Data.total;
            let diffStr = '-';
            let diffColor = '#7f8c8d';
            
            if (prev1Data.total > 0 || currData.total > 0) {
                if (diff > 0) { diffStr = `+${diff.toLocaleString()} 원 ▲`; diffColor = '#e74c3c'; }
                else if (diff < 0) { diffStr = `${Math.abs(diff).toLocaleString()} 원 ▼`; diffColor = '#2980b9'; }
                else { diffStr = '변동 없음 -'; diffColor = '#7f8c8d'; }
            }

            let sum3 = 0, count3 = 0;
            if (prev1Data.total > 0) { sum3 += prev1Data.total; count3++; }
            if (prev2Data.total > 0) { sum3 += prev2Data.total; count3++; }
            if (prev3Data.total > 0) { sum3 += prev3Data.total; count3++; }
            
            const avg3 = count3 > 0 ? Math.round(sum3 / count3) : 0;
            const avg3Str = avg3 > 0 ? `${avg3.toLocaleString()} 원` : '데이터 부족';

            billingSection.innerHTML = `<div style="margin-bottom: 20px; cursor: pointer;" onclick="document.querySelector('.tab-item[data-module=\\'accounting\\']').click();">
                <div style="background: #fff; border-radius: 8px; padding: 15px; border: 1px solid #eee; box-shadow: 0 1px 3px rgba(0,0,0,0.05); transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='#fff'">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h4 style="margin: 0; color: #2c3e50; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                            <span class="material-symbols-outlined" style="font-size: 18px; color: #2980b9;">receipt_long</span> 
                            부과 설정 현황
                        </h4>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="month" id="dashBillingMonth" value="${targetMonth}" style="padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; outline: none; cursor: pointer; background: #fdfefe;" onclick="event.stopPropagation();">
                            <span class="material-symbols-outlined" style="color: #bdc3c7; font-size: 16px;">chevron_right</span>
                        </div>
                    </div>

                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #f0f0f0;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px;">
                            <div>
                                <div style="font-size: 12px; color: #7f8c8d; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                                    총 부과 ${currData.isFinalized ? '확정액' : '예정액'}
                                    ${currData.isFinalized ? '<span style="background:#27ae60; color:white; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">확정됨</span>' : '<span style="background:#f39c12; color:white; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold;">예정</span>'}
                                </div>
                                <strong style="font-size: 22px; color: #2c3e50;">${currData.total.toLocaleString()}</strong> <span style="font-size: 13px; color: #34495e;">원</span>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 11px; color: #7f8c8d; margin-bottom: 4px;">전월 대비 증감</div>
                                <div style="font-size: 14px; font-weight: bold; color: ${diffColor};">${diffStr}</div>
                            </div>
                        </div>
                        <div style="border-top: 1px dashed #dcdde1; padding-top: 10px; font-size: 12px; color: #7f8c8d; display: flex; justify-content: space-between;">
                            <span>최근 3개월 평균:</span>
                            <strong style="color: #34495e;">${avg3Str}</strong>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #34495e;">
                        <div style="text-align: center; flex: 1;">
                            <div style="color: #7f8c8d; margin-bottom: 4px;">고정지출</div>
                            <strong style="font-size: 16px; color: #2c3e50;">${currData.fixedCount}</strong>건
                        </div>
                        <div style="text-align: center; flex: 1; border-left: 1px solid #eee;">
                            <div style="color: #7f8c8d; margin-bottom: 4px;">변동지출</div>
                            <strong style="font-size: 16px; color: #2c3e50;">${currData.variableCount}</strong>건
                        </div>
                        <div style="text-align: center; flex: 1; border-left: 1px solid #eee;">
                            <div style="color: #7f8c8d; margin-bottom: 4px;">주기지출</div>
                            <strong style="font-size: 16px; color: #2c3e50;">${currData.periodicCount}</strong>건
                        </div>
                        <div style="text-align: center; flex: 1; border-left: 1px solid #eee;">
                            <div style="color: #7f8c8d; margin-bottom: 4px;">기타지출</div>
                            <strong style="font-size: 16px; color: #2c3e50;">${currData.otherCount}</strong>건
                        </div>
                    </div>
                </div>
            </div>
            `;

            document.getElementById('dashBillingMonth').addEventListener('change', (e) => {
                updateBillingSection(e.target.value);
            });
        };

        updateBillingSection(currentMonthStr);

    } catch (error) {
        console.error("대시보드 로드 실패:", error);
        container.innerHTML = '<div style="color:red; text-align: center;">오류가 발생했습니다.</div>';
    }
};