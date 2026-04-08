import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../js/main.js";

const tabIds = ['household', 'owner', 'resident', 'vehicle', 'items'];
let currentTabIndex = 0;
let lastBuildingId = null;

let subTabButtons = null;

let householdsConfig = {}; // 세대 상세 정보 보관
let itemsConfig = []; // 입주물품 배열 보관
let modalVehicles = []; // 모달 내 임시 차량 배열
let tempItemData = null; // 입주물품 모달 임시 데이터
let tempItemIndex = -1; // 수정 중인 물품 인덱스

export const init = (container) => {
    const currentBuildingId = localStorage.getItem('selectedBuildingId');
    if (lastBuildingId !== currentBuildingId) {
        currentTabIndex = 0;
        lastBuildingId = currentBuildingId;
    }

    container.innerHTML = `
        <!-- 상단 서브 탭 메뉴 -->
        <div class="sub-tab-menu">
            <button class="sub-tab-btn active" data-tab="household">세대정보</button>
            <button class="sub-tab-btn" data-tab="owner">소유주정보</button>
            <button class="sub-tab-btn" data-tab="resident">거주자정보</button>
            <button class="sub-tab-btn" data-tab="vehicle">차량관리</button>
            <button class="sub-tab-btn" data-tab="items">입주물품</button>
        </div>

        <!-- 하위 메뉴별 컨텐츠 영역 -->
        <div class="module-card">
            <h3 id="tabMainTitle" style="margin-top:0;">세대정보</h3>
            <p id="tabMainDesc" style="font-size: 12px; color: #7f8c8d; margin-bottom: 15px;"></p>
            <div id="tenantContent"></div>
        </div>

        <!-- 세대 상세정보 모달 -->
        <div id="householdModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 4000; justify-content: center; align-items: center;">
            <div style="background: white; padding: 20px; border-radius: 12px; width: 95%; max-width: 500px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex; flex-direction: column; max-height: 85vh;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-shrink: 0;">
                    <h3 id="hhModalTitle" style="margin: 0; color: #2c3e50;">세대 상세정보</h3>
                </div>
                
                <div style="overflow-y: auto; padding-right: 5px; flex: 1;">
                    <input type="hidden" id="hhRoomId">
                    
                    <!-- 소유자 정보 -->
                    <div style="background: #f8f9fa; border: 1px solid #eee; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                        <h4 style="margin-top: 0; color: #2980b9; margin-bottom: 10px; font-size: 14px;">소유자 정보</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div><label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:4px;">이름</label><input type="text" id="hhOwnerName" style="width:100%; margin:0; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;"></div>
                            <div><label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:4px;">연락처</label><input type="text" id="hhOwnerPhone" style="width:100%; margin:0; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;"></div>
                            <div><label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:4px;">매매계약일</label><input type="date" id="hhOwnerDate" style="width:100%; margin:0; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;"></div>
                            <div><label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:4px;">비고</label><input type="text" id="hhOwnerNote" style="width:100%; margin:0; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;"></div>
                        </div>
                    </div>

                    <!-- 거주자 정보 -->
                    <div style="background: #f8f9fa; border: 1px solid #eee; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                        <h4 style="margin-top: 0; color: #2980b9; margin-bottom: 10px; font-size: 14px;">거주자 정보</h4>
                        <div style="margin-bottom: 10px;">
                            <label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:4px;">거주구분</label>
                            <select id="hhResType" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing:border-box;">
                                <option value="공실">공실</option>
                                <option value="직주">직주 (소유자 거주)</option>
                                <option value="전세">전세</option>
                                <option value="월세">월세</option>
                            </select>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div><label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:4px;">이름</label><input type="text" id="hhResName" style="width:100%; margin:0; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;"></div>
                            <div><label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:4px;">연락처</label><input type="text" id="hhResPhone" style="width:100%; margin:0; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;"></div>
                            <div><label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:4px;">계약일</label><input type="date" id="hhResDate" style="width:100%; margin:0; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;"></div>
                            <div><label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:4px;">계약기간</label><input type="text" id="hhResPeriod" placeholder="예: 24개월" style="width:100%; margin:0; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;"></div>
                        </div>
                    </div>

                    <!-- 차량 정보 -->
                    <div style="background: #f8f9fa; border: 1px solid #eee; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h4 style="margin: 0; color: #2980b9; font-size: 14px;">차량 정보 (최대 4대)</h4>
                            <button type="button" id="addVehicleBtn" style="background: #27ae60; color: white; padding: 4px 8px; font-size: 12px; border: none; border-radius: 4px; cursor: pointer;">+ 차량추가</button>
                        </div>
                        <div id="hhVehicleContainer" style="display: flex; flex-direction: column; gap: 10px;"></div>
                    </div>

                    <!-- 직책 정보 -->
                    <div style="background: #f8f9fa; border: 1px solid #eee; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                        <h4 style="margin-top: 0; color: #2980b9; margin-bottom: 10px; font-size: 14px;">직책 정보</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div><label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:4px;">구분</label>
                                <select id="hhRoleClass" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing:border-box;">
                                    <option value="">선택안함</option>
                                    <option value="입주자대표회의">입주자대표회의</option>
                                    <option value="관리단">관리단</option>
                                </select>
                            </div>
                            <div><label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:4px;">직책</label><input type="text" id="hhRoleName" placeholder="예: 동대표" style="width:100%; margin:0; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;"></div>
                            <div style="grid-column: span 2;"><label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:4px;">선임날짜</label><input type="date" id="hhRoleDate" style="width:100%; margin:0; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;"></div>
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; flex-shrink: 0; margin-top: 15px;">
                    <button type="button" id="saveHhBtn" style="flex: 1; background: #2980b9; padding: 12px; font-size: 14px; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">수정 (저장)</button>
                    <button type="button" id="cancelHhBtn" style="flex: 1; background: #95a5a6; padding: 12px; font-size: 14px; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">취소</button>
                </div>
            </div>
        </div>

        <!-- 입주물품 상세정보 모달 -->
        <div id="itemDetailModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 4500; justify-content: center; align-items: center;">
            <div style="background: white; padding: 20px; border-radius: 12px; width: 95%; max-width: 600px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex; flex-direction: column; max-height: 85vh;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-shrink: 0;">
                    <h3 style="margin: 0; color: #2c3e50;">입주물품 상세정보</h3>
                </div>
                
                <div style="overflow-y: auto; padding-right: 5px; flex: 1;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom: 15px;">
                        <div><label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:4px;">품목 (이름)</label><input type="text" id="iName" style="width:100%; margin:0; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;"></div>
                        <div><label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:4px;">구매처</label><input type="text" id="iVendor" style="width:100%; margin:0; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;"></div>
                        <div><label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:4px;">제원</label><input type="text" id="iSpecs" style="width:100%; margin:0; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;"></div>
                        <div><label style="display:block; font-size:12px; color:#7f8c8d; margin-bottom:4px;">제조사</label><input type="text" id="iMfg" style="width:100%; margin:0; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;"></div>
                    </div>
                    
                    <div style="background:#e8f4f8; padding:10px 15px; border-radius:8px; border:1px solid #bce0fd; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
                        <strong style="color:#2c3e50;">현재 재고량</strong>
                        <strong id="iStock" style="color:#2980b9; font-size:20px;">0</strong>
                    </div>

                    <div style="background: #f8f9fa; border: 1px solid #eee; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                        <h4 style="margin-top: 0; color: #27ae60; margin-bottom: 10px; font-size: 14px;">구매 기록</h4>
                        <div id="iPurchaseList" style="margin-bottom: 10px; max-height: 120px; overflow-y: auto;"></div>
                        <div style="display:flex; gap:5px; align-items:center; border-top:1px dashed #ccc; padding-top:10px;">
                            <input type="date" id="newPurDate" style="flex:2; margin:0; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;">
                            <input type="number" id="newPurQty" placeholder="수량" style="flex:1; margin:0; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;">
                            <input type="number" id="newPurPrice" placeholder="가격(총액)" style="flex:2; margin:0; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;">
                            <button type="button" id="addPurBtn" style="background:#27ae60; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:12px; cursor:pointer;">추가</button>
                        </div>
                    </div>

                    <div style="background: #f8f9fa; border: 1px solid #eee; border-radius: 8px; padding: 15px;">
                        <h4 style="margin-top: 0; color: #e74c3c; margin-bottom: 10px; font-size: 14px;">분출 기록</h4>
                        <div id="iIssueList" style="margin-bottom: 10px; max-height: 120px; overflow-y: auto;"></div>
                        <div style="display:flex; gap:5px; align-items:center; border-top:1px dashed #ccc; padding-top:10px;">
                            <input type="date" id="newIssDate" style="flex:2; margin:0; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;">
                            <input type="text" id="newIssRoom" placeholder="호수" style="flex:1; margin:0; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;">
                            <input type="number" id="newIssQty" placeholder="수량" style="flex:1; margin:0; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;">
                            <input type="text" id="newIssReason" placeholder="사유" style="flex:2; margin:0; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box;">
                            <button type="button" id="addIssBtn" style="background:#e74c3c; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:12px; cursor:pointer;">추가</button>
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; flex-shrink: 0; margin-top: 15px;">
                    <button type="button" id="saveItemBtn" style="flex: 1; background: #2980b9; padding: 12px; font-size: 14px; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">저장</button>
                    <button type="button" id="delItemBtn" style="flex: 1; background: #e74c3c; padding: 12px; font-size: 14px; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; display: none;">삭제</button>
                    <button type="button" id="cancelItemBtn" style="flex: 1; background: #95a5a6; padding: 12px; font-size: 14px; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">취소</button>
                </div>
            </div>
        </div>
    `;

    subTabButtons = container.querySelectorAll('.sub-tab-btn');
    const tenantContent = document.getElementById('tenantContent');

    // 거주자 동기화 기능 (직주, 공실에 따른 필드 자동채움 및 비활성화)
    const syncResidentInfo = () => {
        const type = document.getElementById('hhResType').value;
        const ownerName = document.getElementById('hhOwnerName').value;
        const ownerPhone = document.getElementById('hhOwnerPhone').value;
        
        const resName = document.getElementById('hhResName');
        const resPhone = document.getElementById('hhResPhone');
        const resDate = document.getElementById('hhResDate');
        const resPeriod = document.getElementById('hhResPeriod');
        
        if (type === '직주') {
            resName.value = ownerName;
            resPhone.value = ownerPhone;
            [resName, resPhone].forEach(el => { el.readOnly = true; el.style.backgroundColor = '#eee'; });
            [resDate, resPeriod].forEach(el => { el.readOnly = false; el.style.backgroundColor = '#fff'; });
        } else if (type === '공실') {
            [resName, resPhone, resDate, resPeriod].forEach(el => { el.value = ''; el.readOnly = true; el.style.backgroundColor = '#eee'; });
        } else { // 전세, 월세
            [resName, resPhone, resDate, resPeriod].forEach(el => { el.readOnly = false; el.style.backgroundColor = '#fff'; });
        }
    };

    document.getElementById('hhResType').addEventListener('change', syncResidentInfo);
    document.getElementById('hhOwnerName').addEventListener('input', () => { if (document.getElementById('hhResType').value === '직주') syncResidentInfo(); });
    document.getElementById('hhOwnerPhone').addEventListener('input', () => { if (document.getElementById('hhResType').value === '직주') syncResidentInfo(); });

    // 차량 정보 렌더링
    const renderVehicles = () => {
        const vContainer = document.getElementById('hhVehicleContainer');
        if (!vContainer) return;
        vContainer.innerHTML = '';

        modalVehicles.forEach((v, idx) => {
            const vDiv = document.createElement('div');
            vDiv.style.cssText = 'border: 1px solid #ccc; border-radius: 6px; padding: 10px; background: white;';
            vDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <strong style="font-size: 13px; color: #34495e;">차량 ${idx + 1}</strong>
                    <button type="button" class="del-v-btn" data-idx="${idx}" style="background: #e74c3c; color: white; border: none; padding: 3px 8px; font-size: 11px; border-radius: 4px; cursor: pointer;">삭제</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <input type="text" class="v-num" placeholder="차량번호" value="${escapeHtml(v.num || '')}" style="margin:0; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box; width:100%;">
                    <input type="text" class="v-mfg" placeholder="제조사" value="${escapeHtml(v.mfg || '')}" style="margin:0; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box; width:100%;">
                    <input type="text" class="v-model" placeholder="차량명" value="${escapeHtml(v.model || '')}" style="margin:0; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box; width:100%;">
                    <input type="text" class="v-color" placeholder="색상" value="${escapeHtml(v.color || '')}" style="margin:0; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box; width:100%;">
                    <select class="v-type" style="margin:0; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box; width:100%;">
                        <option value="승용차" ${v.type==='승용차'?'selected':''}>승용차</option>
                        <option value="rv" ${v.type==='rv'?'selected':''}>RV</option>
                        <option value="승합차" ${v.type==='승합차'?'selected':''}>승합차</option>
                        <option value="트럭" ${v.type==='트럭'?'selected':''}>트럭</option>
                    </select>
                    <select class="v-fuel" style="margin:0; padding:6px; font-size:12px; border:1px solid #ccc; border-radius:4px; box-sizing:border-box; width:100%;">
                        <option value="휘발류" ${v.fuel==='휘발류'?'selected':''}>휘발류</option>
                        <option value="경유" ${v.fuel==='경유'?'selected':''}>경유</option>
                        <option value="전기" ${v.fuel==='전기'?'selected':''}>전기</option>
                    </select>
                </div>
            `;
            
            vDiv.querySelectorAll('input, select').forEach(el => {
                el.addEventListener('change', () => {
                    modalVehicles[idx] = {
                        num: vDiv.querySelector('.v-num').value,
                        mfg: vDiv.querySelector('.v-mfg').value,
                        model: vDiv.querySelector('.v-model').value,
                        color: vDiv.querySelector('.v-color').value,
                        type: vDiv.querySelector('.v-type').value,
                        fuel: vDiv.querySelector('.v-fuel').value
                    };
                });
            });
            vContainer.appendChild(vDiv);
        });

        vContainer.querySelectorAll('.del-v-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                modalVehicles.splice(e.target.dataset.idx, 1);
                renderVehicles();
            });
        });

        document.getElementById('addVehicleBtn').style.display = modalVehicles.length >= 4 ? 'none' : 'block';
    };

    document.getElementById('addVehicleBtn').addEventListener('click', () => {
        if (modalVehicles.length < 4) {
            modalVehicles.push({ num: '', mfg: '', model: '', color: '', type: '승용차', fuel: '휘발류' });
            renderVehicles();
        }
    });

    // 모달 닫기
    document.getElementById('cancelHhBtn').addEventListener('click', () => {
        document.getElementById('householdModal').style.display = 'none';
    });

    // --- 입주물품 상세 모달 제어 로직 ---
    const renderItemLists = () => {
        const purList = document.getElementById('iPurchaseList');
        const issList = document.getElementById('iIssueList');
        const stockEl = document.getElementById('iStock');

        let totalPur = 0;
        purList.innerHTML = tempItemData.purchases.length === 0 ? '<div style="font-size:12px; color:#7f8c8d;">구매 기록이 없습니다.</div>' : tempItemData.purchases.map((p, idx) => {
            totalPur += Number(p.qty);
            return `<div style="display:flex; justify-content:space-between; font-size:12px; padding:4px 0; border-bottom:1px solid #f0f0f0;">
                <span>[${p.date}] 수량: ${p.qty}개 (${Number(p.price).toLocaleString()}원)</span>
                <button type="button" data-idx="${idx}" class="del-pur-btn" style="background:none; border:none; color:#e74c3c; cursor:pointer;">삭제</button>
            </div>`;
        }).join('');

        let totalIss = 0;
        issList.innerHTML = tempItemData.issues.length === 0 ? '<div style="font-size:12px; color:#7f8c8d;">분출 기록이 없습니다.</div>' : tempItemData.issues.map((i, idx) => {
            totalIss += Number(i.qty);
            return `<div style="display:flex; justify-content:space-between; font-size:12px; padding:4px 0; border-bottom:1px solid #f0f0f0;">
                <span>[${i.date}] ${escapeHtml(i.room)} - ${i.qty}개 (${escapeHtml(i.reason)})</span>
                <button type="button" data-idx="${idx}" class="del-iss-btn" style="background:none; border:none; color:#e74c3c; cursor:pointer;">삭제</button>
            </div>`;
        }).join('');

        stockEl.textContent = (totalPur - totalIss).toLocaleString();

        purList.querySelectorAll('.del-pur-btn').forEach(btn => btn.addEventListener('click', (e) => {
            tempItemData.purchases.splice(e.target.dataset.idx, 1);
            renderItemLists();
        }));
        issList.querySelectorAll('.del-iss-btn').forEach(btn => btn.addEventListener('click', (e) => {
            tempItemData.issues.splice(e.target.dataset.idx, 1);
            renderItemLists();
        }));
    };

    document.getElementById('addPurBtn').addEventListener('click', () => {
        const d = document.getElementById('newPurDate').value;
        const q = document.getElementById('newPurQty').value;
        const p = document.getElementById('newPurPrice').value;
        if(!d || !q) return alert('날짜와 수량을 입력하세요.');
        tempItemData.purchases.push({ date: d, qty: Number(q), price: Number(p) });
        document.getElementById('newPurDate').value = '';
        document.getElementById('newPurQty').value = '';
        document.getElementById('newPurPrice').value = '';
        renderItemLists();
    });

    document.getElementById('addIssBtn').addEventListener('click', () => {
        const d = document.getElementById('newIssDate').value;
        const r = document.getElementById('newIssRoom').value;
        const q = document.getElementById('newIssQty').value;
        const reason = document.getElementById('newIssReason').value;
        if(!d || !r || !q) return alert('날짜, 호수, 수량을 입력하세요.');
        tempItemData.issues.push({ date: d, room: r, qty: Number(q), reason: reason });
        document.getElementById('newIssDate').value = '';
        document.getElementById('newIssRoom').value = '';
        document.getElementById('newIssQty').value = '';
        document.getElementById('newIssReason').value = '';
        renderItemLists();
    });

    document.getElementById('cancelItemBtn').addEventListener('click', () => {
        document.getElementById('itemDetailModal').style.display = 'none';
    });

    document.getElementById('saveItemBtn').addEventListener('click', async () => {
        tempItemData.name = document.getElementById('iName').value.trim();
        tempItemData.vendor = document.getElementById('iVendor').value.trim();
        tempItemData.specs = document.getElementById('iSpecs').value.trim();
        tempItemData.mfg = document.getElementById('iMfg').value.trim();

        if(!tempItemData.name) return alert('품목 이름을 입력하세요.');

        if (tempItemIndex === -1) itemsConfig.push(tempItemData);
        else itemsConfig[tempItemIndex] = tempItemData;

        try {
            await updateDoc(doc(db, "buildings", currentBuildingId), { itemsConfig });
            document.getElementById('itemDetailModal').style.display = 'none';
            renderActiveTable();
        } catch(e) {
            console.error(e);
            alert('물품 저장 중 오류가 발생했습니다.');
        }
    });

    document.getElementById('delItemBtn').addEventListener('click', async () => {
        if(confirm('정말 이 물품 전체를 삭제하시겠습니까? (기록도 모두 삭제됩니다)')) {
            itemsConfig.splice(tempItemIndex, 1);
            try {
                await updateDoc(doc(db, "buildings", currentBuildingId), { itemsConfig });
                document.getElementById('itemDetailModal').style.display = 'none';
                renderActiveTable();
            } catch(e) {
                alert('삭제 중 오류가 발생했습니다.');
            }
        }
    });

    const openItemModal = (idx) => {
        tempItemIndex = idx;
        if (idx === -1) {
            tempItemData = { id: 'item_'+Date.now(), name: '', vendor: '', specs: '', mfg: '', purchases: [], issues: [] };
            document.getElementById('delItemBtn').style.display = 'none';
        } else {
            tempItemData = JSON.parse(JSON.stringify(itemsConfig[idx])); // 깊은 복사
            document.getElementById('delItemBtn').style.display = 'block';
        }
        
        document.getElementById('iName').value = tempItemData.name;
        document.getElementById('iVendor').value = tempItemData.vendor;
        document.getElementById('iSpecs').value = tempItemData.specs;
        document.getElementById('iMfg').value = tempItemData.mfg;
        
        renderItemLists();
        document.getElementById('itemDetailModal').style.display = 'flex';
    };

    // --- 탭별 타이틀 및 렌더링 로직 ---
    const renderTabContent = (tabId) => {
        const titleMap = {
            household: { title: '세대정보', desc: '전체 세대의 기본 정보를 요약하여 보여줍니다.' },
            owner: { title: '소유주정보', desc: '각 세대의 소유주 이름, 연락처 및 계약 정보를 관리합니다.' },
            resident: { title: '거주자정보', desc: '실제 거주하고 있는 사람의 정보 및 임대차 계약 내용을 확인합니다.' },
            vehicle: { title: '차량관리', desc: '세대별로 등록된 차량들의 번호와 상세 정보를 한눈에 봅니다.' },
            items: { title: '입주물품', desc: '로비출입키, 리모컨 등 호실별 입주물품 지급 내역과 전체 재고를 관리합니다.' }
        };
        document.getElementById('tabMainTitle').textContent = titleMap[tabId].title;
        document.getElementById('tabMainDesc').textContent = titleMap[tabId].desc;

        loadTenantData();
    };

    let sortedRoomsCache = [];

    const loadTenantData = async () => {
        const content = document.getElementById('tenantContent');
        content.innerHTML = '<div style="text-align: center; padding: 20px; color: #7f8c8d;">데이터를 불러오는 중...</div>';

        if (!currentBuildingId) {
            content.innerHTML = '<div style="color:#e74c3c; padding: 20px; text-align: center;">선택된 건물이 없습니다.</div>';
            return;
        }

        try {
            const docSnap = await getDoc(doc(db, "buildings", currentBuildingId));
            if (!docSnap.exists()) {
                content.innerHTML = '<div style="color:#e74c3c; padding: 20px; text-align: center;">건물 정보를 찾을 수 없습니다.</div>';
                return;
            }

            const buildingData = docSnap.data();
            const roomsList = buildingData.roomsList || [];
            householdsConfig = buildingData.households || {};
            itemsConfig = buildingData.itemsConfig || [];
            
            if (roomsList.length === 0) {
                content.innerHTML = '<div style="color:#7f8c8d; padding: 20px; text-align: center; background:#f8f9fa; border-radius:8px;">등록된 호실이 없습니다.</div>';
                return;
            }

            sortedRoomsCache = [...roomsList].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            renderActiveTable();

        } catch (error) {
            console.error("세대 정보 로드 실패:", error);
            content.innerHTML = '<div style="color:red; padding: 20px; text-align: center;">오류가 발생했습니다.</div>';
        }
    };

    const renderActiveTable = () => {
        const content = document.getElementById('tenantContent');
        const tabId = tabIds[currentTabIndex];
        
        // CSS Sticky 설정을 위한 변수 정의 (1행, 1열, 2열 틀고정)
        const thBase = 'padding: 10px; border-bottom: 1px solid #bdc3c7; border-right: 1px solid #34495e; position: sticky; top: 0; z-index: 2; background-color: #2c3e50; color: white;';
        const thLast = 'padding: 10px; border-bottom: 1px solid #bdc3c7; position: sticky; top: 0; z-index: 2; background-color: #2c3e50; color: white;';
        const thCol1 = 'padding: 10px; border-bottom: 1px solid #bdc3c7; border-right: 1px solid #34495e; position: sticky; top: 0; left: 0; z-index: 3; background-color: #1a252f; color: white; width: 50px; min-width: 50px; box-sizing: border-box;';
        const thCol2 = 'padding: 10px; border-bottom: 1px solid #bdc3c7; border-right: 2px solid #95a5a6; position: sticky; top: 0; left: 50px; z-index: 3; background-color: #1a252f; color: white; width: 80px; min-width: 80px; box-sizing: border-box; box-shadow: 2px 0 5px rgba(0,0,0,0.1);';
        
        const tdBase = 'padding: 10px; border-bottom: 1px solid #eee; border-right: 1px solid #eee;';
        const tdLast = 'padding: 10px; border-bottom: 1px solid #eee;';
        const tdCol1 = 'padding: 10px; border-bottom: 1px solid #eee; border-right: 1px solid #eee; position: sticky; left: 0; z-index: 1; background-color: inherit; width: 50px; min-width: 50px; box-sizing: border-box; text-align: center;';
        const tdCol2 = 'padding: 10px; border-bottom: 1px solid #eee; border-right: 2px solid #bdc3c7; position: sticky; left: 50px; z-index: 1; background-color: inherit; font-weight: bold; color: #2980b9; width: 80px; min-width: 80px; box-sizing: border-box; box-shadow: 2px 0 5px rgba(0,0,0,0.05); text-align: center;';

        let theadHtml = '';
        if (tabId === 'household') {
            theadHtml = `<th style="${thCol1}">No</th><th style="${thCol2}">호수</th><th style="${thBase}">소유자</th><th style="${thBase}">소유자 연락처</th><th style="${thBase}">거주구분</th><th style="${thBase}">거주자</th><th style="${thLast}">거주자 연락처</th>`;
        } else if (tabId === 'owner') {
            theadHtml = `<th style="${thCol1}">No</th><th style="${thCol2}">호수</th><th style="${thBase}">소유자 이름</th><th style="${thBase}">소유자 연락처</th><th style="${thBase}">매매계약일</th><th style="${thLast}">비고</th>`;
        } else if (tabId === 'resident') {
            theadHtml = `<th style="${thCol1}">No</th><th style="${thCol2}">호수</th><th style="${thBase}">거주구분</th><th style="${thBase}">거주자 이름</th><th style="${thBase}">거주자 연락처</th><th style="${thBase}">계약일</th><th style="${thLast}">계약기간</th>`;
        } else if (tabId === 'vehicle') {
            theadHtml = `<th style="${thCol1}">No</th><th style="${thCol2}">호수</th><th style="${thBase}">거주자</th><th style="${thBase}">차량 1</th><th style="${thBase}">차량 2</th><th style="${thBase}">차량 3</th><th style="${thLast}">차량 4</th>`;
        } else if (tabId === 'items') {
            theadHtml = `<th style="${thCol1}">No</th><th style="${thCol2}">호수</th><th style="${thBase}">거주자</th>` + itemsConfig.map((item, idx) => {
                const isLast = idx === itemsConfig.length - 1;
                return `<th class="item-header-col" data-idx="${idx}" style="${isLast ? thLast : thBase} cursor:pointer; color:#f1c40f; text-decoration:underline;" title="클릭하여 상세 기록 및 수정">${escapeHtml(item.name)}</th>`;
            }).join('');
        }

        let listHtml = `
            ${tabId === 'items' ? `<div style="text-align:right; margin-bottom:10px;"><button type="button" id="createNewItemBtn" style="background:#f39c12; color:white; border:none; padding:6px 12px; border-radius:4px; font-size:12px; cursor:pointer;">+ 새 입주물품 추가</button></div>` : ''}
                <div style="overflow: auto; max-height: 600px; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); position: relative;">
                    <table style="width: 100%; border-collapse: separate; border-spacing: 0; text-align: center; font-size: 13px; white-space: nowrap;">
                        <thead>
                            <tr>
                                ${theadHtml}
                            </tr>
                        </thead>
                        <tbody>
            `;

        sortedRoomsCache.forEach((room, idx) => {
                const info = householdsConfig[room] || {};
                const resType = info.residentType || '공실';
                let badgeColor = '#e74c3c';
                if(resType === '직주') badgeColor = '#27ae60';
                else if(resType === '전세' || resType === '월세') badgeColor = '#f39c12';

            let rowHtml = `<td style="${tdCol1}">${idx + 1}</td>
                           <td style="${tdCol2}">${escapeHtml(room)}</td>`;
            
            if (tabId === 'household') {
                rowHtml += `<td style="${tdBase}">${escapeHtml(info.ownerName || '-')}</td>
                            <td style="${tdBase}">${escapeHtml(info.ownerPhone || '-')}</td>
                            <td style="${tdBase}">
                                <span style="padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background: ${badgeColor}; color: white;">${escapeHtml(resType)}</span>
                            </td>
                            <td style="${tdBase}">${escapeHtml(info.residentName || '-')}</td>
                            <td style="${tdLast}">${escapeHtml(info.residentPhone || '-')}</td>`;
            } else if (tabId === 'owner') {
                rowHtml += `<td style="${tdBase}">${escapeHtml(info.ownerName || '-')}</td>
                            <td style="${tdBase}">${escapeHtml(info.ownerPhone || '-')}</td>
                            <td style="${tdBase}">${escapeHtml(info.ownerDate || '-')}</td>
                            <td style="${tdLast} white-space: normal; min-width: 150px;">${escapeHtml(info.ownerNote || '-')}</td>`;
            } else if (tabId === 'resident') {
                rowHtml += `<td style="${tdBase}">
                                <span style="padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background: ${badgeColor}; color: white;">${escapeHtml(resType)}</span>
                            </td>
                            <td style="${tdBase}">${escapeHtml(info.residentName || '-')}</td>
                            <td style="${tdBase}">${escapeHtml(info.residentPhone || '-')}</td>
                            <td style="${tdBase}">${escapeHtml(info.residentDate || '-')}</td>
                            <td style="${tdLast}">${escapeHtml(info.residentPeriod || '-')}</td>`;
            } else if (tabId === 'vehicle') {
                const v = info.vehicles || [];
                const getV = (i) => v[i] ? `${escapeHtml(v[i].num)}<br><span style="font-size:11px; color:#7f8c8d;">(${escapeHtml(v[i].type)})</span>` : '-';
                rowHtml += `<td style="${tdBase}">${escapeHtml(info.residentName || '-')}</td>
                            <td style="${tdBase}">${getV(0)}</td>
                            <td style="${tdBase}">${getV(1)}</td>
                            <td style="${tdBase}">${getV(2)}</td>
                            <td style="${tdLast}">${getV(3)}</td>`;
            } else if (tabId === 'items') {
                rowHtml += `<td style="${tdBase}">${escapeHtml(info.residentName || '-')}</td>`;
                itemsConfig.forEach((item, index) => {
                    const roomIssueCount = item.issues.filter(i => i.room === room).reduce((s, i) => s + Number(i.qty), 0);
                    const isLast = index === itemsConfig.length - 1;
                    rowHtml += `<td style="${isLast ? tdLast : tdBase} ${roomIssueCount > 0 ? 'font-weight:bold; color:#2980b9;' : 'color:#bdc3c7;'}">${roomIssueCount}</td>`;
                });
            }

            listHtml += `<tr class="room-row" data-room="${escapeHtml(room)}" style="cursor: pointer; background-color: #fff; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f4f6f8'" onmouseout="this.style.backgroundColor='#fff'">${rowHtml}</tr>`;
            });
            
            listHtml += '</tbody></table></div>';
        content.innerHTML = listHtml;

        // 이벤트 연동 (새 물품 추가)
        const createNewItemBtn = document.getElementById('createNewItemBtn');
        if (createNewItemBtn) {
            createNewItemBtn.addEventListener('click', () => openItemModal(-1));
        }

        // 이벤트 연동 (물품 열 클릭)
        content.querySelectorAll('.item-header-col').forEach(th => {
            th.addEventListener('click', (e) => {
                e.stopPropagation(); // 아래 row-row 클릭 방지
                openItemModal(e.target.dataset.idx);
            });
        });

            content.querySelectorAll('.room-row').forEach(row => {
                row.addEventListener('click', (e) => {
                    const roomName = e.currentTarget.dataset.room;
                    const info = householdsConfig[roomName] || {};
                    
                    document.getElementById('hhModalTitle').textContent = roomName + ' 상세정보';
                    document.getElementById('hhRoomId').value = roomName;
                    
                    document.getElementById('hhOwnerName').value = info.ownerName || '';
                    document.getElementById('hhOwnerPhone').value = info.ownerPhone || '';
                    document.getElementById('hhOwnerDate').value = info.ownerDate || '';
                    document.getElementById('hhOwnerNote').value = info.ownerNote || '';
                    
                    document.getElementById('hhResType').value = info.residentType || '공실';
                    document.getElementById('hhResName').value = info.residentName || '';
                    document.getElementById('hhResPhone').value = info.residentPhone || '';
                    document.getElementById('hhResDate').value = info.residentDate || '';
                    document.getElementById('hhResPeriod').value = info.residentPeriod || '';
                    
                    document.getElementById('hhRoleClass').value = info.roleClass || '';
                    document.getElementById('hhRoleName').value = info.roleName || '';
                    document.getElementById('hhRoleDate').value = info.roleDate || '';

                    modalVehicles = info.vehicles ? JSON.parse(JSON.stringify(info.vehicles)) : [];
                    
                    syncResidentInfo();
                    renderVehicles();
                    
                    document.getElementById('householdModal').style.display = 'flex';
                });
            });
    };

    // 세대 정보 저장 로직
    document.getElementById('saveHhBtn').addEventListener('click', async () => {
        const roomId = document.getElementById('hhRoomId').value;
        const btn = document.getElementById('saveHhBtn');
        btn.disabled = true; btn.textContent = '저장 중...';
        
        householdsConfig[roomId] = {
            ownerName: document.getElementById('hhOwnerName').value.trim(),
            ownerPhone: document.getElementById('hhOwnerPhone').value.trim(),
            ownerDate: document.getElementById('hhOwnerDate').value,
            ownerNote: document.getElementById('hhOwnerNote').value.trim(),
            residentType: document.getElementById('hhResType').value,
            residentName: document.getElementById('hhResName').value.trim(),
            residentPhone: document.getElementById('hhResPhone').value.trim(),
            residentDate: document.getElementById('hhResDate').value,
            residentPeriod: document.getElementById('hhResPeriod').value.trim(),
            vehicles: modalVehicles,
            roleClass: document.getElementById('hhRoleClass').value,
            roleName: document.getElementById('hhRoleName').value.trim(),
            roleDate: document.getElementById('hhRoleDate').value
        };

        try {
            await updateDoc(doc(db, "buildings", currentBuildingId), {
                households: householdsConfig
            });
            alert(`${roomId} 세대 정보가 저장되었습니다.`);
            document.getElementById('householdModal').style.display = 'none';
            renderActiveTable(); // 테이블 즉시 갱신
        } catch (error) {
            console.error(error);
            alert("저장 중 오류가 발생했습니다.");
        } finally {
            btn.disabled = false; btn.textContent = '수정 (저장)';
        }
    });

    // 탭 클릭 이벤트 등록
    subTabButtons.forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            currentTabIndex = index;
            subTabButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderTabContent(e.target.dataset.tab);
            e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    });

    // 초기 로드
    subTabButtons.forEach(b => b.classList.remove('active'));
    const activeBtn = subTabButtons[currentTabIndex];
    activeBtn.classList.add('active');
    renderTabContent(activeBtn.dataset.tab);
    setTimeout(() => { activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }, 50);
};

let lastReclickTime = 0; // 마지막 클릭 시간 저장용

export const onReclick = () => {
    if (!subTabButtons) return;

    // 빠른 연속 클릭 방지 (건너뜀 현상 해결)
    const now = Date.now();
    if (now - lastReclickTime < 300) return;
    lastReclickTime = now;

    currentTabIndex = (currentTabIndex + 1) % tabIds.length;
    subTabButtons[currentTabIndex].click();
};