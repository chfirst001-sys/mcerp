import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, escapeHtml } from "../js/main.js";

export const init = (container) => {
    container.innerHTML = `
        <!-- 단계 표시기 -->
        <div class="step-indicator-container" style="display: flex; gap: 15px; margin-bottom: 20px; background: white; padding: 12px 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-size: 13px; text-align: center; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch;">
            <div id="step1-indicator" style="flex: 0 0 auto; font-weight: bold; color: #2980b9;">1.기본정보</div>
            <div id="step2-indicator" style="flex: 0 0 auto; color: #95a5a6;">2.층수</div>
            <div id="step3-indicator" style="flex: 0 0 auto; color: #95a5a6;">3.호실수</div>
            <div id="step4-indicator" style="flex: 0 0 auto; color: #95a5a6;">4.호실편집</div>
            <div id="step5-indicator" style="flex: 0 0 auto; color: #95a5a6;">5.고정지출</div>
            <div id="step6-indicator" style="flex: 0 0 auto; color: #95a5a6;">6.변동지출</div>
            <div id="step7-indicator" style="flex: 0 0 auto; color: #95a5a6;">7.주기납부</div>
        </div>

        <form id="buildingRegisterForm">
            <!-- 1단계: 건물 기본 정보 -->
            <div id="step1-content">
                <h3 style="margin-top: 0;">1단계: 건물 기본 정보</h3>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">건물명</label>
                    <input type="text" id="bName" placeholder="예: MC타워" required style="max-width: 100%;">
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">주소 (행정구역 단위)</label>
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <select id="bAddressSido" required style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
                            <option value="">시/도 선택</option>
                            <option value="서울특별시">서울특별시</option><option value="부산광역시">부산광역시</option>
                            <option value="대구광역시">대구광역시</option><option value="인천광역시">인천광역시</option>
                            <option value="광주광역시">광주광역시</option><option value="대전광역시">대전광역시</option>
                            <option value="울산광역시">울산광역시</option><option value="세종특별자치시">세종특별자치시</option>
                            <option value="경기도">경기도</option><option value="강원특별자치도">강원특별자치도</option>
                            <option value="충청북도">충청북도</option><option value="충청남도">충청남도</option>
                            <option value="전북특별자치도">전북특별자치도</option><option value="전라남도">전라남도</option>
                            <option value="경상북도">경상북도</option><option value="경상남도">경상남도</option>
                            <option value="제주특별자치도">제주특별자치도</option>
                        </select>
                        <input type="text" id="bAddressSigungu" placeholder="시/군/구 (예: 강남구)" required style="flex: 1; margin-bottom: 0; max-width: 100%;">
                    </div>
                    <input type="text" id="bAddressDetail" placeholder="상세주소 (예: 테헤란로 123)" required style="max-width: 100%;">
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">건물 소속 지정</label>
                    <select id="bAffiliation" required style="padding: 10px; width: 100%; border: 1px solid #ccc; border-radius: 4px;">
                        <option value="headquarters">본사 직영</option>
                        <option value="management_company">관리 회사 위탁</option>
                        <option value="self_management">자치 관리</option>
                    </select>
                </div>
            </div>

            <!-- 2단계: 층수 설정 -->
            <div id="step2-content" style="display: none;">
                <h3 style="margin-top: 0;">2단계: 층수 설정</h3>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">지상 층수</label>
                        <input type="number" id="bFloors" placeholder="예: 5" min="1" required style="max-width: 100%;">
                    </div>
                    <div style="flex: 1;">
                        <label style="display: block; font-size: 12px; color: #7f8c8d; margin-bottom: 5px;">지하 층수</label>
                        <input type="number" id="bBasementFloors" placeholder="예: 2 (없으면 0)" min="0" value="0" required style="max-width: 100%;">
                    </div>
                </div>
            </div>

            <!-- 3단계: 층별 호실 수 설정 -->
            <div id="step3-content" style="display: none;">
                <h3 style="margin-top: 0;">3단계: 각 층별 호실 수 설정</h3>
                <p style="font-size: 12px; color: #7f8c8d; margin-bottom: 15px;">각 층에 생성할 기본 호실 수를 입력해주세요.</p>
                <div id="roomsPerFloorContainer" style="display: flex; flex-direction: column; gap: 10px; max-height: 400px; overflow-y: auto;"></div>
            </div>

            <!-- 4단계: 호실 목록 확인 및 편집 -->
            <div id="step4-content" style="display: none;">
                <h3 style="margin-top: 0;">4단계: 호실 목록 확인 및 편집</h3>
                <p style="font-size: 12px; color: #3498db; margin-bottom: 15px;">자동 생성된 호실을 확인하고, 필요시 호실명을 수정하거나 추가/삭제할 수 있습니다.<br><b>(최종적으로 여기에 남은 호실들이 건물의 총 세대수가 됩니다.)</b></p>
                <div id="roomsListContainer" style="display: flex; flex-direction: column; gap: 15px; max-height: 400px; overflow-y: auto; padding-right: 5px;"></div>
            </div>

            <!-- 5단계: 고정지출 항목 설정 -->
            <div id="step5-content" style="display: none;">
                <h3 style="margin-top: 0;">5단계: 고정지출 항목 설정</h3>
                <p style="font-size: 12px; color: #7f8c8d; margin-bottom: 15px;">매월 고정적으로 발생하는 지출 항목입니다.</p>
                <div id="expense-step5-container"></div>
            </div>

            <!-- 6단계: 변동지출 항목 설정 -->
            <div id="step6-content" style="display: none;">
                <h3 style="margin-top: 0;">6단계: 변동지출 항목 설정</h3>
                <p style="font-size: 12px; color: #7f8c8d; margin-bottom: 15px;">사용량 등에 따라 매월 금액이 변동되는 지출 항목입니다.</p>
                <div id="expense-step6-container"></div>
            </div>

            <!-- 7단계: 주기납부 항목 설정 -->
            <div id="step7-content" style="display: none;">
                <h3 style="margin-top: 0;">7단계: 주기납부 항목 설정</h3>
                <p style="font-size: 12px; color: #7f8c8d; margin-bottom: 15px;">연간 또는 특정 주기마다 발생하는 지출/예치 항목입니다.</p>
                <div id="expense-step7-container"></div>
            </div>

            <!-- 네비게이션 버튼 -->
            <div style="display: flex; justify-content: space-between; margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px;">
                <button type="button" id="prevBtn" style="background-color: #95a5a6; display: none;">이전 단계</button>
                <button type="button" id="nextBtn" style="background-color: #2980b9; margin-left: auto;">다음 단계</button>
                <button type="submit" id="submitBtn" style="background-color: #27ae60; display: none; margin-left: auto;">건물 등록 완료</button>
            </div>
        </form>
    `;

    let currentStep = 1;
    const totalSteps = 7;

    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');

    // 입력 폼 요소들
    const bName = document.getElementById('bName');
    const bAddressSido = document.getElementById('bAddressSido');
    const bAddressSigungu = document.getElementById('bAddressSigungu');
    const bAddressDetail = document.getElementById('bAddressDetail');
    const bAffiliation = document.getElementById('bAffiliation');
    const bFloors = document.getElementById('bFloors');
    const bBasementFloors = document.getElementById('bBasementFloors');

    // 지출항목 동적 생성 헬퍼 함수
    const renderExpenseGroup = (containerId, groups) => {
        const wrap = document.getElementById(containerId);
        if (!wrap) return;
        wrap.innerHTML = '';
        groups.forEach(g => {
            const groupDiv = document.createElement('div');
            groupDiv.style.marginBottom = '15px';
            
            let checkboxesHTML = g.items.map(item => `
                <label style="cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 13px;">
                    <input type="checkbox" name="expenseItem" value="${item}" checked style="width: auto; margin: 0;"> ${item}
                </label>
            `).join('');

            groupDiv.innerHTML = `
                <strong style="display:block; margin-bottom:8px; color:#2c3e50; font-size: 13px;">${g.title}</strong>
                <div class="expense-items-wrapper" style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                    ${checkboxesHTML}
                    <div class="custom-add-wrapper" style="display: flex; align-items: center; gap: 5px;">
                        <input type="text" class="custom-item-input" placeholder="직접 입력" style="margin: 0; padding: 4px 8px; width: 100px; font-size: 12px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                        <button type="button" class="add-custom-item-btn" style="padding: 4px 8px; font-size: 12px; background: #95a5a6; color: white; border: none; border-radius: 4px; cursor: pointer;">추가</button>
                    </div>
                </div>
            `;
            
            const addBtn = groupDiv.querySelector('.add-custom-item-btn');
            const addInput = groupDiv.querySelector('.custom-item-input');
            const wrapper = groupDiv.querySelector('.expense-items-wrapper');
            const customWrapper = groupDiv.querySelector('.custom-add-wrapper');
            
            addBtn.addEventListener('click', () => {
                const val = addInput.value.trim();
                if (val) {
                    const newLabel = document.createElement('label');
                    newLabel.style.cssText = 'cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 13px; color: #2980b9; font-weight: bold;';
                newLabel.innerHTML = `<input type="checkbox" name="expenseItem" value="${escapeHtml(val)}" checked style="width: auto; margin: 0;"> ${escapeHtml(val)}`;
                    wrapper.insertBefore(newLabel, customWrapper);
                    addInput.value = '';
                }
            });

            addInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addBtn.click();
                }
            });

            wrap.appendChild(groupDiv);
        });
    };

    // 화면 갱신 함수
    const updateUI = () => {
        for (let i = 1; i <= totalSteps; i++) {
            const content = document.getElementById(`step${i}-content`);
            const ind = document.getElementById(`step${i}-indicator`);
            if (content) content.style.display = currentStep === i ? 'block' : 'none';
            if (ind) ind.style.color = currentStep >= i ? '#2980b9' : '#bdc3c7';
            if (ind && currentStep === i) ind.style.fontWeight = 'bold';
            if (ind && currentStep !== i) ind.style.fontWeight = 'normal';
        }

        prevBtn.style.display = currentStep === 1 ? 'none' : 'block';
        nextBtn.style.display = currentStep === totalSteps ? 'none' : 'block';
        submitBtn.style.display = currentStep === totalSteps ? 'block' : 'none';
    };

    // 폼 유효성 검사
    const validateStep = () => {
        if (currentStep === 1) {
            if (!bName.value.trim()) { alert("건물명을 입력해주세요."); bName.focus(); return false; }
            if (!bAddressSido.value) { alert("시/도를 선택해주세요."); bAddressSido.focus(); return false; }
            if (!bAddressSigungu.value.trim()) { alert("시/군/구를 입력해주세요."); bAddressSigungu.focus(); return false; }
            if (!bAddressDetail.value.trim()) { alert("상세주소를 입력해주세요."); bAddressDetail.focus(); return false; }
        } else if (currentStep === 2) {
            if (!bFloors.value || bFloors.value < 1) { alert("지상 층수를 올바르게 입력해주세요."); bFloors.focus(); return false; }
            if (!bBasementFloors.value || bBasementFloors.value < 0) { alert("지하 층수를 올바르게 입력해주세요 (없으면 0)."); bBasementFloors.focus(); return false; }
        } else if (currentStep === 3) {
            const inputs = document.querySelectorAll('.floor-room-count');
            for (let input of inputs) {
                if (!input.value || input.value < 0) { alert("호실 수를 올바르게 입력해주세요."); input.focus(); return false; }
            }
        } else if (currentStep === 4) {
            const rooms = document.querySelectorAll('.room-name-input');
            if (rooms.length === 0) {
                if (!confirm("등록된 호실이 전혀 없습니다. 이대로 진행하시겠습니까?")) return false;
            }
        }
        return true;
    };

    const initExpenseGroups = () => {
        // 5단계 고정지출 생성
        renderExpenseGroup('expense-step5-container', [
            { title: 'A. 일반관리', items: ['위탁관리', '인건비(관리소장)', '인건비(경리)', '인건비(경비)', '인건비(미화)'] },
            { title: 'B. 안전관리', items: ['승강기안전', '소방안전', '전기안전', '주차기안전'] },
            { title: 'C. 미화ㆍ위생', items: ['청소ㆍ미화', '저수조청소', '수질검사', '방역', '정화조청소'] },
            { title: 'D. 보안', items: ['CCTV', '보안업체'] },
            { title: 'E. 주차비', items: ['주차비'] }
        ]);
        // 6단계 변동지출 생성
        renderExpenseGroup('expense-step6-container', [
            { title: 'A. 전기', items: ['공용전기', '세대전기'] },
            { title: 'B. 수도', items: ['공용수도', '세대수도'] },
            { title: 'C. 가스', items: ['가스'] },
            { title: 'D. 통신비', items: ['전화', '인터넷', '비상통화장치'] }
        ]);
        // 7단계 주기납부 생성
        renderExpenseGroup('expense-step7-container', [
            { title: 'A. 보험', items: ['승강기보험', '주차기안전보험', '화재보험', '영업배상책임보험', '어린이놀이시설보험', '시설물배상보험'] },
            { title: 'B. 검사비', items: ['승강기 정기검사', '승강기 정밀검사', '발전기검사', '전기안전검사', '주차기 검사', '주차기 정밀검사', '건축물안전검사'] },
            { title: 'C. 예치', items: ['장기수선충당금', '수선적립금', '건물수선비'] }
        ]);
    };

    nextBtn.addEventListener('click', () => { 
        if (validateStep()) { 
            // 2단계 -> 3단계 진입 시: 층별 입력창 동적 생성
            if (currentStep === 2) {
                const floors = parseInt(bFloors.value, 10);
                const basementFloors = parseInt(bBasementFloors.value, 10) || 0;
                const container = document.getElementById('roomsPerFloorContainer');
                container.innerHTML = '';
                
                // 지상층 생성 (최상층 -> 1층 순서)
                for (let i = floors; i >= 1; i--) {
                    container.innerHTML += `
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <label style="width: 50px; font-weight: bold; font-size: 14px;">${i}층:</label>
                            <input type="number" class="floor-room-count" data-floor="${i}" placeholder="호실 수" min="0" value="4" required style="flex: 1; margin-bottom: 0; max-width: 100%;">
                            <span style="font-size: 14px;">개</span>
                        </div>
                    `;
                }
                // 지하층 생성 (B1층 -> B2층 순서)
                for (let i = 1; i <= basementFloors; i++) {
                    container.innerHTML += `
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <label style="width: 50px; font-weight: bold; font-size: 14px;">B${i}층:</label>
                            <input type="number" class="floor-room-count" data-floor="B${i}" placeholder="호실 수" min="0" value="0" required style="flex: 1; margin-bottom: 0; max-width: 100%;">
                            <span style="font-size: 14px;">개</span>
                        </div>
                    `;
                }
            } 
            // 3단계 -> 4단계 진입 시: 실제 호실 편집창 동적 생성
            else if (currentStep === 3) {
                const container = document.getElementById('roomsListContainer');
            
            // 이미 호실 목록이 생성되어 있다면, 덮어쓸지 확인하여 사용자 편집 내용 보호
            if (container.innerHTML.trim() !== '') {
                if (!confirm('호실 목록을 새로고침할까요?\n(취소를 누르면 앞서 편집하신 호실 이름/추가 내역이 그대로 유지됩니다.)')) {
                    currentStep++; 
                    updateUI(); 
                    return;
                }
            }
                container.innerHTML = '';
                const floorInputs = document.querySelectorAll('.floor-room-count');
                
                floorInputs.forEach(input => {
                    const floor = input.dataset.floor; // B1, B2 등의 처리를 위해 문자열 그대로 사용
                    const count = parseInt(input.value, 10);
                    if (count === 0) return; // 호실 수가 0인 층은 건너뜀
                    
                    const floorSection = document.createElement('div');
                    floorSection.style.cssText = 'background: #f8f9fa; padding: 15px; border-radius: 6px; border: 1px solid #eee;';
                    floorSection.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <strong style="color: #2c3e50;">${floor}층</strong>
                            <button type="button" class="add-room-btn" data-floor="${floor}" style="background: #27ae60; color: white; border: none; padding: 6px 12px; font-size: 12px; border-radius: 4px; cursor: pointer;">+ 호실 추가</button>
                        </div>
                        <div class="rooms-wrapper" style="display: flex; flex-wrap: wrap; gap: 10px;"></div>
                    `;
                    
                    const wrapper = floorSection.querySelector('.rooms-wrapper');
                    
                    // 호실 입력 박스를 그리는 헬퍼 함수
                    const addRoomInputBox = (val) => {
                        const roomDiv = document.createElement('div');
                        roomDiv.style.cssText = 'display: flex; align-items: center; background: white; border: 1px solid #ccc; border-radius: 4px; overflow: hidden;';
                        roomDiv.innerHTML = `
                        <input type="text" class="room-name-input" value="${escapeHtml(val)}" required style="margin: 0; padding: 8px; width: 80px; border: none; outline: none; font-size: 13px;">
                            <button type="button" class="del-room-btn" style="background: #ffeaa7; color: #c0392b; border: none; padding: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="삭제"><span class="material-symbols-outlined" style="font-size: 16px;">close</span></button>
                        `;
                        roomDiv.querySelector('.del-room-btn').addEventListener('click', () => roomDiv.remove());
                        wrapper.appendChild(roomDiv);
                    };

                    // 지정한 수만큼 기본 호실 세팅
                    for (let r = 1; r <= count; r++) {
                        addRoomInputBox(`${floor}${r.toString().padStart(2, '0')}호`);
                    }
                    
                    // 호실 추가 버튼 이벤트
                    floorSection.querySelector('.add-room-btn').addEventListener('click', () => {
                        addRoomInputBox(`${floor}층 새호실`);
                    });
                    
                    container.appendChild(floorSection);
                });
            }

            currentStep++; 
            updateUI(); 
        } 
    });

    prevBtn.addEventListener('click', () => { currentStep--; updateUI(); });

    document.getElementById('buildingRegisterForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateStep()) return;

        submitBtn.disabled = true;
        submitBtn.textContent = 'DB에 저장 중...';

        try {
            const checkboxes = document.querySelectorAll('input[name="expenseItem"]:checked');
            const selectedExpenses = Array.from(checkboxes).map(cb => cb.value);

            // 4단계 편집화면에서 남은 최종 호실들을 배열로 수집
            const roomInputs = document.querySelectorAll('.room-name-input');
            const rooms = Array.from(roomInputs).map(inp => inp.value.trim()).filter(v => v !== '');

            const fullAddress = `${bAddressSido.value} ${bAddressSigungu.value} ${bAddressDetail.value}`;

            await addDoc(collection(db, "buildings"), {
                name: bName.value, 
                address: fullAddress, addressSido: bAddressSido.value,
                addressSigungu: bAddressSigungu.value, addressDetail: bAddressDetail.value,
                affiliation: bAffiliation.value,
                floors: parseInt(bFloors.value, 10), 
                basementFloors: parseInt(bBasementFloors.value, 10) || 0,
                totalRooms: rooms.length, // 세대수 계산
                roomsList: rooms, expenseItems: selectedExpenses, createdAt: serverTimestamp()
            });

            alert(`건물이 성공적으로 등록되었습니다!\n(자동 생성된 호실: 총 ${rooms.length}개)`);
            document.getElementById('buildingRegisterForm').reset();
            initExpenseGroups(); // 추가한 커스텀 지출항목 뷰 초기화
            currentStep = 1; updateUI();
        } catch (error) {
            console.error("건물 등록 실패:", error);
            alert('건물 등록 중 오류가 발생했습니다.');
        } finally {
            submitBtn.disabled = false; submitBtn.textContent = '건물 등록 완료';
        }
    });

    initExpenseGroups();
    updateUI();
};